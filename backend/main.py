import os
from pathlib import Path
from typing import Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
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
from auth import create_token, decode_token
from db import (
    DEFAULT_DB_PATH,
    add_card_comment,
    append_chat_message,
    authenticate_user,
    create_board,
    create_user,
    delete_board,
    delete_card_comment,
    get_board,
    get_card_comments,
    get_chat_messages,
    get_user_by_id,
    initialize_database,
    list_boards_for_user,
    update_board_data,
    update_board_meta,
    update_user_display_name,
    update_user_password,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database(DEFAULT_DB_PATH)
    yield


app = FastAPI(title="Project Management API", lifespan=lifespan)

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
_MAX_BOARD_NAME_LENGTH = 100
_MAX_BOARD_DESC_LENGTH = 500


# --- Pydantic models ---

class CardModel(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=_MAX_TITLE_LENGTH)
    details: str = Field(min_length=1, max_length=_MAX_DETAILS_LENGTH)
    priority: str | None = Field(default=None, max_length=20)
    due_date: str | None = Field(default=None, max_length=30)
    labels: list[str] = Field(default_factory=list, max_length=10)


class ColumnModel(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=_MAX_TITLE_LENGTH)
    cardIds: list[str] = Field(default_factory=list, max_length=_MAX_CARDS_PER_COLUMN)


class BoardPayload(BaseModel):
    columns: list[ColumnModel] = Field(default_factory=list, max_length=20)
    cards: dict[str, CardModel] = Field(default_factory=dict)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=4, max_length=200)
    display_name: str = Field(default="", max_length=100)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)


class AuthResponse(BaseModel):
    token: str
    user: dict[str, Any]


class CreateBoardRequest(BaseModel):
    name: str = Field(min_length=1, max_length=_MAX_BOARD_NAME_LENGTH)
    description: str = Field(default="", max_length=_MAX_BOARD_DESC_LENGTH)


class UpdateBoardMetaRequest(BaseModel):
    name: str = Field(min_length=1, max_length=_MAX_BOARD_NAME_LENGTH)
    description: str = Field(default="", max_length=_MAX_BOARD_DESC_LENGTH)


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=4, max_length=200)


class AiCheckPayload(BaseModel):
    prompt: str = Field(min_length=1, max_length=_MAX_PROMPT_LENGTH)


class AiCheckResponse(BaseModel):
    assistant_message: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=_MAX_CHAT_MESSAGE_LENGTH)


class ChatResponse(BaseModel):
    assistant_message: str
    board_update: BoardPayload | None = None


class AddCommentRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


# --- Auth helper ---

def _get_current_user(request: Request) -> dict[str, Any]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header[7:]
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = get_user_by_id(DEFAULT_DB_PATH, payload["user_id"])
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# --- Validation helpers ---

def _has_valid_columns(board: dict[str, Any]) -> bool:
    """Check that columns exist, have unique IDs, and at least one column."""
    columns = board.get("columns")
    if not isinstance(columns, list) or len(columns) == 0:
        return False
    ids = []
    for column in columns:
        if not isinstance(column, dict):
            return False
        col_id = column.get("id")
        if not col_id or not isinstance(col_id, str):
            return False
        ids.append(col_id)
    return len(ids) == len(set(ids))


def _has_valid_card_refs(board: dict[str, Any]) -> bool:
    columns = board.get("columns")
    cards = board.get("cards")
    if not isinstance(columns, list) or not isinstance(cards, dict):
        return False

    all_card_ids: list[str] = []
    for column in columns:
        if isinstance(column, dict):
            all_card_ids.extend(column.get("cardIds", []))

    if not all(card_id in cards for card_id in all_card_ids):
        return False

    if set(all_card_ids) != set(cards.keys()):
        return False

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

    if not _has_valid_columns(validated_board):
        raise HTTPException(
            status_code=502,
            detail="AI board_update has invalid column structure.",
        )

    if not _has_valid_card_refs(validated_board):
        raise HTTPException(
            status_code=502,
            detail="AI board_update has inconsistent card references.",
        )

    return assistant_message.strip(), validated_board


# --- Health ---

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# --- Auth endpoints ---

@app.post("/api/auth/register", response_model=AuthResponse)
def register(payload: RegisterRequest) -> AuthResponse:
    user_id = create_user(
        DEFAULT_DB_PATH,
        payload.username,
        payload.password,
        payload.display_name or payload.username,
    )
    if user_id is None:
        raise HTTPException(status_code=409, detail="Username already taken")

    # Create a default board for the new user
    create_board(DEFAULT_DB_PATH, user_id, "My First Board", "Default project board")

    token = create_token(user_id, payload.username)
    return AuthResponse(
        token=token,
        user={"id": user_id, "username": payload.username, "display_name": payload.display_name or payload.username},
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    user = authenticate_user(DEFAULT_DB_PATH, payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user["id"], user["username"])
    return AuthResponse(token=token, user=user)


@app.get("/api/auth/me")
def get_me(request: Request) -> dict[str, Any]:
    return _get_current_user(request)


@app.patch("/api/auth/profile")
def update_profile(payload: UpdateProfileRequest, request: Request) -> dict[str, Any]:
    user = _get_current_user(request)
    updated = update_user_display_name(DEFAULT_DB_PATH, user["id"], payload.display_name)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    user["display_name"] = payload.display_name
    return user


@app.post("/api/auth/change-password")
def change_password(payload: ChangePasswordRequest, request: Request) -> dict[str, str]:
    user = _get_current_user(request)
    success = update_user_password(
        DEFAULT_DB_PATH, user["id"], payload.current_password, payload.new_password
    )
    if not success:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    return {"status": "ok"}


# --- Board CRUD endpoints ---

@app.get("/api/boards")
def list_boards(request: Request) -> list[dict[str, Any]]:
    user = _get_current_user(request)
    return list_boards_for_user(DEFAULT_DB_PATH, user["id"])


@app.post("/api/boards", status_code=201)
def create_board_endpoint(payload: CreateBoardRequest, request: Request) -> dict[str, Any]:
    user = _get_current_user(request)
    board_id = create_board(DEFAULT_DB_PATH, user["id"], payload.name, payload.description)
    return {"id": board_id, "name": payload.name, "description": payload.description}


@app.get("/api/boards/{board_id}")
def get_board_endpoint(board_id: int, request: Request) -> dict[str, Any]:
    user = _get_current_user(request)
    result = get_board(DEFAULT_DB_PATH, board_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")

    board_data, version, name, description = result

    return {
        "id": board_id,
        "name": name,
        "description": description,
        "version": version,
        "board": board_data,
    }


@app.put("/api/boards/{board_id}")
def update_board_endpoint(board_id: int, payload: BoardPayload, request: Request) -> dict[str, str]:
    user = _get_current_user(request)
    board_payload = payload.model_dump()

    if not _has_valid_columns(board_payload):
        raise HTTPException(
            status_code=422,
            detail="Board must have at least one column with unique IDs.",
        )

    if not _has_valid_card_refs(board_payload):
        raise HTTPException(
            status_code=422,
            detail="Card references are inconsistent: every cardId must exist in cards and vice versa.",
        )

    updated = update_board_data(DEFAULT_DB_PATH, board_id, user["id"], board_payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"status": "ok"}


@app.patch("/api/boards/{board_id}/meta")
def update_board_meta_endpoint(board_id: int, payload: UpdateBoardMetaRequest, request: Request) -> dict[str, str]:
    user = _get_current_user(request)
    updated = update_board_meta(DEFAULT_DB_PATH, board_id, user["id"], payload.name, payload.description)
    if not updated:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"status": "ok"}


@app.delete("/api/boards/{board_id}")
def delete_board_endpoint(board_id: int, request: Request) -> dict[str, str]:
    user = _get_current_user(request)
    deleted = delete_board(DEFAULT_DB_PATH, board_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"status": "ok"}


# --- Card comments ---

@app.get("/api/boards/{board_id}/cards/{card_id}/comments")
def get_comments(board_id: int, card_id: str, request: Request) -> list[dict[str, Any]]:
    user = _get_current_user(request)
    result = get_board(DEFAULT_DB_PATH, board_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return get_card_comments(DEFAULT_DB_PATH, board_id, card_id)


@app.post("/api/boards/{board_id}/cards/{card_id}/comments", status_code=201)
def post_comment(
    board_id: int, card_id: str, payload: AddCommentRequest, request: Request
) -> dict[str, Any]:
    user = _get_current_user(request)
    comment = add_card_comment(
        DEFAULT_DB_PATH, board_id, card_id, user["id"], payload.content
    )
    if comment is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return comment


@app.delete("/api/boards/{board_id}/cards/{card_id}/comments/{comment_id}")
def remove_comment(
    board_id: int, card_id: str, comment_id: int, request: Request
) -> dict[str, str]:
    user = _get_current_user(request)
    # Verify user owns the board
    result = get_board(DEFAULT_DB_PATH, board_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    deleted = delete_card_comment(DEFAULT_DB_PATH, comment_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"status": "ok"}


# --- Legacy board endpoints (backward compat for frontend during transition) ---

_MVP_USERNAME = "user"


@app.get("/api/board")
def get_board_legacy(request: Request) -> dict[str, Any]:
    user = _get_current_user(request)
    boards = list_boards_for_user(DEFAULT_DB_PATH, user["id"])
    if not boards:
        raise HTTPException(status_code=404, detail="Board not found")

    result = get_board(DEFAULT_DB_PATH, boards[0]["id"], user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")

    board_data, _version, _name, _desc = result
    return board_data


@app.put("/api/board")
def put_board_legacy(payload: BoardPayload, request: Request) -> dict[str, str]:
    user = _get_current_user(request)
    board_payload = payload.model_dump()

    if not _has_valid_columns(board_payload):
        raise HTTPException(
            status_code=422,
            detail="Board must have at least one column with unique IDs.",
        )

    if not _has_valid_card_refs(board_payload):
        raise HTTPException(
            status_code=422,
            detail="Card references are inconsistent: every cardId must exist in cards and vice versa.",
        )

    boards = list_boards_for_user(DEFAULT_DB_PATH, user["id"])
    if not boards:
        raise HTTPException(status_code=404, detail="Board not found")

    updated = update_board_data(DEFAULT_DB_PATH, boards[0]["id"], user["id"], board_payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"status": "ok"}


# --- AI endpoints ---

@app.post("/api/ai/check", response_model=AiCheckResponse)
async def ai_check(payload: AiCheckPayload) -> AiCheckResponse:
    try:
        message = await request_openrouter_completion(prompt=payload.prompt)
    except MissingApiKeyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenRouterUpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return AiCheckResponse(assistant_message=message)


@app.post("/api/boards/{board_id}/chat", response_model=ChatResponse)
async def chat_on_board(board_id: int, payload: ChatRequest, request: Request) -> ChatResponse:
    user = _get_current_user(request)
    result = get_board(DEFAULT_DB_PATH, board_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")

    board_data, version_before, _name, _desc = result
    history = get_chat_messages(DEFAULT_DB_PATH, board_id)

    try:
        raw_response = await request_openrouter_structured_output(
            board=board_data,
            user_message=payload.message,
            conversation_history=history,
        )
    except MissingApiKeyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenRouterUpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    assistant_message, board_update = _parse_chat_response(raw_response, board_data)

    append_chat_message(DEFAULT_DB_PATH, board_id, user["id"], "user", payload.message)
    append_chat_message(DEFAULT_DB_PATH, board_id, user["id"], "assistant", assistant_message)

    if board_update is not None:
        updated = update_board_data(
            DEFAULT_DB_PATH, board_id, user["id"], board_update, expected_version=version_before
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


# --- Legacy chat endpoint ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat_legacy(payload: ChatRequest, request: Request) -> ChatResponse:
    user = _get_current_user(request)
    boards = list_boards_for_user(DEFAULT_DB_PATH, user["id"])
    if not boards:
        raise HTTPException(status_code=404, detail="Board not found")

    board_id = boards[0]["id"]
    result = get_board(DEFAULT_DB_PATH, board_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")

    board_data, version_before, _name, _desc = result
    history = get_chat_messages(DEFAULT_DB_PATH, board_id)

    try:
        raw_response = await request_openrouter_structured_output(
            board=board_data,
            user_message=payload.message,
            conversation_history=history,
        )
    except MissingApiKeyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenRouterUpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    assistant_message, board_update = _parse_chat_response(raw_response, board_data)

    append_chat_message(DEFAULT_DB_PATH, board_id, user["id"], "user", payload.message)
    append_chat_message(DEFAULT_DB_PATH, board_id, user["id"], "assistant", assistant_message)

    if board_update is not None:
        updated = update_board_data(
            DEFAULT_DB_PATH, board_id, user["id"], board_update, expected_version=version_before
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


# --- Static file serving ---

@app.get("/")
def root() -> FileResponse:
    return FileResponse(_STATIC_INDEX)


if _STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
