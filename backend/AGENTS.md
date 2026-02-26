# Backend Agent Notes

This directory contains the FastAPI backend scaffold for the Project Management MVP.

## Current backend scope (Part 2)

- `main.py` defines a small FastAPI app with:
	- `GET /health` returning `{ "status": "ok" }`
	- `GET /api/hello` returning `{ "message": "hello world" }`
	- static frontend serving at `/` from `backend/static` (exported Next.js build)

## Python project setup

- `pyproject.toml` uses modern Python package metadata.
- Runtime dependencies:
	- `fastapi`
	- `httpx`
	- `uvicorn[standard]`
- Dev dependencies:
	- `pytest`

## Testing

- Backend tests live in `tests/test_main.py`.
- API tests validate `/health`, `/api/hello`, `/api/board` read/write, and payload validation.

## Container/runtime expectations

- Root `Dockerfile` builds and runs backend from this folder.
- Python dependency manager in container is `uv`.
- App runs on port `8000`.

## Current phase status

- Backend MVP phases through Part 10 are implemented.
- Current follow-up work is limited to incremental polish and maintenance; core MVP flow is complete.

## Current backend scope (Part 8)

- OpenRouter connectivity added in `ai.py`:
	- model fixed to `openai/gpt-oss-120b`
	- reads API key from `OPENROUTER_API_KEY`
	- wraps upstream errors in deterministic application errors
- API surface now includes:
	- `POST /api/ai/check` with payload `{ "prompt": "..." }`
	- response shape `{ "assistant_message": "..." }`
	- returns 503 when API key is missing
	- returns 502 for upstream/provider failures

## Current tests

- `tests/test_ai.py` covers request shaping and upstream failure handling
- `tests/test_main.py` covers `/api/ai/check` success and error mapping

## Current backend scope (Part 9)

- AI chat endpoint added:
	- `POST /api/chat` payload `{ "message": "..." }`
	- response `{ "assistant_message": "...", "board_update": ... }`
- Chat prompt now includes:
	- current board JSON
	- user message
	- stored conversation history from `chat_messages`
- Structured output handling:
	- requires `assistant_message` string
	- optional `board_update.board` validated with board schema
	- valid board updates are persisted
	- invalid structured output returns deterministic 502
	- fixed five-column structure is enforced for board persistence and AI updates
	- invalid persisted board payloads are auto-repaired to default structure on `GET /api/board`

## Current tests

- `tests/test_ai.py` covers structured output JSON parsing behavior
- `tests/test_db.py` covers chat message persistence helpers
- `tests/test_main.py` covers `/api/chat` response-only, valid update, invalid output handling, and fixed-column enforcement

## Known current limitation

- Frontend auth remains local-only MVP gate and is not enforced by backend APIs yet.