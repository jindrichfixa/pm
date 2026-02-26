# Project Plan

This file is the execution checklist for the MVP described in `AGENTS.md`.

## Quality Gates (apply to all implementation parts)

- [ ] Keep implementation simple and MVP-focused (no extra features)
- [ ] Identify root cause before fixes; verify with evidence
- [ ] Maintain minimum **80% test coverage** for changed modules
- [ ] Add/maintain robust integration tests for end-to-end user flows touched by each part
- [ ] Keep docs concise and current

## Part 1: Planning and project documentation

### Checklist

- [x] Expand `docs/PLAN.md` into detailed phase-by-phase checklist
- [x] Add test expectations and success criteria per phase
- [x] Create `frontend/AGENTS.md` describing current frontend architecture and behavior
- [x] User reviews and approves this plan before implementation starts

### Tests for this part

- Documentation review only (no runtime tests)

### Success criteria

- A clear plan exists for Parts 2-10 with explicit acceptance criteria
- Frontend baseline is documented so future diffs are easy to validate
- User approval recorded before any code implementation work

---

## Part 2: Scaffolding (Docker + FastAPI + scripts)

### Checklist

- [x] Create backend service scaffold in `backend/`
- [x] Create FastAPI app with:
	- [x] `GET /health` API
	- [x] Temporary `GET /api/hello` response for plumbing validation
	- [x] Root route serving simple static hello page (temporary)
- [x] Add Docker assets at root:
	- [x] `Dockerfile`
	- [x] `.dockerignore`
	- [x] optional compose file if needed for local convenience
- [x] Ensure Python dependency management uses `uv` in container
- [x] Add cross-platform scripts in `scripts/`:
	- [x] Windows start/stop
	- [x] Mac start/stop
	- [x] Linux start/stop
- [x] Validate app runs locally in container and serves both page + API

### Tests

- [x] Backend unit test for `GET /health`
- [x] Backend unit test for `GET /api/hello`
- [x] Integration test: containerized app boots and endpoints respond

### Success criteria

- Single command start from scripts launches containerized app
- Visiting `/` returns hello page
- Calling `/api/hello` returns expected JSON
- Stop script reliably shuts down app

---

## Part 3: Serve existing frontend from backend

### Checklist

- [x] Build Next.js frontend for production static output path compatible with backend serving
- [x] Wire backend static file serving to expose frontend at `/`
- [x] Remove temporary hello page while keeping health/API routes
- [x] Ensure frontend assets resolve correctly from backend host

### Tests

- [x] Frontend unit tests pass in CI/local
- [x] Integration test: `/` renders Kanban app through FastAPI-served assets
- [x] E2E smoke test against containerized stack

### Success criteria

- Kanban UI is visible at `/` through backend server
- No direct Next.js dev server required for MVP runtime
- Coverage remains >= 80% for touched code

---

## Part 4: Fake sign-in flow (MVP auth)

### Checklist

- [x] Add login screen at initial `/` visit
- [x] Accept only hardcoded credentials: `user` / `password`
- [x] Persist logged-in session state (MVP-safe local approach)
- [x] Add logout action and session clear behavior
- [x] Guard Kanban view behind login

### Tests

- [x] Unit tests for auth state helpers
- [x] Integration tests for login success/failure and logout
- [x] E2E test: unauthenticated user redirected/shown login; authenticated user sees board

### Success criteria

- Unauthenticated users cannot access Kanban board view
- Valid credentials grant access reliably
- Logout returns user to login screen

---

## Part 5: Database modeling (design + signoff)

### Checklist

- [x] Propose SQLite schema for:
	- [x] users
	- [x] one board per user (MVP constraint)
	- [x] board JSON payload persistence
	- [x] optional chat history storage for AI context
- [x] Document migration/initialization strategy when DB file is missing
- [x] Document rationale and tradeoffs in `docs/`
- [x] Request and obtain user signoff before implementation

### Tests

- Design review only in this phase (no schema code yet)

### Success criteria

- Schema proposal is clear, minimal, and aligned to MVP limitations
- Signoff obtained before Part 6 implementation

---

## Part 6: Backend Kanban APIs + persistence

### Checklist

- [x] Implement DB initialization on startup if missing
- [x] Implement backend data layer for reading/updating board JSON by user
- [x] Add API routes for board retrieval and updates
- [x] Add request/response validation schemas
- [x] Add deterministic error handling for invalid user/board payloads

### Tests

- [x] Backend unit tests for DB layer
- [x] Backend unit tests for API handlers
- [x] Integration tests for create/read/update flows with SQLite file

### Success criteria

- Backend persists board state for signed-in user between restarts
- API contracts are stable and validated
- Coverage >= 80% for backend modules touched

---

## Part 7: Frontend + backend integration

### Checklist

- [x] Replace in-memory frontend board state initialization with backend fetch
- [x] Persist user actions (rename/move/add/delete cards) through backend APIs
- [x] Add loading/error states for network operations (minimal, clear UX)
- [x] Keep drag/drop and card editing behavior intact

### Tests

- [x] Frontend unit tests for API client/state transitions
- [x] Integration tests with mocked network and failure modes
- [x] E2E tests for real persisted board behavior across page reload

Implementation note:
- Playwright supports two modes:
	- default: local Next dev server
	- Docker stack: set `E2E_BASE_URL=http://127.0.0.1:8000`
- Latest coverage run after Part 7 reported 79.55% overall aggregate because project-level reporting includes config/non-runtime files. Core touched runtime modules are covered by unit + integration + E2E checks.

### Success criteria

- Board changes survive refresh and app restart
- Core Kanban interactions remain responsive and correct
- Coverage >= 80% for touched frontend code

---

## Part 8: OpenRouter connectivity (backend)

### Checklist

- [x] Add OpenRouter client configuration using `OPENROUTER_API_KEY`
- [x] Set model to `openai/gpt-oss-120b`
- [x] Add backend AI service wrapper and simple API endpoint for connectivity check
- [x] Add safe handling for missing/invalid API key and upstream failures

### Tests

- [x] Unit tests for AI client request shaping
- [x] Integration test with mocked provider response
- [x] Optional manual connectivity check: prompt `2+2` through real key

### Success criteria

- Backend can successfully call OpenRouter with configured model
- Errors are reported cleanly without crashing app

---

## Part 9: AI with board context + structured outputs (MVP)

### Checklist

- [x] Define MVP structured output schema:
	- [x] `assistant_message` (required)
	- [x] optional `board_update` object (full board or operation list)
- [x] Send to model: current board JSON + user question + conversation history
- [x] Validate AI response against schema on backend
- [x] Apply optional board update safely and persist

### Tests

- [x] Unit tests for schema validation and parser behavior
- [x] Integration tests for:
	- [x] response-only (no board change)
	- [x] valid board update applied
	- [x] invalid structured output rejected safely

### Success criteria

- Every AI response yields a safe, user-visible assistant message
- Valid board updates are persisted; invalid updates are ignored with clear errors
- MVP schema remains intentionally minimal and easy to evolve

---

## Part 10: Frontend AI sidebar + board refresh

### Checklist

- [x] Build right sidebar chat UI consistent with project color scheme
- [x] Support conversation thread rendering and user input
- [x] Connect sidebar to backend AI endpoint
- [x] When AI returns board update, refresh board automatically in UI
- [x] Preserve current auth/session and board interactions

### Tests

- [x] Frontend component tests for chat rendering and submit behavior
- [x] Integration tests for sidebar + board sync behavior
- [x] E2E tests covering full flow: login -> ask AI -> board update visible

### Success criteria

- Users can chat with AI from sidebar without leaving board
- AI-driven board updates appear automatically and reliably
- Full MVP flow is covered by robust integration/E2E tests with >= 80% coverage on touched modules

---

## Execution rule

Implementation proceeds part-by-part, with verification at each part, and user approval checkpoints at least after Part 1 and Part 5.