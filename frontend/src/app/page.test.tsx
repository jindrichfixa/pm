import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

function mockFetch() {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/auth/login" && method === "POST") {
      const body = JSON.parse(init?.body as string);
      if (body.username === "user" && body.password === "password") {
        return new Response(
          JSON.stringify({
            token: "test-jwt-token",
            user: { id: 1, username: "user", display_name: "Demo User" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ detail: "Invalid credentials" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url === "/api/auth/register" && method === "POST") {
      return new Response(
        JSON.stringify({
          token: "test-jwt-token",
          user: { id: 2, username: "newuser", display_name: "New User" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url === "/api/boards" && method === "GET") {
      return new Response(
        JSON.stringify([
          { id: 1, name: "Test Board", description: "", version: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
  });
}

describe("Home auth flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows login form when unauthenticated", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("rejects invalid credentials", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText(/username/i), "user");
    await user.type(screen.getByLabelText(/password/i), "bad");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
  });

  it("logs in and shows dashboard", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText(/username/i), "user");
    await user.type(screen.getByLabelText(/password/i), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/your boards/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("logs out from dashboard", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText(/username/i), "user");
    await user.type(screen.getByLabelText(/password/i), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByText(/your boards/i);
    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("restores session from localStorage", async () => {
    window.localStorage.setItem("pm-auth-token", "stored-jwt");
    window.localStorage.setItem("pm-auth-user", JSON.stringify({ id: 1, username: "user", display_name: "Demo User" }));
    render(<Home />);

    expect(await screen.findByText(/your boards/i)).toBeInTheDocument();
  });

  it("shows register form when toggled", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByText(/need an account/i));
    expect(screen.getByRole("heading", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
  });
});
