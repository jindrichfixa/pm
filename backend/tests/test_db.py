import tempfile
from pathlib import Path

from db import (
    DEFAULT_BOARD,
    append_chat_message_for_user,
    get_board_for_user,
    get_chat_messages_for_user,
    hash_password,
    initialize_database,
    update_board_for_user,
)


def test_hash_password_is_deterministic() -> None:
    assert hash_password("password") == hash_password("password")
    assert hash_password("password") != hash_password("other")


def test_initialize_database_creates_default_user_and_board() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"

        initialize_database(db_path)
        result = get_board_for_user(db_path, "user")

        assert result is not None
        board, version = result
        assert board["columns"] == DEFAULT_BOARD["columns"]
        assert version == 1


def test_update_board_for_user_persists_data() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        updated_board = {
            "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["card-1"]}],
            "cards": {
                "card-1": {"id": "card-1", "title": "Task", "details": "Do it"}
            },
        }

        result = update_board_for_user(db_path, "user", updated_board)
        saved_result = get_board_for_user(db_path, "user")

        assert result is True
        assert saved_result is not None
        saved_board, version = saved_result
        assert saved_board == updated_board
        assert version == 2


def test_update_board_for_unknown_user_returns_false() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        result = update_board_for_user(db_path, "missing", {"columns": [], "cards": {}})
        assert result is False


def test_update_board_with_expected_version_succeeds() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        board_data = {"columns": [], "cards": {}}

        # First update bumps version from 1 to 2
        assert update_board_for_user(db_path, "user", board_data) is True

        # Update with correct expected_version succeeds
        assert update_board_for_user(db_path, "user", board_data, expected_version=2) is True

        # Version is now 3
        result = get_board_for_user(db_path, "user")
        assert result is not None
        _, version = result
        assert version == 3


def test_update_board_with_wrong_expected_version_fails() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        board_data = {"columns": [], "cards": {}}

        # Try to update with wrong version
        assert update_board_for_user(db_path, "user", board_data, expected_version=999) is False


def test_chat_messages_roundtrip_for_user() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        added_user = append_chat_message_for_user(db_path, "user", "user", "hello")
        added_assistant = append_chat_message_for_user(
            db_path, "user", "assistant", "hi there"
        )
        history = get_chat_messages_for_user(db_path, "user")

        assert added_user is True
        assert added_assistant is True
        assert history == [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi there"},
        ]


def test_append_chat_message_unknown_user_returns_false() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "app.db"
        initialize_database(db_path)

        result = append_chat_message_for_user(db_path, "missing", "user", "hello")

        assert result is False
