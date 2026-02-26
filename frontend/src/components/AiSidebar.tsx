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
    <aside className="flex h-full flex-col rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-[0_4px_16px_rgba(3,33,71,0.06)]">
      <div className="flex items-center justify-between border-b border-[var(--stroke)] pb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a8 8 0 0 1 8 8c0 3-1.5 5.2-3.5 6.8L12 22l-4.5-5.2C5.5 15.2 4 13 4 10a8 8 0 0 1 8-8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <h2 className="text-sm font-semibold text-[var(--navy-dark)]">AI Assistant</h2>
        </div>
        <span className="rounded-full bg-[var(--primary-blue)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-blue)]">
          MVP
        </span>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--stroke)] px-3 py-3 text-[11px] leading-4 text-[var(--gray-text)]">
            Ask the assistant to create, edit, or move cards.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[92%] rounded-xl bg-[var(--primary-blue)] px-3 py-2 text-xs leading-4 text-white"
                  : "mr-auto max-w-[92%] rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-xs leading-4 text-[var(--navy-dark)]"
              }
            >
              {message.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[10px] font-medium text-[var(--secondary-purple)]">
          {error}
        </p>
      ) : null}

      <form className="mt-3 flex gap-1.5" onSubmit={handleSubmit}>
        <input
          aria-label="AI message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask AI to update your board"
          className="w-full rounded-lg border border-[var(--stroke)] px-2.5 py-1.5 text-xs outline-none transition focus:border-[var(--primary-blue)]"
          disabled={isSending}
        />
        <button
          type="submit"
          className="flex shrink-0 items-center justify-center rounded-lg bg-[var(--secondary-purple)] px-2.5 py-1.5 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSending}
          aria-label={isSending ? "Sending" : "Send"}
        >
          {isSending ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
              <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>
    </aside>
  );
};
