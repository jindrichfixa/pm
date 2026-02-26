# Database Design

This document describes the SQLite schema and persistence approach for the Project Management application.

## Goals

- Support multi-user authentication with bcrypt password hashing
- Support multiple boards per user
- Board persisted as JSON with card-level metadata (priority, due dates, labels)
- Chat history per board for AI context

## SQLite file

- DB file path: `backend/data/app.db` (overridable via `PM_DB_PATH`)
- If the file or parent directory does not exist, backend creates both at startup.

## Schema

### 1) `users`

Stores registered users. Backend seeds a demo user (`user` / `password`) on first startup.

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Notes:
- Passwords hashed with bcrypt (not SHA-256).
- `display_name` for UI display, defaults to empty string.
- `username` unique constraint prevents duplicates.

### 2) `boards`

Stores board JSON documents. Multiple boards per user.

```sql
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
);
```

Notes:
- No UNIQUE on `user_id` -- allows multiple boards per user.
- `name` and `description` provide board-level metadata.
- `board_json` contains serialized board structure (`columns` + `cards`).
- `version` column enables optimistic concurrency control for AI updates.
- Index on `user_id` for efficient board listing.

### 3) `chat_messages`

Stores conversation history per board for AI context.

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Notes:
- Messages scoped to board (not user), so each board has its own conversation.
- Auto-prunes to 100 messages per board.
- Index on `(board_id, id)` for efficient retrieval.

### 4) `card_comments`

Stores comments on individual cards within a board.

```sql
CREATE TABLE IF NOT EXISTS card_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  card_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Notes:
- Comments scoped to board + card_id.
- Cascade deletes when board is removed.
- Index on `(board_id, card_id, id)` for efficient retrieval.
- Max 2000 characters per comment.

## Card data model

Cards stored in `board_json` with these fields:

```json
{
  "id": "card-xxx",
  "title": "Card title",
  "details": "Card description",
  "priority": "high",
  "due_date": "2026-03-15",
  "labels": ["frontend", "urgent"]
}
```

- `priority`: optional, one of `low`, `medium`, `high`, `critical`
- `due_date`: optional, ISO date string
- `labels`: optional, list of strings (max 10)

## Initialization strategy

On backend startup:

1. Ensure `backend/data/` exists.
2. Open SQLite connection with foreign keys enabled.
3. Execute `CREATE TABLE IF NOT EXISTS` for all tables.
4. Create indexes.
5. Seed demo user if not present (username: `user`, password: `password`).
6. Create default board for demo user if no boards exist.

## API contract

### Auth & Profile
- `POST /api/auth/register` -> creates user, returns JWT + user
- `POST /api/auth/login` -> authenticates, returns JWT + user
- `GET /api/auth/me` -> returns current user info
- `PATCH /api/auth/profile` -> update display name
- `POST /api/auth/change-password` -> change password (requires current password)

### Board CRUD
- `GET /api/boards` -> list user's boards (metadata only)
- `POST /api/boards` -> create board with name/description
- `GET /api/boards/:id` -> get board with full data
- `PUT /api/boards/:id` -> update board data (validates: at least 1 column, unique IDs, consistent card refs)
- `PATCH /api/boards/:id/meta` -> update name/description
- `DELETE /api/boards/:id` -> delete board and its chat messages

### Card comments
- `GET /api/boards/:id/cards/:cardId/comments` -> list comments for a card
- `POST /api/boards/:id/cards/:cardId/comments` -> add a comment (max 2000 chars)
- `DELETE /api/boards/:id/cards/:cardId/comments/:commentId` -> delete own comment

### Board data + Chat
- `POST /api/boards/:id/chat` -> AI chat with board context

### Legacy (backward compat)
- `GET /api/board`, `PUT /api/board`, `POST /api/chat` -- operate on user's first board

## User isolation

- All board/chat queries filter by `user_id` from JWT token.
- Users cannot access, modify, or delete other users' boards.

## Security

- Passwords hashed with bcrypt (salt auto-generated).
- JWT tokens signed with HS256 using `PM_JWT_SECRET` env var.
- Token expiry: 24 hours.
- All API endpoints except health and auth require valid JWT.
