import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 shadow-[0_8px_20px_rgba(3,33,71,0.14)]">
    <h4 className="font-display text-sm font-semibold leading-5 text-[var(--navy-dark)]">
      {card.title}
    </h4>
    {card.details && card.details !== "No details yet." && (
      <p className="mt-1 text-xs leading-5 text-[var(--gray-text)]">
        {card.details}
      </p>
    )}
  </article>
);
