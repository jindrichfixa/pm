# Project Management App

A multi-board Kanban web application with AI chat sidebar. Built with Next.js frontend and Python FastAPI backend, packaged in Docker.

## Features

- User registration and login (JWT authentication)
- Multiple boards per user with custom columns
- Drag-and-drop card management (priority, due dates, labels)
- Card detail modal with comments
- Profile and password management
- AI chat sidebar that can read and update the board via OpenRouter

## Quick Start

```bash
# 1. Copy env file and add your OpenRouter API key
cp .env.example .env

# 2. Start with Docker Compose
docker compose up --build -d

# 3. Open http://localhost:8000
```

Demo credentials: `user` / `password`

To stop:
```bash
docker compose down
```

Cross-platform start/stop scripts are also available in `scripts/`.

## Development Setup

### Backend (from `backend/`)

```bash
uv sync
uv run uvicorn main:app --reload --port 8000
```

### Frontend (from `frontend/`)

```bash
npm install
npm run dev    # dev server on port 3000
```

Point the frontend at the backend by setting the API base URL or running both together via Docker.

## Testing

### Backend

```bash
cd backend
uv run pytest
```

### Frontend

```bash
cd frontend
npm run test          # vitest unit tests
npm run test:e2e      # playwright E2E tests
npm run test:all      # both
```

E2E against Docker stack:
```bash
E2E_BASE_URL=http://127.0.0.1:8000 npm run test:e2e
```

## Architecture

```
frontend/    Next.js 16 (App Router, TypeScript, React 19, Tailwind v4)
backend/     Python 3.13 FastAPI, SQLite, JWT auth, OpenRouter AI
Dockerfile   Multi-stage build: frontend static export -> backend serves all
```

Docker builds the frontend as a static export, copies it to `backend/static/`, and runs FastAPI on port 8000 serving both API and UI. SQLite database is stored in a Docker volume at `backend/data/app.db`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | API key for OpenRouter AI calls |
| `PM_JWT_SECRET` | Production | JWT signing secret (has dev default) |
| `PM_CORS_ORIGINS` | No | Comma-separated allowed CORS origins |
| `PM_DB_PATH` | No | Override SQLite database path |

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991`
- Dark Navy: `#032147`
- Gray Text: `#888888`
