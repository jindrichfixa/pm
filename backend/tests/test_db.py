import tempfile
from pathlib import Path

from db import (
    DEFAULT_BOARD,
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
    get_user_by_username,
    hash_password,
    initialize_database,
    list_boards_for_user,
    update_board_data,
    update_board_meta,
    verify_password,
)


def test_hash_password_is_not_deterministic() -> None:
    h1 = hash_password("password")
    h2 = hash_password("password")
    # bcrypt produces different hashes each time (different salt)
    assert h1 != h2


def test_verify_password_works() -> None:
    h = hash_password("password")
    assert verify_password("password", h) is True
    assert verify_password("wrong", h) is False


def test_initialize_database_creates_default_user_and_board() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        assert user is not None
        assert user["username"] == "user"

        boards = list_boards_for_user(db_path, user["id"])
        assert len(boards) == 1
        assert boards[0]["name"] == "My First Board"

        result = get_board(db_path, boards[0]["id"], user["id"])
        assert result is not None
        board_data, version, name, desc = result
        assert board_data["columns"] == DEFAULT_BOARD["columns"]
        assert version == 1


def test_create_user_and_authenticate() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user_id = create_user(db_path, "alice", "secret123", "Alice")
        assert user_id is not None

        user = authenticate_user(db_path, "alice", "secret123")
        assert user is not None
        assert user["username"] == "alice"
        assert user["display_name"] == "Alice"

        wrong = authenticate_user(db_path, "alice", "wrong")
        assert wrong is None


def test_create_duplicate_user_returns_none() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        # "user" already exists from seed
        result = create_user(db_path, "user", "another")
        assert result is None


def test_get_user_by_id() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        assert user is not None

        same_user = get_user_by_id(db_path, user["id"])
        assert same_user is not None
        assert same_user["username"] == "user"

        missing = get_user_by_id(db_path, 9999)
        assert missing is None


def test_create_board_and_list() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        assert user is not None

        board_id = create_board(db_path, user["id"], "Project Alpha", "First project")
        assert board_id is not None

        boards = list_boards_for_user(db_path, user["id"])
        assert len(boards) == 2  # default + new
        names = [b["name"] for b in boards]
        assert "Project Alpha" in names


def test_update_board_data() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        boards = list_boards_for_user(db_path, user["id"])
        board_id = boards[0]["id"]

        updated_board = {
            "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["card-1"]}],
            "cards": {"card-1": {"id": "card-1", "title": "Task", "details": "Do it"}},
        }

        result = update_board_data(db_path, board_id, user["id"], updated_board)
        assert result is True

        saved = get_board(db_path, board_id, user["id"])
        assert saved is not None
        board_data, version, _name, _desc = saved
        assert board_data == updated_board
        assert version == 2


def test_update_board_with_expected_version_succeeds() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        boards = list_boards_for_user(db_path, user["id"])
        board_id = boards[0]["id"]

        board_data = {"columns": [], "cards": {}}

        assert update_board_data(db_path, board_id, user["id"], board_data) is True
        assert update_board_data(db_path, board_id, user["id"], board_data, expected_version=2) is True

        result = get_board(db_path, board_id, user["id"])
        assert result is not None
        _, version, _, _ = result
        assert version == 3


def test_update_board_with_wrong_expected_version_fails() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        boards = list_boards_for_user(db_path, user["id"])
        board_id = boards[0]["id"]

        assert update_board_data(db_path, board_id, user["id"], {}, expected_version=999) is False


def test_update_board_meta() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        boards = list_boards_for_user(db_path, user["id"])
        board_id = boards[0]["id"]

        result = update_board_meta(db_path, board_id, user["id"], "Renamed Board", "New desc")
        assert result is True

        saved = get_board(db_path, board_id, user["id"])
        assert saved is not None
        _, _, name, desc = saved
        assert name == "Renamed Board"
        assert desc == "New desc"


def test_delete_board() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        board_id = create_board(db_path, user["id"], "Temp", "To delete")
        assert board_id is not None

        result = delete_board(db_path, board_id, user["id"])
        assert result is True

        saved = get_board(db_path, board_id, user["id"])
        assert saved is None


def test_delete_nonexistent_board_returns_false() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        result = delete_board(db_path, 9999, user["id"])
        assert result is False


def test_board_isolation_between_users() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        alice_id = create_user(db_path, "alice", "pass", "Alice")
        assert alice_id is not None
        create_board(db_path, alice_id, "Alice Board")

        user = get_user_by_username(db_path, "user")
        alice_boards = list_boards_for_user(db_path, alice_id)
        user_boards = list_boards_for_user(db_path, user["id"])

        assert len(alice_boards) == 1
        assert alice_boards[0]["name"] == "Alice Board"

        # user cannot access alice's board
        result = get_board(db_path, alice_boards[0]["id"], user["id"])
        assert result is None


def test_chat_messages_per_board() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        boards = list_boards_for_user(db_path, user["id"])
        board_id = boards[0]["id"]

        added = append_chat_message(db_path, board_id, user["id"], "user", "hello")
        assert added is True
        added = append_chat_message(db_path, board_id, user["id"], "assistant", "hi there")
        assert added is True

        history = get_chat_messages(db_path, board_id)
        assert history == [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi there"},
        ]


def test_chat_message_on_nonexistent_board_returns_false() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        result = append_chat_message(db_path, 9999, user["id"], "user", "hello")
        assert result is False


def test_authenticate_nonexistent_user_returns_none() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        result = authenticate_user(db_path, "nobody", "password")
        assert result is None


def test_card_comments_crud() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        boards = list_boards_for_user(db_path, user["id"])
        board_id = boards[0]["id"]

        # Add comment
        comment = add_card_comment(db_path, board_id, "card-1", user["id"], "Looks good")
        assert comment is not None
        assert comment["content"] == "Looks good"
        assert comment["card_id"] == "card-1"
        assert comment["username"] == "user"

        # Get comments
        comments = get_card_comments(db_path, board_id, "card-1")
        assert len(comments) == 1
        assert comments[0]["content"] == "Looks good"

        # Delete comment
        deleted = delete_card_comment(db_path, comment["id"], user["id"])
        assert deleted is True

        # Verify gone
        comments = get_card_comments(db_path, board_id, "card-1")
        assert len(comments) == 0


def test_card_comment_on_nonexistent_board_returns_none() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        user = get_user_by_username(db_path, "user")
        result = add_card_comment(db_path, 9999, "card-1", user["id"], "nope")
        assert result is None
