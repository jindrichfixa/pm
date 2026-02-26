# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Management application: a multi-board Kanban web app with AI chat sidebar. Features user registration/login (JWT auth), multiple boards per user, drag-and-drop card management with priority/due-date/label fields, and AI-driven board updates via OpenRouter.

## Architecture

**Monorepo with two main directories:**

- `frontend/` -- Next.js 16 (App Router, TypeScript, React 19, Tailwind v4, `@dnd-kit` for drag-and-drop). Exports as static site (`output: "export"` in next.config.ts).
- `backend/` -- Python 3.13 FastAPI. Serves the exported frontend from `backend/static/`. SQLite database at `backend/data/app.db` (auto-created on startup). AI calls go through OpenRouter (`ai.py`).

**Runtime flow:** Docker builds frontend static export, copies it to `backend/static/`, then runs FastAPI on port 8000 serving both API and static files. In development, frontend runs on port 3000 via Next dev server with API calls proxied or pointed at backend separately.

**Key backend files:**
- `backend/main.py` -- FastAPI app, all route handlers, Pydantic models, JWT auth middleware
- `backend/db.py` -- SQLite helpers, schema init, user/board/chat CRUD, `DEFAULT_BOARD`
- `backend/auth.py` -- JWT token creation/verification (PyJWT + bcrypt)
- `backend/ai.py` -- OpenRouter client, structured output parsing

**Key frontend files:**
- `frontend/src/app/page.tsx` -- Login/register gate + board dashboard + board view routing
- `frontend/src/components/BoardDashboard.tsx` -- Board list, create, delete
- `frontend/src/components/KanbanBoard.tsx` -- Main board with drag-and-drop (takes boardId prop)
- `frontend/src/components/KanbanCard.tsx` -- Card with inline editing, priority, due date, labels
- `frontend/src/components/ProfileSettings.tsx` -- Profile/password management modal
- `frontend/src/components/CardDetailModal.tsx` -- Card detail view with comments
- `frontend/src/components/AiSidebar.tsx` -- Chat sidebar
- `frontend/src/lib/boardApi.ts` -- API client (auth, board CRUD, chat)
- `frontend/src/lib/auth.ts` -- JWT token/user storage in localStorage

**Auth flow:**
- `POST /api/auth/register` -- create account, returns JWT + user object
- `POST /api/auth/login` -- authenticate, returns JWT + user object
- `GET /api/auth/me` -- get current user (requires Bearer token)
- All `/api/boards/*` and `/api/chat` endpoints require `Authorization: Bearer <token>` header
- Passwords hashed with bcrypt; JWT uses HS256 with `PM_JWT_SECRET` env var

**API endpoints:**
- `GET /health` -- health check
- `POST /api/auth/register` -- user registration
- `POST /api/auth/login` -- user login
- `GET /api/auth/me` -- current user info
- `PATCH /api/auth/profile` -- update display name
- `POST /api/auth/change-password` -- change password
- `GET /api/boards` -- list user's boards
- `POST /api/boards` -- create new board
- `GET /api/boards/:id` -- get board with data
- `PUT /api/boards/:id` -- update board data (validates structure)
- `PATCH /api/boards/:id/meta` -- update board name/description
- `DELETE /api/boards/:id` -- delete board
- `POST /api/boards/:id/chat` -- AI chat with board context
- `GET /api/boards/:id/cards/:cardId/comments` -- list card comments
- `POST /api/boards/:id/cards/:cardId/comments` -- add card comment
- `DELETE /api/boards/:id/cards/:cardId/comments/:commentId` -- delete card comment
- `POST /api/ai/check` -- simple AI prompt check
- `GET /api/board` -- legacy: get first board (requires auth)
- `PUT /api/board` -- legacy: update first board (requires auth)
- `POST /api/chat` -- legacy: AI chat on first board (requires auth)

**Board constraint:** Boards support custom columns (add, rename, delete). Backend validates that boards have at least one column with unique IDs and consistent card references. Default boards start with five columns (Backlog, Discovery, In Progress, Review, Done). Maximum 20 columns per board. Pydantic models enforce size limits on all string fields and list sizes.

**Card fields:** `id`, `title`, `details`, `priority` (optional: low/medium/high/critical), `due_date` (optional: ISO date string), `labels` (optional: list of strings).

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
- `PM_JWT_SECRET` -- JWT signing secret (default: dev secret, must be set in production)
- AI model: `openai/gpt-oss-120b`
- Demo login credentials: `user` / `password`


## Project Status

MVP (Parts 1-10) and two iterations of enhancements are complete. See `AGENTS.md` for full feature list and `docs/PLAN.md` for the execution history.

## DETAILED PLAN

@docs/PLAN.md contains the detailed implementation plan with checklists and success criteria for each part of the project. Please review it before proceeding with any implementation work.
