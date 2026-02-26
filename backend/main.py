import os
from pathlib import Path
from typing import Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ai import (
    MissingApiKeyError,
    OpenRouterUpstreamError,
    request_openrouter_completion,
    request_openrouter_structured_output,
)
from db import (
    DEFAULT_DB_PATH,
    DEFAULT_BOARD,
    append_chat_message_for_user,
    get_board_for_user,
    get_chat_messages_for_user,
    get_default_board,
    initialize_database,
    update_board_for_user,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database(DEFAULT_DB_PATH)
    yield


app = FastAPI(title="Project Management MVP API", lifespan=lifespan)

_BACKEND_DIR = Path(__file__).resolve().parent
_STATIC_DIR = _BACKEND_DIR / "static"
_STATIC_INDEX = _STATIC_DIR / "index.html"

# CORS for development (frontend on port 3000, backend on port 8000)
if os.environ.get("PM_CORS_ORIGINS"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ["PM_CORS_ORIGINS"].split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )

_MAX_TITLE_LENGTH = 200
_MAX_DETAILS_LENGTH = 2000
_MAX_CARDS_PER_COLUMN = 100
_MAX_CHAT_MESSAGE_LENGTH = 2000
_MAX_PROMPT_LENGTH = 2000


class CardModel(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=_MAX_TITLE_LENGTH)
    details: str = Field(min_length=1, max_length=_MAX_DETAILS_LENGTH)


class ColumnModel(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=_MAX_TITLE_LENGTH)
    cardIds: list[str] = Field(default_factory=list, max_length=_MAX_CARDS_PER_COLUMN)


class BoardPayload(BaseModel):
    columns: list[ColumnModel] = Field(default_factory=list, max_length=10)
    cards: dict[str, CardModel] = Field(default_factory=dict)


class AiCheckPayload(BaseModel):
    prompt: str = Field(min_length=1, max_length=_MAX_PROMPT_LENGTH)


class AiCheckResponse(BaseModel):
    assistant_message: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=_MAX_CHAT_MESSAGE_LENGTH)


class BoardUpdatePayload(BaseModel):
    board: BoardPayload | None = None


class ChatResponse(BaseModel):
    assistant_message: str
    board_update: BoardPayload | None = None


def _has_valid_fixed_columns(board: dict[str, Any]) -> bool:
    expected_ids = [column["id"] for column in DEFAULT_BOARD["columns"]]
    columns = board.get("columns")
    if not isinstance(columns, list):
        return False

    actual_ids = [column.get("id") for column in columns if isinstance(column, dict)]
    return actual_ids == expected_ids


def _has_valid_card_refs(board: dict[str, Any]) -> bool:
    """Check that cardIds in columns and keys in cards are consistent."""
    columns = board.get("columns")
    cards = board.get("cards")
    if not isinstance(columns, list) or not isinstance(cards, dict):
        return False

    all_card_ids: list[str] = []
    for column in columns:
        if isinstance(column, dict):
            all_card_ids.extend(column.get("cardIds", []))

    # Every cardId in columns must exist in cards
    if not all(card_id in cards for card_id in all_card_ids):
        return False

    # Every card key must appear in exactly one column
    if set(all_card_ids) != set(cards.keys()):
        return False

    # No duplicates across columns
    if len(all_card_ids) != len(set(all_card_ids)):
        return False

    return True


def _parse_chat_response(
    raw: dict[str, Any], current_board: dict[str, Any]
) -> tuple[str, dict[str, Any] | None]:
    assistant_message = raw.get("assistant_message")
    if not isinstance(assistant_message, str) or not assistant_message.strip():
        raise HTTPException(
            status_code=502,
            detail="AI response missing required assistant_message.",
        )

    board_update_raw = raw.get("board_update")
    if board_update_raw is None:
        return assistant_message.strip(), None

    if not isinstance(board_update_raw, dict):
        raise HTTPException(status_code=502, detail="AI board_update must be an object.")

    board_raw = board_update_raw.get("board")
    if board_raw is None:
        raise HTTPException(
            status_code=502,
            detail="AI board_update must include board when present.",
        )

    try:
        validated_board = BoardPayload.model_validate(board_raw).model_dump()
    except Exception as error:
        raise HTTPException(status_code=502, detail="AI returned invalid board payload.") from error

    if not _has_valid_fixed_columns(validated_board):
        raise HTTPException(
            status_code=502,
            detail="AI board_update must keep the fixed five-column structure.",
        )

    if not _has_valid_fixed_columns(current_board):
        raise HTTPException(
            status_code=500,
            detail="Current board is invalid. Reset board before applying AI updates.",
        )

    return assistant_message.strip(), validated_board


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


_MVP_USERNAME = "user"


@app.get("/api/board")
def get_board() -> dict[str, Any]:
    result = get_board_for_user(DEFAULT_DB_PATH, _MVP_USERNAME)
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")

    board, _version = result

    if not _has_valid_fixed_columns(board):
        default = get_default_board()
        update_board_for_user(DEFAULT_DB_PATH, _MVP_USERNAME, default)
        return default

    return board


@app.put("/api/board")
def put_board(payload: BoardPayload) -> dict[str, str]:
    board_payload = payload.model_dump()
    if not _has_valid_fixed_columns(board_payload):
        raise HTTPException(
            status_code=422,
            detail="Board must keep the fixed five-column structure.",
        )

    if not _has_valid_card_refs(board_payload):
        raise HTTPException(
            status_code=422,
            detail="Card references are inconsistent: every cardId must exist in cards and vice versa.",
        )

    updated = update_board_for_user(DEFAULT_DB_PATH, _MVP_USERNAME, board_payload)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "ok"}


@app.post("/api/ai/check", response_model=AiCheckResponse)
async def ai_check(payload: AiCheckPayload) -> AiCheckResponse:
    try:
        message = await request_openrouter_completion(prompt=payload.prompt)
    except MissingApiKeyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenRouterUpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return AiCheckResponse(assistant_message=message)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    result = get_board_for_user(DEFAULT_DB_PATH, _MVP_USERNAME)
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")

    board, version_before = result
    history = get_chat_messages_for_user(DEFAULT_DB_PATH, _MVP_USERNAME)

    try:
        raw_response = await request_openrouter_structured_output(
            board=board,
            user_message=payload.message,
            conversation_history=history,
        )
    except MissingApiKeyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenRouterUpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    assistant_message, board_update = _parse_chat_response(raw_response, board)

    append_chat_message_for_user(DEFAULT_DB_PATH, _MVP_USERNAME, "user", payload.message)
    append_chat_message_for_user(DEFAULT_DB_PATH, _MVP_USERNAME, "assistant", assistant_message)

    if board_update is not None:
        updated = update_board_for_user(
            DEFAULT_DB_PATH, _MVP_USERNAME, board_update, expected_version=version_before
        )
        if not updated:
            raise HTTPException(
                status_code=409,
                detail="Board was modified while AI was processing. Please retry.",
            )

    if board_update is None:
        return ChatResponse(assistant_message=assistant_message, board_update=None)

    return ChatResponse(
        assistant_message=assistant_message,
        board_update=BoardPayload.model_validate(board_update),
    )


@app.get("/")
def root() -> FileResponse:
    return FileResponse(_STATIC_INDEX)


if _STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
