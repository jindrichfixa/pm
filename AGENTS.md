# The Project Management App

## Business Requirements

This project is a Project Management App. Key features:
- User registration and login (JWT authentication with bcrypt password hashing)
- Multiple Kanban boards per user with custom columns (add, rename, delete)
- Cards with drag-and-drop, inline editing, priority, due dates, labels, and comments
- AI chat sidebar that can read the board and apply structured updates
- Profile management (display name, password change)

## Technical Decisions

- NextJS frontend (App Router, TypeScript, React 19, Tailwind v4)
- Python FastAPI backend, including serving the static NextJS site at /
- Everything packaged into a Docker container
- Use "uv" as the package manager for python in the Docker container
- Use OpenRouter for the AI calls. An OPENROUTER_API_KEY is in .env in the project root
- Use `openai/gpt-oss-120b` as the model
- Use SQLite local database for the database, creating a new db if it doesn't exist
- JWT auth with HS256 signing (PM_JWT_SECRET env var)
- Start and Stop server scripts for Mac, PC, Linux in scripts/

## Current Scope

- Multi-user with registration and login
- Multiple boards per user (no limit)
- Custom columns per board (1-20 columns, default 5: Backlog, Discovery, In Progress, Review, Done)
- Card comments
- Card search/filter by text, priority, labels
- Profile and password management
- AI chat with board context and structured board updates
- Board data validated by Pydantic models with size limits

## Color Scheme

- Accent Yellow: `#ecad0a` - accent lines, highlights
- Blue Primary: `#209dd7` - links, key sections
- Purple Secondary: `#753991` - submit buttons, important actions
- Dark Navy: `#032147` - main headings
- Gray Text: `#888888` - supporting text, labels

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
4. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.
5. Testing expectations must be pragmatic: target 80% coverage for meaningful changed runtime code when it adds value, but do not add or run tests purely to chase metrics.

## Working documentation

All documents for planning and executing this project are in the docs/ directory.
Please review the docs/PLAN.md document before proceeding.

## Progress snapshot (as of 2026-03-03)

- MVP (Parts 1-10) completed: planning, Docker scaffold, frontend serving, auth, database, board APIs, frontend-backend integration, OpenRouter connectivity, AI structured outputs, AI sidebar
- Iteration 1: JWT auth replacing hardcoded credentials, multi-user registration/login, multi-board support, card priority/due-date/labels
- Iteration 2: Custom columns, card comments, card detail modal, profile management, search/filter, board dashboard improvements
- Iteration 3: Verified registration/login flow, fixed logout bug (isRegistering state not reset), removed stale scaffold file, added registration unit + E2E tests
- Current status: Feature-complete for current scope. AI assistant has a known issue (see below).

## Known Issues

- **AI assistant broken**: The AI chat sidebar returns "OpenRouter response did not contain valid JSON output." error. The `openai/gpt-oss-120b` model does not reliably return the structured JSON the backend expects (`assistant_message` + optional `board_update`). Root cause is in `backend/ai.py` response parsing. Possible fixes: prompt engineering, switching models, or more lenient/fallback parsing.
