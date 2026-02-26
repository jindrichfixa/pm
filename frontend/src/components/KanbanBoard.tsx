"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { CardDetailModal } from "@/components/CardDetailModal";
import { AiSidebar, type ChatItem } from "@/components/AiSidebar";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";
import { fetchBoardById, saveBoardById, sendChatMessageToBoard } from "@/lib/boardApi";

function isValidBoard(board: unknown): board is BoardData {
  if (!board || typeof board !== "object") return false;
  const b = board as Record<string, unknown>;
  if (!Array.isArray(b.columns) || typeof b.cards !== "object" || !b.cards) return false;
  if (b.columns.length === 0) return false;
  const cards = b.cards as Record<string, unknown>;
  for (const col of b.columns as { cardIds?: string[] }[]) {
    if (!Array.isArray(col.cardIds)) return false;
    for (const cardId of col.cardIds) {
      if (!(cardId in cards)) return false;
    }
  }
  return true;
}

type KanbanBoardProps = {
  boardId: number;
  boardName: string;
  onBack: () => void;
};

export const KanbanBoard = ({ boardId, boardName, onBack }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [boardError, setBoardError] = useState<string>("");
  const [chatError, setChatError] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatItem[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setBoardError("");
      try {
        const result = await fetchBoardById(boardId);
        if (!isMounted) return;
        setBoard(result.board);
      } catch (err) {
        if (!isMounted) return;
        setBoard(initialData);
        setBoardError(err instanceof Error ? err.message : "Failed to load board");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [boardId]);

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  const persistBoard = useCallback(async (nextBoard: BoardData) => {
    try {
      await saveBoardById(boardId, nextBoard);
      setBoardError("");
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : "Failed to save board");
    }
  }, [boardId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!board || !over || active.id === over.id) return;

    setBoard((prev) => {
      if (!prev) return prev;

      const nextBoard = {
        ...prev,
        columns: moveCard(prev.columns, active.id as string, over.id as string),
      };
      void persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleRenameColumn = useCallback(
    (columnId: string, title: string) => {
      setBoard((prev) => {
        if (!prev) return prev;

        const nextBoard = {
          ...prev,
          columns: prev.columns.map((column) =>
            column.id === columnId ? { ...column, title } : column
          ),
        };

        if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
        renameTimerRef.current = setTimeout(() => {
          void persistBoard(nextBoard);
        }, 500);

        return nextBoard;
      });
    },
    [persistBoard]
  );

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => {
      if (!prev) return prev;

      const nextBoard = {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: { id, title, details: details || "No details yet." },
        },
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? { ...column, cardIds: [...column.cardIds, id] }
            : column
        ),
      };
      void persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      if (!prev) return prev;

      const nextBoard = {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
            : column
        ),
      };
      void persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleUpdateCard = (cardId: string, updates: Partial<{ title: string; details: string; priority: string | null; due_date: string | null; labels: string[] }>) => {
    setBoard((prev) => {
      if (!prev || !prev.cards[cardId]) return prev;

      const nextBoard = {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...prev.cards[cardId], ...updates },
        },
      };
      void persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleAddColumn = () => {
    const id = createId("col");
    setBoard((prev) => {
      if (!prev) return prev;

      const nextBoard = {
        ...prev,
        columns: [...prev.columns, { id, title: "New Column", cardIds: [] }],
      };
      void persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleDeleteColumn = (columnId: string) => {
    setBoard((prev) => {
      if (!prev || prev.columns.length <= 1) return prev;

      const column = prev.columns.find((c) => c.id === columnId);
      if (!column) return prev;

      // Remove cards that belong to this column
      const cardIdsToRemove = new Set(column.cardIds);
      const nextCards = Object.fromEntries(
        Object.entries(prev.cards).filter(([id]) => !cardIdsToRemove.has(id))
      );

      const nextBoard = {
        ...prev,
        columns: prev.columns.filter((c) => c.id !== columnId),
        cards: nextCards,
      };
      void persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleSendChatMessage = async (message: string) => {
    const userMessage: ChatItem = {
      id: createId("chat"),
      role: "user",
      content: message,
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setIsSendingChat(true);

    try {
      const response = await sendChatMessageToBoard(boardId, message);
      const assistantMessage: ChatItem = {
        id: createId("chat"),
        role: "assistant",
        content: response.assistant_message,
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
      setChatError("");

      if (response.board_update && isValidBoard(response.board_update)) {
        setBoard(response.board_update);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSendingChat(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen items-center justify-center px-6">
        <p className="text-sm font-medium text-[var(--gray-text)]">Loading board...</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="mx-auto flex min-h-screen items-center justify-center px-6">
        <p className="text-sm font-medium text-[var(--secondary-purple)]">Unable to load board</p>
      </main>
    );
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  const matchesFilter = (cardId: string): boolean => {
    const card = board.cards[cardId];
    if (!card) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = card.title.toLowerCase().includes(q);
      const detailsMatch = card.details.toLowerCase().includes(q);
      const labelMatch = card.labels?.some((l) => l.toLowerCase().includes(q)) ?? false;
      if (!titleMatch && !detailsMatch && !labelMatch) return false;
    }

    if (filterPriority && card.priority !== filterPriority) return false;

    return true;
  };

  const hasActiveFilter = searchQuery !== "" || filterPriority !== "";

  const filteredColumns = hasActiveFilter
    ? board.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter(matchesFilter),
      }))
    : board.columns;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[320px] w-[320px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.15)_0%,_rgba(32,157,215,0.03)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.12)_0%,_rgba(117,57,145,0.03)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen flex-col gap-6 px-6 pb-12 pt-6 2xl:px-10">
        {boardError ? (
          <p
            role="alert"
            className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm font-medium text-[var(--secondary-purple)]"
          >
            {boardError}
          </p>
        ) : null}

        <header className="flex items-center justify-between gap-6 rounded-2xl border border-[var(--stroke)] bg-white/80 px-6 py-4 shadow-[0_4px_16px_rgba(3,33,71,0.06)] backdrop-blur">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              aria-label="Back to boards"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Boards
            </button>
            <div>
              <h1 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
                {boardName}
              </h1>
              <p className="text-xs text-[var(--gray-text)]">
                Drag cards between columns to track progress
              </p>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              {board.columns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--stroke)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
                  {column.title}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--gray-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cards..."
                className="w-[180px] rounded-lg border border-[var(--stroke)] py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[var(--primary-blue)]"
                aria-label="Search cards"
              />
            </div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="rounded-lg border border-[var(--stroke)] px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setFilterPriority(""); }}
                className="text-xs font-medium text-[var(--primary-blue)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_280px]">
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex min-w-0 gap-3 overflow-x-auto pb-2">
              {filteredColumns.map((column) => (
                <div key={column.id} className="w-[240px] shrink-0 lg:w-auto lg:flex-1">
                  <KanbanColumn
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                    onUpdateCard={handleUpdateCard}
                    onDeleteColumn={board.columns.length > 1 ? handleDeleteColumn : undefined}
                    onOpenCardDetail={setDetailCardId}
                  />
                </div>
              ))}
              <div className="flex w-[240px] shrink-0 items-start lg:w-auto">
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--stroke)] bg-white/50 px-4 py-8 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                  aria-label="Add column"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Column
                </button>
              </div>
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[220px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <AiSidebar
            messages={chatMessages}
            isSending={isSendingChat}
            error={chatError}
            onSend={handleSendChatMessage}
          />
        </section>
      </main>

      {detailCardId && board.cards[detailCardId] && (
        <CardDetailModal
          boardId={boardId}
          card={board.cards[detailCardId]}
          columnTitle={board.columns.find((c) => c.cardIds.includes(detailCardId))?.title || ""}
          onClose={() => setDetailCardId(null)}
          onUpdateCard={handleUpdateCard}
        />
      )}
    </div>
  );
};
