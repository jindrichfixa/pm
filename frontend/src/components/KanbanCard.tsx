import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-400 text-white",
  medium: "bg-[var(--accent-yellow)] text-[var(--navy-dark)]",
  low: "bg-[var(--primary-blue)]/20 text-[var(--primary-blue)]",
};

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onUpdate?: (cardId: string, updates: Partial<{ title: string; details: string; priority: string | null; due_date: string | null; labels: string[] }>) => void;
  onOpenDetail?: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete, onUpdate, onOpenDetail }: KanbanCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDetails, setEditDetails] = useState(card.details);
  const [editPriority, setEditPriority] = useState(card.priority || "");
  const [editDueDate, setEditDueDate] = useState(card.due_date || "");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(card.id, {
        title: editTitle,
        details: editDetails,
        priority: editPriority || null,
        due_date: editDueDate || null,
      });
    }
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setEditTitle(card.title);
    setEditDetails(card.details);
    setEditPriority(card.priority || "");
    setEditDueDate(card.due_date || "");
    setIsExpanded(false);
  };

  if (isExpanded) {
    return (
      <article
        ref={setNodeRef}
        style={style}
        className="rounded-xl border border-[var(--primary-blue)] bg-white px-3 py-3 shadow-[0_4px_16px_rgba(3,33,71,0.10)]"
        data-testid={`card-${card.id}`}
      >
        <div className="space-y-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-sm font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Card title"
          />
          <textarea
            value={editDetails}
            onChange={(e) => setEditDetails(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Card details"
          />
          <div className="flex gap-2">
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
              className="rounded-lg border border-[var(--stroke)] px-2 py-1 text-[10px] text-[var(--navy-dark)] outline-none"
              aria-label="Priority"
            >
              <option value="">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="rounded-lg border border-[var(--stroke)] px-2 py-1 text-[10px] text-[var(--navy-dark)] outline-none"
              aria-label="Due date"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[var(--primary-blue)] px-2.5 py-1 text-[10px] font-semibold text-white transition hover:brightness-110"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-[var(--stroke)] px-2.5 py-1 text-[10px] font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(3,33,71,0.06)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_8px_20px_rgba(3,33,71,0.14)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="group/card flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-5 text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && card.details !== "No details yet." && (
            <p className="mt-1 text-xs leading-5 text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {card.priority && (
              <span className={clsx(
                "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                PRIORITY_COLORS[card.priority] || "bg-gray-100 text-gray-600"
              )}>
                {card.priority}
              </span>
            )}
            {card.due_date && (
              <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--gray-text)]">
                {card.due_date}
              </span>
            )}
            {card.labels?.map((label) => (
              <span
                key={label}
                className="rounded-full bg-[var(--secondary-purple)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--secondary-purple)]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 opacity-0 transition group-hover/card:opacity-100">
          {onOpenDetail && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(card.id);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
              aria-label={`View ${card.title}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
            aria-label={`Edit ${card.title}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)]"
            aria-label={`Delete ${card.title}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
};
