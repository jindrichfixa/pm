"use client";

import { FormEvent, useEffect, useState } from "react";
import type { BoardMeta } from "@/lib/boardApi";
import { listBoards, createBoard, deleteBoard } from "@/lib/boardApi";
import { ProfileSettings } from "@/components/ProfileSettings";

type BoardDashboardProps = {
  onSelectBoard: (boardId: number) => void;
  onLogout: () => void;
  displayName: string;
  username: string;
  onDisplayNameChange: (newName: string) => void;
};

export const BoardDashboard = ({ onSelectBoard, onLogout, displayName, username, onDisplayNameChange }: BoardDashboardProps) => {
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const loadBoards = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await listBoards();
      setBoards(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBoards();
  }, []);

  const handleCreateBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newBoardName.trim()) return;

    setIsCreating(true);
    try {
      const result = await createBoard(newBoardName.trim(), newBoardDesc.trim());
      setNewBoardName("");
      setNewBoardDesc("");
      setShowCreateForm(false);
      onSelectBoard(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBoard = async (boardId: number, boardName: string) => {
    if (!window.confirm(`Delete board "${boardName}"? This cannot be undone.`)) return;

    try {
      await deleteBoard(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete board");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#f0f4f8]">
      <header className="border-b border-[var(--stroke)] bg-white/80 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
              Project Management
            </h1>
            <p className="text-xs text-[var(--gray-text)]">
              Signed in as <span className="font-semibold text-[var(--navy-dark)]">{displayName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-1.5 rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              aria-label="Profile settings"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--gray-text)] hover:text-[var(--navy-dark)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm font-medium text-[var(--secondary-purple)]">
            {error}
          </p>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
            Your Boards
          </h2>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            {showCreateForm ? "Cancel" : "New Board"}
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateBoard}
            className="mb-6 rounded-2xl border border-[var(--stroke)] bg-white p-5 shadow-[0_4px_16px_rgba(3,33,71,0.06)]"
          >
            <h3 className="mb-3 text-sm font-semibold text-[var(--navy-dark)]">Create New Board</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">
                  Board Name
                </label>
                <input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="e.g. Sprint 4 Board"
                  className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">
                  Description (optional)
                </label>
                <input
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  placeholder="Brief description"
                  className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
                  maxLength={500}
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-70"
              >
                {isCreating ? "Creating..." : "Create Board"}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="text-sm font-medium text-[var(--gray-text)]">Loading boards...</p>
        ) : boards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--stroke)] bg-white px-6 py-12 text-center">
            <p className="text-sm text-[var(--gray-text)]">No boards yet. Create your first board to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <article
                key={board.id}
                className="group relative cursor-pointer rounded-2xl border border-[var(--stroke)] bg-white p-5 shadow-[0_2px_8px_rgba(3,33,71,0.04)] transition hover:shadow-[0_4px_16px_rgba(3,33,71,0.10)]"
                onClick={() => onSelectBoard(board.id)}
                data-testid={`board-card-${board.id}`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-display text-base font-semibold text-[var(--navy-dark)]">
                    {board.name}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteBoard(board.id, board.name);
                    }}
                    className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--gray-text)] opacity-0 transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)] group-hover:opacity-100"
                    aria-label={`Delete ${board.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
                {board.description && (
                  <p className="mb-3 text-xs text-[var(--gray-text)]">{board.description}</p>
                )}
                <p className="text-[10px] text-[var(--gray-text)]">
                  Updated {new Date(board.updated_at).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>

      {showProfile && (
        <ProfileSettings
          displayName={displayName}
          username={username}
          onClose={() => setShowProfile(false)}
          onDisplayNameChange={onDisplayNameChange}
        />
      )}
    </div>
  );
};
