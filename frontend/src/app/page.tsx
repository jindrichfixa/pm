"use client";

import { FormEvent, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { getStoredAuth, isValidCredentials, setStoredAuth } from "@/lib/auth";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setIsAuthenticated(getStoredAuth());
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidCredentials(username.trim(), password)) {
      setError("Invalid credentials");
      return;
    }

    setStoredAuth(true);
    setIsAuthenticated(true);
    setUsername("");
    setPassword("");
    setError("");
  };

  const handleLogout = () => {
    setStoredAuth(false);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[440px] items-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Project Management MVP
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--gray-text)]">
            Use the demo credentials to continue.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">
                Username
              </label>
              <input
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                aria-label="Username"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                aria-label="Password"
                required
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-[var(--secondary-purple)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Sign in
            </button>

            <p className="text-xs text-[var(--gray-text)]">
              Demo credentials: <span className="font-semibold">user</span> /{" "}
              <span className="font-semibold">password</span>
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div>
      <header className="border-b border-[var(--stroke)] bg-white/80 px-6 py-2 backdrop-blur 2xl:px-10">
        <div className="flex w-full items-center justify-between">
          <p className="text-xs font-medium text-[var(--gray-text)]">Signed in as <span className="font-semibold text-[var(--navy-dark)]">user</span></p>
          <button
            type="button"
            onClick={handleLogout}
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
      </header>
      <KanbanBoard />
    </div>
  );
}
