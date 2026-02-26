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
import { AiSidebar, type ChatItem } from "@/components/AiSidebar";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";
import { fetchBoard, saveBoard, sendChatMessage } from "@/lib/boardApi";

const EXPECTED_COLUMN_IDS = [
  "col-backlog",
  "col-discovery",
  "col-progress",
  "col-review",
  "col-done",
];

function isValidBoard(board: unknown): board is BoardData {
  if (!board || typeof board !== "object") return false;
  const b = board as Record<string, unknown>;
  if (!Array.isArray(b.columns) || typeof b.cards !== "object" || !b.cards) return false;
  const ids = b.columns.map((c: { id?: string }) => c.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_COLUMN_IDS)) return false;
  const cards = b.cards as Record<string, unknown>;
  for (const col of b.columns as { cardIds?: string[] }[]) {
    if (!Array.isArray(col.cardIds)) return false;
    for (const cardId of col.cardIds) {
      if (!(cardId in cards)) return false;
    }
  }
  return true;
}

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [boardError, setBoardError] = useState<string>("");
  const [chatError, setChatError] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatItem[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);

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
        const nextBoard = await fetchBoard();
        if (!isMounted) {
          return;
        }
        setBoard(nextBoard);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setBoard(initialData);
        setBoardError(
          err instanceof Error ? err.message : "Failed to load board"
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const cardsById = useMemo(() => board?.cards ?? {}, [board]);

  const persistBoard = useCallback(async (nextBoard: BoardData) => {
    try {
      await saveBoard(nextBoard);
      setBoardError("");
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : "Failed to save board");
    }
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!board || !over || active.id === over.id) {
      return;
    }

    setBoard((prev) => {
      if (!prev) {
        return prev;
      }

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
        if (!prev) {
          return prev;
        }

        const nextBoard = {
          ...prev,
          columns: prev.columns.map((column) =>
            column.id === columnId ? { ...column, title } : column
          ),
        };

        if (renameTimerRef.current) {
          clearTimeout(renameTimerRef.current);
        }
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
      if (!prev) {
        return prev;
      }

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
      if (!prev) {
        return prev;
      }

      const nextBoard = {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
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
      const response = await sendChatMessage(message);
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
          <div className="flex items-center gap-6">
            <div>
              <h1 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
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
        </header>

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_280px]">
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid min-w-0 gap-3 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
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
    </div>
  );
};
