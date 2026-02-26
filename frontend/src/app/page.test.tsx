import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { cloneInitialData } from "@/test/helpers";

describe("Home auth flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/board" && method === "GET") {
        return new Response(JSON.stringify(cloneInitialData()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/board" && method === "PUT") {
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }

      return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows login form when unauthenticated", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /kanban studio/i })).not.toBeInTheDocument();
  });

  it("rejects invalid credentials", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText(/username/i), "user");
    await user.type(screen.getByLabelText(/password/i), "bad");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/invalid credentials/i);
    expect(screen.queryByRole("heading", { name: /kanban studio/i })).not.toBeInTheDocument();
  });

  it("logs in and logs out with valid credentials", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText(/username/i), "user");
    await user.type(screen.getByLabelText(/password/i), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("heading", { name: /kanban studio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });

  it("restores session from localStorage", async () => {
    window.localStorage.setItem("pm-authenticated", "true");
    render(<Home />);

    expect(await screen.findByRole("heading", { name: /kanban studio/i })).toBeInTheDocument();
  });
});
