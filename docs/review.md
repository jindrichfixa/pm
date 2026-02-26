# Code Review Report 2

Second comprehensive review after all findings from the first review (code_review.md) were fixed. This review covers the updated codebase.

## Summary

All 36 findings from the first review are fixed and verified. This second review found 42 new findings across backend, frontend, and infrastructure. Most are polish items appropriate for post-MVP hardening.

**Findings by severity:**

| Severity | Count |
|----------|-------|
| High | 5 |
| Medium | 18 |
| Low | 19 |

---

## High

### H-1: No authentication middleware on API endpoints

**Files:** `backend/main.py`

**Description:** API endpoints have no server-side authentication. The `_MVP_USERNAME` is hardcoded and no credentials are checked. The frontend auth is client-side only (localStorage). Anyone who can reach the server can read/modify the board and invoke AI calls (which cost money via OpenRouter).

**Action:** For post-MVP, add session-token or bearer-token authentication middleware. For localhost-only MVP, this is an accepted known risk already documented in `backend/AGENTS.md:80`.

---

### H-2: No rate limiting on AI endpoints

**Files:** `backend/main.py:222-275`

**Description:** `/api/ai/check` and `/api/chat` forward requests to OpenRouter with no rate limiting. Combined with H-1, anyone can make unlimited requests charged to the API key holder.

**Action:** Add rate limiting middleware (e.g., `slowapi` or an in-memory token bucket). At minimum limit AI endpoints to a reasonable number of requests per minute.

---

### H-3: Debounce timer not cleaned up on unmount

**File:** `frontend/src/components/KanbanBoard.tsx:64`

**Description:** `renameTimerRef` holds a `setTimeout` handle that is never cleared on component unmount. If the user renames a column and logs out within 500ms, the timer fires on an unmounted component.

**Action:** Add a cleanup effect:
```tsx
useEffect(() => {
  return () => {
    if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
  };
}, []);
```

---

### H-4: Event handlers not memoized with useCallback

**File:** `frontend/src/components/KanbanBoard.tsx:111-211`

**Description:** `handleDragStart`, `handleDragEnd`, `handleAddCard`, `handleDeleteCard`, and `handleSendChatMessage` are plain function declarations recreated on every render. This causes all child components to re-render unnecessarily.

**Action:** Wrap each handler in `useCallback`. Consider wrapping `KanbanColumn` and `AiSidebar` in `React.memo()`.

---

### H-5: `_has_valid_card_refs` not checked on AI board updates

**File:** `backend/main.py:133-174`

**Description:** `_parse_chat_response` validates AI-returned boards for fixed column structure but does NOT check card referential integrity. The `PUT /api/board` endpoint checks both, but the AI update path skips the card reference check. This means the AI could introduce orphaned cards or invalid references.

**Action:** Add `_has_valid_card_refs(validated_board)` check in `_parse_chat_response` after the `_has_valid_fixed_columns` check.

---

## Medium

### M-1: `compose.yaml` port binding not restricted to localhost

**File:** `compose.yaml:8`

**Description:** The port mapping `"8000:8000"` binds to all interfaces. Combined with H-1, the unauthenticated API is accessible to anyone on the network.

**Action:** Change to `"127.0.0.1:8000:8000"`.

---

### M-2: Root `.gitignore` missing `backend/static/`

**File:** `.gitignore`

**Description:** `backend/static/` is a build artifact (copied frontend export) not in the root `.gitignore`. Running `git add -A` from the root would commit it.

**Action:** Add `backend/static/` to root `.gitignore`.

---

### M-3: PUT /api/board does not use optimistic concurrency

**File:** `backend/main.py:201-219`

**Description:** `PUT /api/board` calls `update_board_for_user` with `expected_version=None`, always overwriting regardless of version. The chat endpoint correctly uses version checking, but direct board updates do not.

**Action:** Accept an `expected_version` field in the request and pass it through. Return 409 on mismatch.

---

### M-4: Chat history token budget not estimated

**File:** `backend/ai.py:131-136`

**Description:** `request_openrouter_structured_output` forwards up to 20 chat messages plus the full board JSON as context. A board with many cards and max-length details, combined with long chat messages, could exceed the model's context window.

**Action:** Add rough token estimation and truncate conversation history if the combined payload size exceeds a safe threshold.

---

### M-5: No connection pooling for SQLite

**File:** `backend/db.py:78-87`

**Description:** Every database operation opens a new `sqlite3.connect()`, commits, and closes. The chat endpoint makes 4 separate DB calls, each opening a new connection. Multiple operations in the chat endpoint are not transactionally consistent.

**Action:** Use a shared connection with WAL mode, or combine related operations into a single connection scope.

---

### M-6: Chat messages saved before board update can fail

**File:** `backend/main.py:256-267`

**Description:** User and assistant messages are appended to chat history before the board update is attempted. If the board update fails with 409 (version conflict), chat messages remain with references to an update that never happened.

**Action:** Defer saving chat messages until after board update succeeds, or wrap in a single transaction.

---

### M-7: `_extract_json_object` uses greedy brace matching

**File:** `backend/ai.py:39-65`

**Description:** The fallback JSON extraction uses `text.find("{")` and `text.rfind("}")` which could match wrong braces if the AI response contains multiple JSON objects or nested text with braces.

**Action:** Consider brace-depth counting or require the AI to always return valid JSON without fallback.

---

### M-8: CORS allows all methods and headers

**File:** `backend/main.py:43-49`

**Description:** `allow_methods=["*"]` and `allow_headers=["*"]` is overly permissive.

**Action:** Restrict to `allow_methods=["GET", "PUT", "POST", "OPTIONS"]` and `allow_headers=["Content-Type"]`.

---

### M-9: `cards` dict in `BoardPayload` has no max_length constraint

**File:** `backend/main.py:70-72`

**Description:** While columns and cardIds have size limits, the `cards` dict has no limit on the number of entries.

**Action:** Add `max_length=500` (or similar) to the `cards` field.

---

### M-10: Login form labels not linked via htmlFor/id

**File:** `frontend/src/app/page.tsx:52-78`

**Description:** `<label>` elements display visible text but are not linked to `<input>` elements via `htmlFor`/`id`. Both `aria-label` and visible label exist, which can cause inconsistent screen reader announcements.

**Action:** Add `htmlFor`/`id` attributes and remove redundant `aria-label`.

---

### M-11: Column title inputs share identical aria-label

**File:** `frontend/src/components/KanbanColumn.tsx:49`

**Description:** Every column renders `aria-label="Column title"`. Screen readers cannot distinguish between columns.

**Action:** Use unique labels: `aria-label={`Title for ${column.title}`}`.

---

### M-12: NewCardForm inputs lack accessible labels

**File:** `frontend/src/components/NewCardForm.tsx:27-43`

**Description:** Title input and details textarea use only `placeholder` text with no `aria-label`. Placeholder text is not reliably announced by all screen readers.

**Action:** Add `aria-label="Card title"` and `aria-label="Card details"`.

---

### M-13: `isValidBoard` uses JSON.stringify for array comparison

**File:** `frontend/src/components/KanbanBoard.tsx:35`

**Description:** `JSON.stringify(ids) !== JSON.stringify(EXPECTED_COLUMN_IDS)` is unnecessarily slow for comparing small string arrays.

**Action:** Use element-by-element comparison:
```tsx
if (ids.length !== EXPECTED_COLUMN_IDS.length || ids.some((id, i) => id !== EXPECTED_COLUMN_IDS[i])) return false;
```

---

### M-14: Optimistic UI updates without rollback on save failure

**File:** `frontend/src/components/KanbanBoard.tsx:164-211`

**Description:** `handleAddCard` and `handleDeleteCard` update local state immediately, then call `persistBoard`. On save failure, the error banner shows but local state retains the change, diverging from server state.

**Action:** Re-fetch the board from the server on save failure, or capture previous state for rollback.

---

### M-15: `fetchBoard` response not validated at runtime

**File:** `frontend/src/lib/boardApi.ts:29`

**Description:** `fetchBoard` casts the response with `as BoardData` without runtime validation. A malformed server response would cause cryptic errors in the component tree.

**Action:** Validate the response with `isValidBoard` before returning.

---

### M-16: Stale closure risk in debounced rename persist

**File:** `frontend/src/components/KanbanBoard.tsx:148-156`

**Description:** `nextBoard` is computed inside `setBoard`'s updater and captured by a `setTimeout` closure. If React batches state updates, the `nextBoard` captured by the timer may not match the final committed state. The persisted board could diverge from the rendered UI.

**Action:** Use a ref to track the latest board value and persist from that ref instead of from inside the state updater.

---

### M-17: Docker volume ownership potential mismatch

**File:** `Dockerfile:28-31`, `compose.yaml:12`

**Description:** Named volume `pm-data` is mounted at `/app/backend/data`. If the volume already exists from a previous root-user build, files inside are owned by root and the `app` user cannot write.

**Action:** Document that users should `docker compose down -v` after switching to non-root user, or add an entrypoint script that ensures directory is writable.

---

### M-18: Backend test coverage gaps

**Files:** `backend/tests/`

**Description:** Several important code paths lack test coverage:
1. `_has_valid_card_refs` duplicate card IDs and orphaned cards cases not tested directly
2. Chat endpoint error mapping (MissingApiKeyError, OpenRouterUpstreamError) not tested
3. Database migration path (version column addition) not tested
4. Chat message pruning not tested
5. `_extract_json_object` fallback brace extraction not tested
6. Chat endpoint 409 conflict response not tested

**Action:** Add targeted tests for each gap.

---

## Low

### L-1: `get_connection` always commits even on read operations

**File:** `backend/db.py:78-87`

**Description:** Context manager unconditionally calls `commit()` on normal exit. Pure reads issue unnecessary commits.

**Action:** Split into read/write connection helpers, or only commit when there are pending changes.

---

### L-2: `_FakeAsyncClient` class attributes persist across tests

**File:** `backend/tests/test_ai.py:24-51`

**Description:** `last_headers` and `last_json` are class-level attributes that persist across tests. Stale data from a previous test could cause false passes.

**Action:** Reset class attributes at the start of each test that reads them.

---

### L-3: `conftest.py` creates temp file at import time with no cleanup

**File:** `backend/tests/conftest.py:9-11`

**Description:** Temp file created with `delete=False` is never cleaned up. Single shared database across all test files means tests can affect each other.

**Action:** Use a proper pytest fixture with session scope and cleanup finalizer.

---

### L-4: `test_root.py` creates TestClient at module level

**File:** `backend/tests/test_root.py:6`

**Description:** Unlike `test_main.py` which uses a fixture, `test_root.py` uses a module-level client. Inconsistent with other test files.

**Action:** Convert to fixture-based approach matching `test_main.py`.

---

### L-5: No validation on `role` parameter in `append_chat_message_for_user`

**File:** `backend/db.py:259`

**Description:** Accepts any string as `role`. The DB CHECK constraint would catch invalid values but raises raw `sqlite3.IntegrityError` (500 error).

**Action:** Add `Literal["system", "user", "assistant"]` type hint and validate before SQL execution.

---

### L-6: `import json` unused in `test_ai.py`

**File:** `backend/tests/test_ai.py:2`

**Description:** `json` module imported but never used.

**Action:** Remove unused import.

---

### L-7: Docker image includes `tests/` directory

**File:** `Dockerfile:25`, `.dockerignore`

**Description:** `COPY backend/ ./` includes the `tests/` directory in the production image unnecessarily.

**Action:** Add `backend/tests` to `.dockerignore`.

---

### L-8: Static file mount catches all unmatched paths

**File:** `backend/main.py:278-284`

**Description:** The `StaticFiles` mount on `"/"` with `html=True` catches all paths that don't match defined routes. API path typos (e.g., `/api/borad`) return `index.html` with 200 instead of 404.

**Action:** Mount static files on a dedicated prefix or implement explicit SPA fallback.

---

### L-9: Scripts AGENTS.md references deleted platform scripts

**File:** `scripts/AGENTS.md:10-15`

**Description:** Lists `start-server-mac.sh`, `stop-server-mac.sh`, `start-server-linux.sh`, `stop-server-linux.sh` which were removed during MR-11 consolidation.

**Action:** Update to list only the four remaining scripts.

---

### L-10: Backend AGENTS.md references stale `/api/hello` endpoint

**File:** `backend/AGENTS.md:9,25`

**Description:** Still references `GET /api/hello` which was removed in LR-2.

**Action:** Remove `/api/hello` references.

---

### L-11: DATABASE.md missing `version` column in boards schema

**File:** `docs/DATABASE.md:43-53`

**Description:** Schema does not include the `version INTEGER NOT NULL DEFAULT 1` column added in MR-1.

**Action:** Add version column to schema documentation.

---

### L-12: DATABASE.md claims `PRAGMA user_version` is used for migrations

**File:** `docs/DATABASE.md:135-139`

**Description:** States `PRAGMA user_version` is used, but the actual migration uses `PRAGMA table_info` column-existence checks.

**Action:** Update to reflect actual approach.

---

### L-13: `.env.example` does not document optional env vars

**File:** `.env.example`

**Description:** Contains only `OPENROUTER_API_KEY`. Does not mention `PM_DB_PATH` or `PM_CORS_ORIGINS` which are documented in CLAUDE.md.

**Action:** Add commented-out entries for optional variables.

---

### L-14: Delete button inside drag handle area

**File:** `frontend/src/components/KanbanCard.tsx:29-30, 42-49`

**Description:** `{...attributes}` and `{...listeners}` are on the entire `<article>`, making the whole card a drag handle. The delete button is inside this area. A slight mouse movement during click may start a drag instead of deleting. The `distance: 6` activation constraint partially mitigates this.

**Action:** Separate the drag handle from card content. Add a dedicated drag handle element.

---

### L-15: Client-side chat messages array grows unbounded

**File:** `frontend/src/components/KanbanBoard.tsx:52`

**Description:** `chatMessages` state grows without limit in a long session. No virtualization for the message list.

**Action:** Cap at a reasonable limit (e.g., 200 messages), dropping oldest.

---

### L-16: `putCallCount` variable declared but never asserted

**File:** `frontend/src/components/KanbanBoard.test.tsx:144`

**Description:** Variable is declared and incremented in mock but never asserted on. Appears to be leftover debugging code.

**Action:** Remove variable or add assertion.

---

### L-17: No dedicated unit tests for leaf components

**Files:** `KanbanColumn.tsx`, `KanbanCard.tsx`, `KanbanCardPreview.tsx`, `NewCardForm.tsx`, `AiSidebar.tsx`

**Description:** These components are tested only indirectly through `KanbanBoard.test.tsx`. Edge cases (form cancellation, empty submission guard, auto-scroll) are not explicitly tested.

**Action:** Add focused unit tests for at least `NewCardForm` and `AiSidebar`.

---

### L-18: Missing test for non-JSON error response fallback in boardApi

**File:** `frontend/src/lib/boardApi.test.ts`

**Description:** The `getErrorMessage` function has a catch branch for non-JSON responses that is never tested.

**Action:** Add a test where the mock returns a non-JSON response body.

---

### L-19: `--font-body` CSS variable referenced but never defined

**File:** `frontend/src/app/globals.css:18`

**Description:** `--font-sans: var(--font-body)` references `--font-body` which is not defined anywhere. Tailwind's font-sans resolves to nothing. The `body` style explicitly sets `font-family: "Segoe UI", sans-serif` which works, but the Tailwind integration is broken.

**Action:** Define `--font-body` in `:root` or set `--font-sans` directly to `"Segoe UI", sans-serif`.

---

## Prioritized action plan

### Immediate (security)

1. **M-1:** Restrict port binding to localhost in compose.yaml
2. **H-5:** Add card ref validation to AI board update path

### Next (correctness)

3. **H-3:** Clean up debounce timer on unmount
4. **M-6:** Defer chat message saving until after board update succeeds
5. **M-16:** Fix stale closure in debounced rename
6. **L-9, L-10, L-11, L-12:** Update stale documentation

### Polish (quality)

7. **M-10, M-11, M-12:** Fix accessibility issues (labels, aria)
8. **M-13:** Replace JSON.stringify comparison
9. **H-4:** Memoize event handlers
10. **M-2:** Add `backend/static/` to .gitignore
11. **L-6, L-7, L-16:** Remove dead code/unused imports

### Post-MVP

12. **H-1, H-2:** Add authentication and rate limiting
13. **M-3:** Add optimistic concurrency to PUT /api/board
14. **M-4, M-5:** Token budget estimation and connection pooling
15. **M-14, M-15:** Rollback on save failure, validate fetchBoard response
16. **M-18:** Fill backend test coverage gaps
