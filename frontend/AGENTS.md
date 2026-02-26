# Frontend Agent Notes

This document describes the current frontend in `frontend/`.

## Overview

- Framework: Next.js 16 (App Router)
- Language: TypeScript + React 19
- Styling: Tailwind v4
- Drag-and-drop: `@dnd-kit`
- Static export: `output: "export"` in next.config.ts

## App Flow

1. `src/app/page.tsx` -- entry point, handles auth gate (login/register), board dashboard, and board view routing
2. Unauthenticated users see login/register form
3. Authenticated users see the board dashboard (list of boards)
4. Selecting a board opens the Kanban board view with AI sidebar

## Authentication

- JWT-based auth against backend (`POST /api/auth/login`, `POST /api/auth/register`)
- Token and user object stored in localStorage via `src/lib/auth.ts`
- All API calls include `Authorization: Bearer <token>` header
- Profile management (display name, password change) via `ProfileSettings` component

## Key Components

- `BoardDashboard.tsx` -- Board list, create new board, delete board, board selection
- `KanbanBoard.tsx` -- Main board view with drag-and-drop columns and cards, toolbar with search/filter
- `KanbanColumn.tsx` -- Single column with card list, inline rename, add/delete column
- `KanbanCard.tsx` -- Card with inline editing, priority badge, due date, labels
- `KanbanCardPreview.tsx` -- Drag overlay preview
- `NewCardForm.tsx` -- Inline form for adding cards to a column
- `CardDetailModal.tsx` -- Full card detail view with comments, priority, due date, labels editing
- `ProfileSettings.tsx` -- Profile and password management modal
- `AiSidebar.tsx` -- AI chat sidebar with conversation thread

## Board Features

- Multiple boards per user
- Custom columns (add, rename, delete) with max 20 columns
- Card fields: title, details, priority (low/medium/high/critical), due date, labels
- Card comments (add, delete)
- Search/filter cards by text, priority, labels
- Drag-and-drop cards within and across columns
- AI chat that can read and update the board

## Data Layer

- `src/lib/boardApi.ts` -- API client for all backend calls (auth, board CRUD, chat, comments)
- `src/lib/auth.ts` -- JWT token and user storage in localStorage
- `src/lib/kanban.ts` -- Board data types (`Card`, `Column`, `BoardData`) and `moveCard` logic

## Testing

- Unit/component tests (Vitest + Testing Library):
	- `src/app/page.test.tsx`
	- `src/components/KanbanBoard.test.tsx`
	- `src/components/BoardDashboard.test.tsx`
	- `src/components/CardDetailModal.test.tsx`
	- `src/components/KanbanCard.test.tsx`
	- `src/components/ProfileSettings.test.tsx`
	- `src/lib/auth.test.ts`
	- `src/lib/boardApi.test.ts`
	- `src/lib/kanban.test.ts`
- E2E tests (Playwright):
	- `tests/kanban.spec.ts`
- Run unit tests: `npm run test`
- Run E2E: `npm run test:e2e`
- E2E against Docker: `E2E_BASE_URL=http://127.0.0.1:8000 npm run test:e2e`

## Path Alias

- `@` maps to `src/` (configured in tsconfig.json)
