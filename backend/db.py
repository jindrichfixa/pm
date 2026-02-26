import copy
import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DEFAULT_DB_PATH = Path(
    os.environ.get("PM_DB_PATH", str(Path(__file__).resolve().parent / "data" / "app.db"))
)

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
    """Return a fresh deep copy of DEFAULT_BOARD to prevent mutation of the global."""
    return copy.deepcopy(DEFAULT_BOARD)


# WARNING: Unsalted SHA-256 is intentionally weak for MVP. Must be replaced with
# bcrypt/argon2 before any production or multi-user deployment.
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@contextmanager
def get_connection(db_path: Path) -> Iterator[sqlite3.Connection]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
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
              user_id INTEGER NOT NULL UNIQUE,
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
              user_id INTEGER NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
              content TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
            ON chat_messages (user_id, id)
            """
        )

        # Migrate: add version column if missing (existing databases)
        columns = [
            row[1]
            for row in connection.execute("PRAGMA table_info(boards)").fetchall()
        ]
        if "version" not in columns:
            connection.execute(
                "ALTER TABLE boards ADD COLUMN version INTEGER NOT NULL DEFAULT 1"
            )

        connection.execute(
            """
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
            ON CONFLICT(username) DO NOTHING
            """,
            ("user", hash_password("password")),
        )

        user_row = connection.execute(
            "SELECT id FROM users WHERE username = ?", ("user",)
        ).fetchone()
        if user_row is None:
            raise RuntimeError("Failed to seed default user.")

        connection.execute(
            """
            INSERT INTO boards (user_id, board_json)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO NOTHING
            """,
            (user_row["id"], json.dumps(DEFAULT_BOARD)),
        )


def get_board_for_user(
    db_path: Path, username: str
) -> tuple[dict[str, Any], int] | None:
    with get_connection(db_path) as connection:
        row = connection.execute(
            """
            SELECT b.board_json, b.version
            FROM boards b
            INNER JOIN users u ON u.id = b.user_id
            WHERE u.username = ?
            """,
            (username,),
        ).fetchone()

    if row is None:
        return None

    return json.loads(row["board_json"]), row["version"]


def update_board_for_user(
    db_path: Path,
    username: str,
    board: dict[str, Any],
    expected_version: int | None = None,
) -> bool:
    with get_connection(db_path) as connection:
        user = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user is None:
            return False

        board_json = json.dumps(board)

        if expected_version is not None:
            result = connection.execute(
                """
                UPDATE boards
                SET board_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND version = ?
                """,
                (board_json, user["id"], expected_version),
            )
            if result.rowcount == 0:
                return False
        else:
            connection.execute(
                """
                INSERT INTO boards (user_id, board_json)
                VALUES (?, ?)
                ON CONFLICT(user_id)
                DO UPDATE SET board_json = excluded.board_json,
                             version = boards.version + 1,
                             updated_at = CURRENT_TIMESTAMP
                """,
                (user["id"], board_json),
            )

    return True


def get_chat_messages_for_user(
    db_path: Path, username: str, limit: int = 20
) -> list[dict[str, str]]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT cm.role, cm.content
            FROM chat_messages cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE u.username = ?
            ORDER BY cm.id DESC
            LIMIT ?
            """,
            (username, limit),
        ).fetchall()

    messages = [{"role": row["role"], "content": row["content"]} for row in rows]
    messages.reverse()
    return messages


_MAX_CHAT_MESSAGES = 100


def append_chat_message_for_user(
    db_path: Path, username: str, role: str, content: str
) -> bool:
    with get_connection(db_path) as connection:
        user = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user is None:
            return False

        connection.execute(
            """
            INSERT INTO chat_messages (user_id, role, content)
            VALUES (?, ?, ?)
            """,
            (user["id"], role, content),
        )

        # Prune old messages beyond the limit
        connection.execute(
            """
            DELETE FROM chat_messages
            WHERE user_id = ? AND id NOT IN (
                SELECT id FROM chat_messages
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT ?
            )
            """,
            (user["id"], user["id"], _MAX_CHAT_MESSAGES),
        )

    return True
