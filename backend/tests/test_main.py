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


def _auth_headers(client: TestClient) -> dict[str, str]:
    """Register/login and return Authorization header."""
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    if response.status_code == 200:
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}

    # Fallback: register
    response = client.post(
        "/api/auth/register",
        json={"username": "user", "password": "password", "display_name": "Demo User"},
    )
    assert response.status_code in (200, 201, 409)
    if response.status_code == 409:
        response = client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


# --- Health ---

def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# --- Auth endpoints ---

def test_register_new_user(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"username": "newuser", "password": "pass1234", "display_name": "New User"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "token" in body
    assert body["user"]["username"] == "newuser"
    assert body["user"]["display_name"] == "New User"


def test_register_duplicate_returns_409(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"username": "dupuser", "password": "pass1234"},
    )
    response = client.post(
        "/api/auth/register",
        json={"username": "dupuser", "password": "pass1234"},
    )
    assert response.status_code == 409


def test_login_success(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "token" in body
    assert body["user"]["username"] == "user"


def test_login_wrong_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "wrong"},
    )
    assert response.status_code == 401


def test_get_me_requires_auth(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_get_me_with_valid_token(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == "user"


# --- Board CRUD ---

def test_list_boards(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.get("/api/boards", headers=headers)
    assert response.status_code == 200
    boards = response.json()
    assert isinstance(boards, list)
    assert len(boards) >= 1


def test_create_board(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.post(
        "/api/boards",
        json={"name": "Test Board", "description": "A test"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Test Board"
    assert "id" in body


def test_get_board_by_id(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    response = client.get(f"/api/boards/{board_id}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert "board" in body
    assert isinstance(body["board"]["columns"], list)


def test_update_board_data(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

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

    response = client.put(f"/api/boards/{board_id}", json=payload, headers=headers)
    assert response.status_code == 200

    get_resp = client.get(f"/api/boards/{board_id}", headers=headers)
    board = get_resp.json()["board"]
    assert board["columns"] == payload["columns"]
    assert board["cards"]["card-1"]["title"] == "Task"
    assert board["cards"]["card-1"]["details"] == "Do it"


def test_update_board_meta(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    response = client.patch(
        f"/api/boards/{board_id}/meta",
        json={"name": "Renamed", "description": "Updated"},
        headers=headers,
    )
    assert response.status_code == 200

    get_resp = client.get(f"/api/boards/{board_id}", headers=headers)
    assert get_resp.json()["name"] == "Renamed"


def test_delete_board(client: TestClient) -> None:
    headers = _auth_headers(client)
    create_resp = client.post(
        "/api/boards",
        json={"name": "To Delete"},
        headers=headers,
    )
    board_id = create_resp.json()["id"]

    response = client.delete(f"/api/boards/{board_id}", headers=headers)
    assert response.status_code == 200

    get_resp = client.get(f"/api/boards/{board_id}", headers=headers)
    assert get_resp.status_code == 404


def test_board_requires_auth(client: TestClient) -> None:
    response = client.get("/api/boards")
    assert response.status_code == 401


def test_put_board_rejects_invalid_columns(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    response = client.put(
        f"/api/boards/{board_id}",
        json={
            "columns": [{"id": "col-1", "title": "Only", "cardIds": []}],
            "cards": {},
        },
        headers=headers,
    )
    assert response.status_code == 422


def test_put_board_rejects_inconsistent_card_refs(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    response = client.put(
        f"/api/boards/{board_id}",
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
        headers=headers,
    )
    assert response.status_code == 422
    assert "Card references are inconsistent" in response.json()["detail"]


def test_put_board_rejects_oversized_title(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    response = client.put(
        f"/api/boards/{board_id}",
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
        headers=headers,
    )
    assert response.status_code == 422


# --- Legacy board endpoints ---

def test_legacy_get_board(client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.get("/api/board", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload.get("columns"), list)


def test_legacy_put_board(client: TestClient) -> None:
    headers = _auth_headers(client)
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

    response = client.put("/api/board", json=payload, headers=headers)
    assert response.status_code == 200


# --- AI endpoints ---

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


def test_ai_check_upstream_error_maps_to_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _raise(prompt: str) -> str:
        raise OpenRouterUpstreamError("Failed to reach OpenRouter.")

    monkeypatch.setattr("main.request_openrouter_completion", _raise)

    response = client.post("/api/ai/check", json={"prompt": "hello"})
    assert response.status_code == 502


# --- Chat on board ---

def test_chat_on_board_response_only(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    async def _mock(board, user_message, conversation_history):
        return {"assistant_message": "No changes needed"}

    monkeypatch.setattr("main.request_openrouter_structured_output", _mock)

    response = client.post(
        f"/api/boards/{board_id}/chat",
        json={"message": "summarize"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["assistant_message"] == "No changes needed"
    assert response.json()["board_update"] is None


def test_chat_on_board_with_update(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    new_board = {
        "columns": [
            {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
            {"id": "col-discovery", "title": "Discovery", "cardIds": []},
            {"id": "col-progress", "title": "In Progress", "cardIds": []},
            {"id": "col-review", "title": "Review", "cardIds": []},
            {"id": "col-done", "title": "Done", "cardIds": []},
        ],
        "cards": {
            "card-1": {"id": "card-1", "title": "AI Task", "details": "Created by AI"}
        },
    }

    async def _mock(board, user_message, conversation_history):
        return {
            "assistant_message": "Updated board",
            "board_update": {"board": new_board},
        }

    monkeypatch.setattr("main.request_openrouter_structured_output", _mock)

    response = client.post(
        f"/api/boards/{board_id}/chat",
        json={"message": "update board"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["assistant_message"] == "Updated board"
    assert response.json()["board_update"] is not None


def test_chat_on_board_requires_auth(client: TestClient) -> None:
    response = client.post("/api/boards/1/chat", json={"message": "hello"})
    assert response.status_code == 401


def test_chat_rejects_oversized_message(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    response = client.post(
        f"/api/boards/{board_id}/chat",
        json={"message": "x" * 2001},
        headers=headers,
    )
    assert response.status_code == 422


# --- Legacy chat ---

def test_legacy_chat_response_only(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    headers = _auth_headers(client)

    async def _mock(board, user_message, conversation_history):
        return {"assistant_message": "No changes needed"}

    monkeypatch.setattr("main.request_openrouter_structured_output", _mock)

    response = client.post(
        "/api/chat",
        json={"message": "summarize"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["assistant_message"] == "No changes needed"


# --- Card with enhanced fields ---

def test_card_with_priority_and_due_date(client: TestClient) -> None:
    headers = _auth_headers(client)
    boards = client.get("/api/boards", headers=headers).json()
    board_id = boards[0]["id"]

    payload = {
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
                "title": "Task with priority",
                "details": "Has due date",
                "priority": "high",
                "due_date": "2026-03-15",
                "labels": ["frontend", "urgent"],
            }
        },
    }

    response = client.put(f"/api/boards/{board_id}", json=payload, headers=headers)
    assert response.status_code == 200

    get_resp = client.get(f"/api/boards/{board_id}", headers=headers)
    card = get_resp.json()["board"]["cards"]["card-1"]
    assert card["priority"] == "high"
    assert card["due_date"] == "2026-03-15"
    assert card["labels"] == ["frontend", "urgent"]


# --- User isolation ---

def test_user_cannot_access_other_users_board(client: TestClient) -> None:
    # Register two users
    resp1 = client.post(
        "/api/auth/register",
        json={"username": "user_a", "password": "pass1234"},
    )
    token_a = resp1.json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    resp2 = client.post(
        "/api/auth/register",
        json={"username": "user_b", "password": "pass1234"},
    )
    token_b = resp2.json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Get user A's board
    boards_a = client.get("/api/boards", headers=headers_a).json()
    board_id_a = boards_a[0]["id"]

    # User B tries to access user A's board
    response = client.get(f"/api/boards/{board_id_a}", headers=headers_b)
    assert response.status_code == 404
