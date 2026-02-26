# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Management MVP: a Kanban board web app with AI chat sidebar. Single-page app with login gate, drag-and-drop card management, and AI-driven board updates via OpenRouter.

## Architecture

**Monorepo with two main directories:**

- `frontend/` -- Next.js 16 (App Router, TypeScript, React 19, Tailwind v4, `@dnd-kit` for drag-and-drop). Exports as static site (`output: "export"` in next.config.ts).
- `backend/` -- Python 3.13 FastAPI. Serves the exported frontend from `backend/static/`. SQLite database at `backend/data/app.db` (auto-created on startup). AI calls go through OpenRouter (`ai.py`).

**Runtime flow:** Docker builds frontend static export, copies it to `backend/static/`, then runs FastAPI on port 8000 serving both API and static files. In development, frontend runs on port 3000 via Next dev server with API calls proxied or pointed at backend separately.

**Key backend files:**
- `backend/main.py` -- FastAPI app, all route handlers, Pydantic models
- `backend/db.py` -- SQLite helpers, schema init, board/chat CRUD, `DEFAULT_BOARD`
- `backend/ai.py` -- OpenRouter client, structured output parsing

**Key frontend files:**
- `frontend/src/app/page.tsx` -- Login gate + board render
- `frontend/src/components/KanbanBoard.tsx` -- Main board with drag-and-drop
- `frontend/src/components/AiSidebar.tsx` -- Chat sidebar
- `frontend/src/lib/boardApi.ts` -- API client (fetchBoard, saveBoard, sendChatMessage)
- `frontend/src/lib/auth.ts` -- Hardcoded MVP auth (user/password), localStorage session

**API endpoints:**
- `GET /health` -- health check
- `GET /api/board` -- retrieve board JSON
- `PUT /api/board` -- update board JSON (validates fixed five-column structure and card referential integrity)
- `POST /api/chat` -- AI chat with board context and optional board_update (optimistic concurrency via version column)
- `POST /api/ai/check` -- simple AI prompt check

**Board constraint:** The board always has exactly five fixed columns (`col-backlog`, `col-discovery`, `col-progress`, `col-review`, `col-done`). Backend rejects updates that alter this structure. Pydantic models enforce size limits on all string fields and list sizes.

## Commands

### Frontend (run from `frontend/`)

```bash
npm install              # install dependencies
npm run dev              # dev server on port 3000
npm run build            # static export to frontend/out/
npm run lint             # ESLint
npm run test             # vitest unit tests (single run)
npm run test:unit:watch  # vitest in watch mode
npm run test:e2e         # playwright E2E tests
npm run test:all         # unit + E2E
```

Run a single vitest test file:
```bash
npx vitest run src/components/KanbanBoard.test.tsx
```

Run a single playwright test:
```bash
npx playwright test tests/kanban.spec.ts
```

E2E against Docker stack instead of dev server:
```bash
E2E_BASE_URL=http://127.0.0.1:8000 npm run test:e2e
```

### Backend (run from `backend/`)

```bash
uv sync                  # install dependencies
uv run pytest            # run all tests
uv run pytest tests/test_main.py  # single test file
uv run uvicorn main:app --reload --port 8000  # dev server
```

### Docker (run from project root)

```bash
docker compose up --build -d   # build and start
docker compose down             # stop
```

Cross-platform scripts are in `scripts/` (PowerShell for Windows, bash for Mac/Linux).

## Coding Standards

- No emojis in code or docs
- Keep it simple: no over-engineering, no unnecessary defensive programming
- Identify root cause before fixing issues; prove with evidence
- Target 80% test coverage for meaningful changed runtime code
- Use latest library versions and idiomatic approaches
- Frontend uses `@` path alias mapped to `src/`
- Backend uses `uv` as package manager (not pip directly)

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991`
- Dark Navy: `#032147`
- Gray Text: `#888888`

## Environment

- `OPENROUTER_API_KEY` in `.env` at project root (loaded via compose.yaml `env_file`). See `.env.example`.
- `PM_DB_PATH` -- override SQLite database path (default: `backend/data/app.db`). Used by test conftest.py to isolate test db.
- `PM_CORS_ORIGINS` -- comma-separated allowed origins for CORS (e.g., `http://localhost:3000` for dev)
- AI model: `openai/gpt-oss-120b`
- MVP login credentials: `user` / `password`


## DETAILED PLAN

@docs/PLAN.md contains the detailed implementation plan with checklists and success criteria for each part of the project. Please review it before proceeding with any implementation work.