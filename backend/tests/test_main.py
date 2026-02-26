from pathlib import Path
import sys

from fastapi.testclient import TestClient
import pytest

from ai import MissingApiKeyError, OpenRouterUpstreamError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_board(client: TestClient) -> None:
    response = client.get("/api/board")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload.get("columns"), list)
    assert isinstance(payload.get("cards"), dict)


def test_put_board(client: TestClient) -> None:
    payload = {
        "columns": [
            {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
            {"id": "col-discovery", "title": "Discovery", "cardIds": []},
            {"id": "col-progress", "title": "In Progress", "cardIds": []},
            {"id": "col-review", "title": "Review", "cardIds": []},
            {"id": "col-done", "title": "Done", "cardIds": []},
        ],
        "cards": {
            "card-1": {"id": "card-1", "title": "Task", "details": "Do it"}
        },
    }

    update_response = client.put("/api/board", json=payload)
    assert update_response.status_code == 200
    assert update_response.json() == {"status": "ok"}

    get_response = client.get("/api/board")
    assert get_response.status_code == 200
    assert get_response.json() == payload


def test_put_board_rejects_invalid_payload(client: TestClient) -> None:
    response = client.put(
        "/api/board",
        json={
            "columns": [{"id": "col-1", "title": "Todo", "cardIds": "not-a-list"}],
            "cards": {},
        },
    )
    assert response.status_code == 422


def test_put_board_rejects_oversized_title(client: TestClient) -> None:
    response = client.put(
        "/api/board",
        json={
            "columns": [
                {"id": "col-backlog", "title": "x" * 201, "cardIds": []},
                {"id": "col-discovery", "title": "Discovery", "cardIds": []},
                {"id": "col-progress", "title": "In Progress", "cardIds": []},
                {"id": "col-review", "title": "Review", "cardIds": []},
                {"id": "col-done", "title": "Done", "cardIds": []},
            ],
            "cards": {},
        },
    )
    assert response.status_code == 422


def test_ai_check_success(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _mock(prompt: str) -> str:
        return f"Echo: {prompt}"

    monkeypatch.setattr("main.request_openrouter_completion", _mock)

    response = client.post("/api/ai/check", json={"prompt": "2+2"})

    assert response.status_code == 200
    assert response.json() == {"assistant_message": "Echo: 2+2"}


def test_ai_check_missing_api_key_maps_to_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _raise(prompt: str) -> str:
        raise MissingApiKeyError("OPENROUTER_API_KEY is not configured.")

    monkeypatch.setattr("main.request_openrouter_completion", _raise)

    response = client.post("/api/ai/check", json={"prompt": "hello"})

    assert response.status_code == 503
    assert response.json() == {"detail": "OPENROUTER_API_KEY is not configured."}


def test_ai_check_upstream_error_maps_to_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _raise(prompt: str) -> str:
        raise OpenRouterUpstreamError("Failed to reach OpenRouter.")

    monkeypatch.setattr("main.request_openrouter_completion", _raise)

    response = client.post("/api/ai/check", json={"prompt": "hello"})

    assert response.status_code == 502
    assert response.json() == {"detail": "Failed to reach OpenRouter."}


def test_chat_response_only_no_board_update(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _mock(board, user_message, conversation_history):
        return {"assistant_message": "No changes needed"}

    monkeypatch.setattr("main.request_openrouter_structured_output", _mock)

    response = client.post("/api/chat", json={"message": "summarize"})

    assert response.status_code == 200
    assert response.json() == {
        "assistant_message": "No changes needed",
        "board_update": None,
    }


def test_chat_valid_board_update_is_applied(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    new_board = {
        "columns": [
            {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
            {"id": "col-discovery", "title": "Discovery", "cardIds": []},
            {"id": "col-progress", "title": "In Progress", "cardIds": []},
            {"id": "col-review", "title": "Review", "cardIds": []},
            {"id": "col-done", "title": "Done", "cardIds": []},
        ],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "Task",
                "details": "Updated by AI",
            }
        },
    }

    async def _mock(board, user_message, conversation_history):
        return {
            "assistant_message": "Updated board",
            "board_update": {"board": new_board},
        }

    monkeypatch.setattr("main.request_openrouter_structured_output", _mock)

    response = client.post("/api/chat", json={"message": "update board"})

    assert response.status_code == 200
    body = response.json()
    assert body["assistant_message"] == "Updated board"
    assert body["board_update"] == new_board

    board_response = client.get("/api/board")
    assert board_response.status_code == 200
    assert board_response.json() == new_board


def test_chat_invalid_structured_output_is_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _mock(board, user_message, conversation_history):
        return {"board_update": {"board": {"columns": [], "cards": {}}}}

    monkeypatch.setattr("main.request_openrouter_structured_output", _mock)

    response = client.post("/api/chat", json={"message": "break schema"})

    assert response.status_code == 502
    assert response.json() == {
        "detail": "AI response missing required assistant_message."
    }


def test_put_board_rejects_non_fixed_columns(client: TestClient) -> None:
    response = client.put(
        "/api/board",
        json={
            "columns": [{"id": "col-1", "title": "Only", "cardIds": []}],
            "cards": {},
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Board must keep the fixed five-column structure."
    }


def test_chat_rejects_ai_board_update_that_breaks_columns(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _mock(board, user_message, conversation_history):
        return {
            "assistant_message": "Updated",
            "board_update": {
                "board": {
                    "columns": [{"id": "col-1", "title": "Only", "cardIds": []}],
                    "cards": {},
                }
            },
        }

    monkeypatch.setattr("main.request_openrouter_structured_output", _mock)

    response = client.post("/api/chat", json={"message": "collapse columns"})

    assert response.status_code == 502
    assert response.json() == {
        "detail": "AI board_update must keep the fixed five-column structure."
    }


def test_get_board_repairs_invalid_persisted_board(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "main.get_board_for_user",
        lambda db_path, username: (
            {
                "columns": [{"id": "col-1", "title": "Only", "cardIds": []}],
                "cards": {},
            },
            1,
        ),
    )

    calls: list[dict] = []

    def _capture_update(db_path, username, board, expected_version=None):
        calls.append(board)
        return True

    monkeypatch.setattr("main.update_board_for_user", _capture_update)

    response = client.get("/api/board")

    assert response.status_code == 200
    payload = response.json()
    assert [column["id"] for column in payload["columns"]] == [
        "col-backlog",
        "col-discovery",
        "col-progress",
        "col-review",
        "col-done",
    ]
    assert len(calls) == 1


def test_put_board_rejects_inconsistent_card_refs(client: TestClient) -> None:
    response = client.put(
        "/api/board",
        json={
            "columns": [
                {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-missing"]},
                {"id": "col-discovery", "title": "Discovery", "cardIds": []},
                {"id": "col-progress", "title": "In Progress", "cardIds": []},
                {"id": "col-review", "title": "Review", "cardIds": []},
                {"id": "col-done", "title": "Done", "cardIds": []},
            ],
            "cards": {},
        },
    )

    assert response.status_code == 422
    assert "Card references are inconsistent" in response.json()["detail"]


def test_chat_rejects_oversized_message(client: TestClient) -> None:
    response = client.post("/api/chat", json={"message": "x" * 2001})
    assert response.status_code == 422
