import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--gray-text)] opacity-0 transition hover:bg-[var(--surface)] hover:text-[var(--secondary-purple)] group-hover/card:opacity-100"
          aria-label={`Delete ${card.title}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </div>
    </article>
  );
};
