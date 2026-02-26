"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Card } from "@/lib/kanban";
import {
  getCardComments,
  addCardComment,
  deleteCardComment,
  type CardComment,
} from "@/lib/boardApi";

type CardDetailModalProps = {
  boardId: number;
  card: Card;
  columnTitle: string;
  onClose: () => void;
  onUpdateCard: (cardId: string, updates: Partial<{ title: string; details: string; priority: string | null; due_date: string | null; labels: string[] }>) => void;
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

export const CardDetailModal = ({
  boardId,
  card,
  columnTitle,
  onClose,
  onUpdateCard,
}: CardDetailModalProps) => {
  const [comments, setComments] = useState<CardComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState("");

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDetails, setEditDetails] = useState(card.details);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await getCardComments(boardId, card.id);
        if (mounted) setComments(result);
      } catch {
        if (mounted) setError("Failed to load comments");
      } finally {
        if (mounted) setIsLoadingComments(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [boardId, card.id]);

  const handleAddComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newComment.trim()) return;

    setIsPosting(true);
    setError("");
    try {
      const comment = await addCardComment(boardId, card.id, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteCardComment(boardId, card.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== card.title) {
      onUpdateCard(card.id, { title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDetails = () => {
    if (editDetails.trim() && editDetails !== card.details) {
      onUpdateCard(card.id, { details: editDetails.trim() });
    }
    setIsEditingDetails(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mb-12 w-full max-w-xl rounded-2xl border border-[var(--stroke)] bg-white shadow-xl" data-testid="card-detail-modal">
        <div className="flex items-start justify-between border-b border-[var(--stroke)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
              {columnTitle}
            </p>
            {isEditingTitle ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); }}
                className="w-full border-b border-[var(--primary-blue)] bg-transparent text-lg font-semibold text-[var(--navy-dark)] outline-none"
                autoFocus
                aria-label="Card title"
              />
            ) : (
              <h2
                className="cursor-pointer text-lg font-semibold text-[var(--navy-dark)] hover:text-[var(--primary-blue)]"
                onClick={() => setIsEditingTitle(true)}
              >
                {card.title}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
            aria-label="Close card detail"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {card.priority && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_COLORS[card.priority] || "bg-gray-100 text-gray-700"}`}>
                {card.priority}
              </span>
            )}
            {card.due_date && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Due: {card.due_date}
              </span>
            )}
            {card.labels?.map((label) => (
              <span key={label} className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--navy-dark)]">
                {label}
              </span>
            ))}
          </div>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">Description</h3>
          {isEditingDetails ? (
            <textarea
              value={editDetails}
              onChange={(e) => setEditDetails(e.target.value)}
              onBlur={handleSaveDetails}
              className="mb-4 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
              rows={3}
              autoFocus
              aria-label="Card details"
            />
          ) : (
            <p
              className="mb-4 cursor-pointer whitespace-pre-wrap rounded-xl bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] hover:ring-1 hover:ring-[var(--primary-blue)]"
              onClick={() => setIsEditingDetails(true)}
            >
              {card.details || "No details yet. Click to add."}
            </p>
          )}

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">
            Comments ({comments.length})
          </h3>

          {error && (
            <p className="mb-2 text-xs font-medium text-[var(--secondary-purple)]">{error}</p>
          )}

          {isLoadingComments ? (
            <p className="text-xs text-[var(--gray-text)]">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="mb-3 text-xs text-[var(--gray-text)]">No comments yet.</p>
          ) : (
            <div className="mb-3 space-y-2">
              {comments.map((comment) => (
                <div key={comment.id} className="group/comment rounded-lg bg-[var(--surface)] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-[var(--navy-dark)]">
                      {comment.display_name || comment.username}
                      <span className="ml-2 font-normal text-[var(--gray-text)]">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleDeleteComment(comment.id)}
                      className="flex h-5 w-5 items-center justify-center rounded text-[var(--gray-text)] opacity-0 transition hover:text-[var(--secondary-purple)] group-hover/comment:opacity-100"
                      aria-label="Delete comment"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--navy-dark)]">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded-lg border border-[var(--stroke)] px-3 py-1.5 text-xs outline-none transition focus:border-[var(--primary-blue)]"
              maxLength={2000}
              aria-label="Comment"
            />
            <button
              type="submit"
              disabled={isPosting || !newComment.trim()}
              className="rounded-lg bg-[var(--primary-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {isPosting ? "..." : "Post"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
