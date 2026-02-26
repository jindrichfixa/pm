# Frontend Agent Notes

This document describes the current frontend baseline in `frontend/` so implementation changes can stay focused and verifiable.

## Overview

- Framework: Next.js (App Router)
- Language: TypeScript + React
- Styling: global CSS + utility classes
- Primary UI: single-page Kanban board at `/`
- Current state model: board UI is client-side rendered but persisted via backend board APIs

## Current app behavior

- `src/app/page.tsx` now handles authentication gate and renders `KanbanBoard` only when authenticated.
- `KanbanBoard` supports:
  - fixed five columns
  - inline column renaming
  - add card per column
  - remove card
  - drag-and-drop card movement within and across columns (`@dnd-kit`)
  - right-side AI chat sidebar
  - chat thread rendering for user/assistant messages
  - `POST /api/chat` integration
  - automatic board refresh when AI returns `board_update`
- Data shape is defined in `src/lib/kanban.ts`:
  - `Card`, `Column`, `BoardData`
  - seeded by `initialData`
  - card movement logic centralized in `moveCard`
- Auth helpers are defined in `src/lib/auth.ts`:
  - hardcoded credential validation (`user` / `password`)
  - localStorage session persistence (`pm-authenticated`)

## Key files

- App entry:
  - `src/app/page.tsx`
- Core board components:
  - `src/components/KanbanBoard.tsx`
  - `src/components/AiSidebar.tsx`
  - `src/components/KanbanColumn.tsx`
  - `src/components/KanbanCard.tsx`
  - `src/components/KanbanCardPreview.tsx`
  - `src/components/NewCardForm.tsx`
- Board logic:
  - `src/lib/kanban.ts`
  - `src/lib/boardApi.ts` (`sendChatMessage`)

## Testing baseline

- Unit/component tests:
  - `src/app/page.test.tsx`
  - `src/components/KanbanBoard.test.tsx`
  - `src/lib/auth.test.ts`
  - `src/lib/boardApi.test.ts`
  - `src/lib/kanban.test.ts`
- E2E tests:
  - `tests/kanban.spec.ts`
- Test tooling:
  - Vitest + Testing Library for unit/component
  - Playwright for E2E

## Current constraints

- Frontend auth is local-only MVP gate (not server-authenticated yet).
- Kanban UI now reads/saves board state through backend `/api/board`.
- Board changes persist across page refresh/restart via backend SQLite.
- Drag-and-drop behavior is functional and stable in current app flow.

## E2E guidance

- Default `npm run test:e2e` runs against local Next dev server.
- To test against Dockerized backend-served frontend, set:
  - `E2E_BASE_URL=http://127.0.0.1:8000`

## Part 10 status

- Part 10 frontend AI sidebar flow is implemented.
- Unit/component and integration-style tests cover chat rendering, submit flow, and board sync.
- Targeted E2E for `login -> ask AI -> board update visible` passes.