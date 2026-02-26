import copy
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import bcrypt

DEFAULT_DB_PATH = Path(
    os.environ.get("PM_DB_PATH", str(Path(__file__).resolve().parent / "data" / "app.db"))
)

FIXED_COLUMN_IDS = ["col-backlog", "col-discovery", "col-progress", "col-review", "col-done"]

DEFAULT_BOARD: dict[str, Any] = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


def get_default_board() -> dict[str, Any]:
    return copy.deepcopy(DEFAULT_BOARD)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


@contextmanager
def get_connection(db_path: Path) -> Iterator[sqlite3.Connection]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with get_connection(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL DEFAULT '',
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL DEFAULT 'Untitled Board',
              description TEXT NOT NULL DEFAULT '',
              board_json TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              board_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
              content TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS card_comments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              board_id INTEGER NOT NULL,
              card_id TEXT NOT NULL,
              user_id INTEGER NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_chat_messages_board_id
            ON chat_messages (board_id, id)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_card_comments_board_card
            ON card_comments (board_id, card_id, id)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_boards_user_id
            ON boards (user_id)
            """
        )

        # Seed demo user if not exists
        existing = connection.execute(
            "SELECT id FROM users WHERE username = ?", ("user",)
        ).fetchone()
        if existing is None:
            pw_hash = hash_password("password")
            connection.execute(
                "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
                ("user", "Demo User", pw_hash),
            )
            user_row = connection.execute(
                "SELECT id FROM users WHERE username = ?", ("user",)
            ).fetchone()
            connection.execute(
                "INSERT INTO boards (user_id, name, description, board_json) VALUES (?, ?, ?, ?)",
                (user_row["id"], "My First Board", "Default project board", json.dumps(DEFAULT_BOARD)),
            )


# --- User management ---

def create_user(db_path: Path, username: str, password: str, display_name: str = "") -> int | None:
    pw_hash = hash_password(password)
    with get_connection(db_path) as connection:
        try:
            connection.execute(
                "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
                (username, display_name, pw_hash),
            )
            row = connection.execute(
                "SELECT id FROM users WHERE username = ?", (username,)
            ).fetchone()
            return row["id"] if row else None
        except sqlite3.IntegrityError:
            return None


def authenticate_user(db_path: Path, username: str, password: str) -> dict[str, Any] | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT id, username, display_name, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if row is None:
        return None

    if not verify_password(password, row["password_hash"]):
        return None

    return {"id": row["id"], "username": row["username"], "display_name": row["display_name"]}


def get_user_by_id(db_path: Path, user_id: int) -> dict[str, Any] | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT id, username, display_name FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    if row is None:
        return None

    return {"id": row["id"], "username": row["username"], "display_name": row["display_name"]}


def update_user_display_name(db_path: Path, user_id: int, display_name: str) -> bool:
    with get_connection(db_path) as connection:
        result = connection.execute(
            "UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (display_name, user_id),
        )
        return result.rowcount > 0


def update_user_password(db_path: Path, user_id: int, current_password: str, new_password: str) -> bool:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if row is None:
            return False

        if not verify_password(current_password, row["password_hash"]):
            return False

        new_hash = hash_password(new_password)
        connection.execute(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_hash, user_id),
        )
        return True


def get_user_by_username(db_path: Path, username: str) -> dict[str, Any] | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT id, username, display_name FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if row is None:
        return None

    return {"id": row["id"], "username": row["username"], "display_name": row["display_name"]}


# --- Board management ---

def create_board(
    db_path: Path,
    user_id: int,
    name: str,
    description: str = "",
    board_data: dict[str, Any] | None = None,
) -> int:
    if board_data is None:
        board_data = get_default_board()

    with get_connection(db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO boards (user_id, name, description, board_json) VALUES (?, ?, ?, ?)",
            (user_id, name, description, json.dumps(board_data)),
        )
        return cursor.lastrowid  # type: ignore[return-value]


def list_boards_for_user(db_path: Path, user_id: int) -> list[dict[str, Any]]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT id, name, description, version, created_at, updated_at
            FROM boards
            WHERE user_id = ?
            ORDER BY updated_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "version": row["version"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def get_board(db_path: Path, board_id: int, user_id: int) -> tuple[dict[str, Any], int, str, str] | None:
    """Returns (board_data, version, name, description) or None."""
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT board_json, version, name, description FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()

    if row is None:
        return None

    return json.loads(row["board_json"]), row["version"], row["name"], row["description"]


def update_board_data(
    db_path: Path,
    board_id: int,
    user_id: int,
    board: dict[str, Any],
    expected_version: int | None = None,
) -> bool:
    with get_connection(db_path) as connection:
        board_json = json.dumps(board)

        if expected_version is not None:
            result = connection.execute(
                """
                UPDATE boards
                SET board_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ? AND version = ?
                """,
                (board_json, board_id, user_id, expected_version),
            )
            return result.rowcount > 0
        else:
            result = connection.execute(
                """
                UPDATE boards
                SET board_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                (board_json, board_id, user_id),
            )
            return result.rowcount > 0


def update_board_meta(db_path: Path, board_id: int, user_id: int, name: str, description: str) -> bool:
    with get_connection(db_path) as connection:
        result = connection.execute(
            """
            UPDATE boards
            SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            """,
            (name, description, board_id, user_id),
        )
        return result.rowcount > 0


def delete_board(db_path: Path, board_id: int, user_id: int) -> bool:
    with get_connection(db_path) as connection:
        result = connection.execute(
            "DELETE FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        )
        return result.rowcount > 0


# --- Chat messages (per board) ---

def get_chat_messages(db_path: Path, board_id: int, limit: int = 20) -> list[dict[str, str]]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT role, content
            FROM chat_messages
            WHERE board_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (board_id, limit),
        ).fetchall()

    messages = [{"role": row["role"], "content": row["content"]} for row in rows]
    messages.reverse()
    return messages


_MAX_CHAT_MESSAGES = 100


def append_chat_message(db_path: Path, board_id: int, user_id: int, role: str, content: str) -> bool:
    with get_connection(db_path) as connection:
        # Verify the board exists and belongs to user
        board = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if board is None:
            return False

        connection.execute(
            "INSERT INTO chat_messages (board_id, user_id, role, content) VALUES (?, ?, ?, ?)",
            (board_id, user_id, role, content),
        )

        # Prune old messages beyond the limit
        connection.execute(
            """
            DELETE FROM chat_messages
            WHERE board_id = ? AND id NOT IN (
                SELECT id FROM chat_messages
                WHERE board_id = ?
                ORDER BY id DESC
                LIMIT ?
            )
            """,
            (board_id, board_id, _MAX_CHAT_MESSAGES),
        )

    return True


# --- Card comments ---

def get_card_comments(
    db_path: Path, board_id: int, card_id: str, limit: int = 50
) -> list[dict[str, Any]]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT cc.id, cc.card_id, cc.content, cc.created_at,
                   u.username, u.display_name
            FROM card_comments cc
            JOIN users u ON cc.user_id = u.id
            WHERE cc.board_id = ? AND cc.card_id = ?
            ORDER BY cc.id DESC
            LIMIT ?
            """,
            (board_id, card_id, limit),
        ).fetchall()

    comments = [
        {
            "id": row["id"],
            "card_id": row["card_id"],
            "content": row["content"],
            "created_at": row["created_at"],
            "username": row["username"],
            "display_name": row["display_name"],
        }
        for row in rows
    ]
    comments.reverse()
    return comments


def add_card_comment(
    db_path: Path, board_id: int, card_id: str, user_id: int, content: str
) -> dict[str, Any] | None:
    with get_connection(db_path) as connection:
        # Verify the board exists and belongs to user
        board = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if board is None:
            return None

        cursor = connection.execute(
            "INSERT INTO card_comments (board_id, card_id, user_id, content) VALUES (?, ?, ?, ?)",
            (board_id, card_id, user_id, content),
        )
        comment_id = cursor.lastrowid

        user = connection.execute(
            "SELECT username, display_name FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        return {
            "id": comment_id,
            "card_id": card_id,
            "content": content,
            "created_at": connection.execute(
                "SELECT created_at FROM card_comments WHERE id = ?",
                (comment_id,),
            ).fetchone()["created_at"],
            "username": user["username"] if user else "",
            "display_name": user["display_name"] if user else "",
        }


def delete_card_comment(db_path: Path, comment_id: int, user_id: int) -> bool:
    with get_connection(db_path) as connection:
        result = connection.execute(
            "DELETE FROM card_comments WHERE id = ? AND user_id = ?",
            (comment_id, user_id),
        )
        return result.rowcount > 0


# --- Backward-compatible aliases for the MVP single-user path ---

def get_board_for_user(db_path: Path, username: str) -> tuple[dict[str, Any], int] | None:
    """Legacy helper: get first board for username."""
    user = get_user_by_username(db_path, username)
    if user is None:
        return None
    boards = list_boards_for_user(db_path, user["id"])
    if not boards:
        return None
    result = get_board(db_path, boards[0]["id"], user["id"])
    if result is None:
        return None
    board_data, version, _name, _desc = result
    return board_data, version


def update_board_for_user(
    db_path: Path,
    username: str,
    board: dict[str, Any],
    expected_version: int | None = None,
) -> bool:
    """Legacy helper: update first board for username."""
    user = get_user_by_username(db_path, username)
    if user is None:
        return False
    boards = list_boards_for_user(db_path, user["id"])
    if not boards:
        return False
    return update_board_data(db_path, boards[0]["id"], user["id"], board, expected_version)


def get_chat_messages_for_user(db_path: Path, username: str, limit: int = 20) -> list[dict[str, str]]:
    """Legacy helper: get chat for first board of username."""
    user = get_user_by_username(db_path, username)
    if user is None:
        return []
    boards = list_boards_for_user(db_path, user["id"])
    if not boards:
        return []
    return get_chat_messages(db_path, boards[0]["id"], limit)


def append_chat_message_for_user(db_path: Path, username: str, role: str, content: str) -> bool:
    """Legacy helper: append chat for first board of username."""
    user = get_user_by_username(db_path, username)
    if user is None:
        return False
    boards = list_boards_for_user(db_path, user["id"])
    if not boards:
        return False
    return append_chat_message(db_path, boards[0]["id"], user["id"], role, content)
