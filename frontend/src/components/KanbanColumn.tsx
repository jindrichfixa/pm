import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const { setNodeRef: setEmptyDropRef, isOver: isEmptyOver } = useDroppable({
    id: `${column.id}__empty`,
  });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[420px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3 transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
        />
        <span className="shrink-0 rounded-full bg-[var(--navy-dark)]/8 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--gray-text)]">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div
            ref={setEmptyDropRef}
            className={clsx(
              "flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] px-3 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition",
              isEmptyOver && "ring-2 ring-[var(--accent-yellow)]"
            )}
            data-testid={`empty-drop-${column.id}`}
          >
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
