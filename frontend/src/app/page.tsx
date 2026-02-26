"use client";

import { FormEvent, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { BoardDashboard } from "@/components/BoardDashboard";
import {
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  type AuthUser,
} from "@/lib/auth";
import { loginUser, registerUser } from "@/lib/boardApi";

type View =
  | { type: "login" }
  | { type: "dashboard" }
  | { type: "board"; boardId: number; boardName: string };

export default function Home() {
  const [view, setView] = useState<View>({ type: "login" });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      setUser(storedUser);
      setView({ type: "dashboard" });
    }
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await loginUser(username.trim(), password);
      setStoredAuth(result.token, result.user as AuthUser);
      setUser(result.user as AuthUser);
      setUsername("");
      setPassword("");
      setView({ type: "dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await registerUser(
        username.trim(),
        password,
        displayName.trim() || username.trim()
      );
      setStoredAuth(result.token, result.user as AuthUser);
      setUser(result.user as AuthUser);
      setUsername("");
      setPassword("");
      setDisplayName("");
      setView({ type: "dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setStoredAuth(null, null);
    setUser(null);
    setView({ type: "login" });
  };

  if (view.type === "login") {
    return (
      <main className="mx-auto flex min-h-screen max-w-[440px] items-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Project Management
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            {isRegistering ? "Create account" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm text-[var(--gray-text)]">
            {isRegistering
              ? "Register a new account to get started."
              : "Sign in to manage your boards."}
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={isRegistering ? handleRegister : handleLogin}
          >
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
                minLength={2}
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
                autoComplete={isRegistering ? "new-password" : "current-password"}
                aria-label="Password"
                required
                minLength={4}
              />
            </div>

            {isRegistering && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gray-text)]">
                  Display Name (optional)
                </label>
                <input
                  className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  aria-label="Display name"
                  maxLength={100}
                />
              </div>
            )}

            {error ? (
              <p role="alert" className="text-sm font-medium text-[var(--secondary-purple)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-70"
            >
              {isSubmitting
                ? "Please wait..."
                : isRegistering
                  ? "Create Account"
                  : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              className="w-full text-center text-xs text-[var(--primary-blue)] hover:underline"
            >
              {isRegistering
                ? "Already have an account? Sign in"
                : "Need an account? Register"}
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

  if (view.type === "board") {
    return (
      <div>
        <header className="border-b border-[var(--stroke)] bg-white/80 px-6 py-2 backdrop-blur 2xl:px-10">
          <div className="flex w-full items-center justify-between">
            <p className="text-xs font-medium text-[var(--gray-text)]">
              Signed in as{" "}
              <span className="font-semibold text-[var(--navy-dark)]">
                {user?.display_name || user?.username || "user"}
              </span>
            </p>
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
        <KanbanBoard
          boardId={view.boardId}
          boardName={view.boardName}
          onBack={() => setView({ type: "dashboard" })}
        />
      </div>
    );
  }

  // Dashboard view
  return (
    <BoardDashboard
      displayName={user?.display_name || user?.username || "user"}
      onLogout={handleLogout}
      onSelectBoard={(boardId) => {
        // We need to get board name for display - just use a placeholder, the board component will load its own data
        setView({ type: "board", boardId, boardName: "Loading..." });
      }}
    />
  );
}
