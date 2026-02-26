# Database Design (Part 5)

This document proposes the MVP SQLite schema and persistence approach for the Kanban app.

## Goals

- Keep schema minimal for MVP.
- Support current requirements:
  - dummy login user (`user` / `password`)
  - one board per signed-in user
  - board persisted as JSON
- Leave room for later multi-user and AI chat history expansion.

## SQLite file

- DB file path (proposed): `backend/data/app.db`
- If the file or parent directory does not exist, backend creates both at startup.

## Proposed schema

### 1) `users`

Stores app users. For MVP, backend will seed a single user row for `user` if missing.

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Notes:
- Even with dummy credentials, schema stores `password_hash` to avoid plain text and keep future path clean.
- `username` unique supports future multi-user.

### 2) `boards`

Stores one board JSON document per user.

```sql
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Notes:
- `UNIQUE(user_id)` enforces MVP rule: one board per user.
- `board_json` contains serialized board structure currently used by frontend (`columns` + `cards`).

### 3) `chat_messages` (optional now, ready for AI phases)

Stores conversation history per user for AI context.

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Notes:
- This table can be created now or deferred until Part 8/9.
- Keeps AI context persistence simple and append-only.

## Initialization strategy

On backend startup:

1. Ensure `backend/data/` exists.
2. Open SQLite connection to `backend/data/app.db`.
3. Execute `CREATE TABLE IF NOT EXISTS` for required tables.
4. Seed default MVP user if not present:
   - username: `user`
   - password_hash: hash of `password`
5. Seed default board row for that user if missing using initial Kanban JSON.

## Rationale and tradeoffs

### Why JSON board storage for MVP

Pros:
- Fastest path to persistent behavior matching existing frontend state model.
- Minimal schema complexity while requirements are still evolving.
- Easy to pass complete board payloads to AI in future parts.

Cons:
- Harder to query card-level analytics in SQL.
- Whole-document updates replace full JSON blob.

Decision:
- Accept tradeoff for MVP simplicity.
- If product scope grows, migrate to normalized board/column/card tables later.

### Why keep `users` table now

Pros:
- Aligns with future multi-user intent.
- Avoids future rework in API contract and DB migration.

Cons:
- Slight upfront schema overhead.

Decision:
- Keep minimal `users` table with one seeded user for MVP.

## API contract impact (for Part 6)

- `GET /api/board` -> returns board JSON for authenticated user.
- `PUT /api/board` -> validates and stores updated board JSON.
- (Later) `POST /api/chat` -> appends user message, calls LLM, appends assistant message.

## Implementation status

- Part 6 implementation is complete.
- Backend currently defaults API board operations to username `user` (MVP simplification).
- Part 7 frontend wiring is complete: board loads/saves through `/api/board` and persists across refresh.
- Part 9 implementation is complete: backend AI chat uses structured outputs and persists valid board updates.
- Backend now enforces fixed five-column board structure for `/api/board` and `/api/chat` updates.
- If legacy/invalid persisted board JSON is detected, backend auto-repairs to default board on read.

## Migration/versioning approach

For MVP, use lightweight SQL versioning with `PRAGMA user_version`:

- `user_version = 1`: users + boards (+ optional chat_messages)

Future migrations can bump version and apply incremental SQL scripts.

## Security note (MVP)

- Dummy credentials are intentionally hardcoded for this phase.
- Store password as hash in DB anyway to avoid normalizing insecure patterns in code.

## Acceptance criteria for Part 5

- Schema supports one-board-per-user constraint.
- DB auto-creates if missing.
- Design is documented and approved before Part 6 implementation.
