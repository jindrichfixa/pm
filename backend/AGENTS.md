# Backend Agent Notes

This directory contains the FastAPI backend for the Project Management app.

## Architecture

- `main.py` -- FastAPI app with all route handlers, Pydantic request/response models, JWT auth middleware
- `db.py` -- SQLite helpers, schema initialization, CRUD for users/boards/chat/comments, `DEFAULT_BOARD` template
- `auth.py` -- JWT token creation and verification (PyJWT + bcrypt password hashing)
- `ai.py` -- OpenRouter client, structured output parsing for board updates

## Authentication

- JWT-based auth using HS256 with `PM_JWT_SECRET` env var
- Passwords hashed with bcrypt
- Endpoints:
	- `POST /api/auth/register` -- create account, returns JWT + user object
	- `POST /api/auth/login` -- authenticate, returns JWT + user object
	- `GET /api/auth/me` -- get current user (requires Bearer token)
	- `PATCH /api/auth/profile` -- update display name
	- `POST /api/auth/change-password` -- change password
- All `/api/boards/*` and chat endpoints require `Authorization: Bearer <token>` header
- Demo credentials: `user` / `password` (seeded on first startup)

## Board APIs

- `GET /api/boards` -- list user's boards
- `POST /api/boards` -- create new board
- `GET /api/boards/:id` -- get board with full data
- `PUT /api/boards/:id` -- update board data (validates structure)
- `PATCH /api/boards/:id/meta` -- update board name/description
- `DELETE /api/boards/:id` -- delete board

Board validation rules:
- At least one column required, maximum 20 columns
- Column IDs must be unique within a board
- Card references must be consistent (no orphans)
- Pydantic models enforce size limits on all string fields and list sizes
- Default boards start with five columns: Backlog, Discovery, In Progress, Review, Done

Custom columns are fully supported (add, rename, delete via board update).

## Card Comments

- `GET /api/boards/:id/cards/:cardId/comments` -- list comments
- `POST /api/boards/:id/cards/:cardId/comments` -- add comment
- `DELETE /api/boards/:id/cards/:cardId/comments/:commentId` -- delete comment

## AI Integration

- Uses OpenRouter with model `openai/gpt-oss-120b`
- `POST /api/boards/:id/chat` -- AI chat with board context
- `POST /api/ai/check` -- simple connectivity check
- AI receives current board JSON + user message + conversation history
- Structured output: `assistant_message` (required) + optional `board_update`
- Valid board updates are persisted; invalid updates are rejected with 502
- Returns 503 when API key is missing, 502 for upstream failures

## Legacy Endpoints

These support the original single-board API contract:
- `GET /api/board` -- get first board
- `PUT /api/board` -- update first board
- `POST /api/chat` -- AI chat on first board

## Database

- SQLite at `backend/data/app.db` (auto-created on startup)
- Override path with `PM_DB_PATH` env var
- Schema initialized automatically on first run
- Tables: `users`, `boards`, `chat_messages`, `card_comments`

## Testing

- Tests in `tests/` directory
- `test_main.py` -- API endpoint tests
- `test_db.py` -- database layer tests
- `test_ai.py` -- AI client and structured output parsing tests
- Run: `uv run pytest`

## Runtime

- Python 3.13, managed with `uv`
- Serves static frontend from `backend/static/` (copied from Next.js build)
- Runs on port 8000
- CORS configurable via `PM_CORS_ORIGINS`
