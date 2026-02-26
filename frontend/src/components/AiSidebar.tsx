"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

export type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AiSidebarProps = {
  messages: ChatItem[];
  isSending: boolean;
  error: string;
  onSend: (message: string) => Promise<void>;
};

export const AiSidebar = ({ messages, isSending, error, onSend }: AiSidebarProps) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    setInput("");
    await onSend(trimmed);
  };

  return (
    <aside className="h-full rounded-3xl border border-[var(--stroke)] bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between border-b border-[var(--stroke)] pb-3">
        <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">AI Assistant</h2>
        <span className="rounded-full bg-[var(--primary-blue)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-blue)]">
          MVP
        </span>
      </div>

      <div className="mt-4 flex h-[420px] flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--stroke)] px-3 py-3 text-xs text-[var(--gray-text)]">
            Ask the assistant to create, edit, or move cards.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[92%] rounded-2xl bg-[var(--primary-blue)] px-3 py-2 text-sm text-white"
                  : "mr-auto max-w-[92%] rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)]"
              }
            >
              {message.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-[var(--secondary-purple)]">
          {error}
        </p>
      ) : null}

      <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
        <input
          aria-label="AI message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask AI to update your board"
          className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
          disabled={isSending}
        />
        <button
          type="submit"
          className="rounded-xl bg-[var(--secondary-purple)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSending}
        >
          {isSending ? "Sending" : "Send"}
        </button>
      </form>
    </aside>
  );
};
