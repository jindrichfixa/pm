import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardDashboard } from "@/components/BoardDashboard";

const defaultProps = {
  onSelectBoard: vi.fn(),
  onLogout: vi.fn(),
  displayName: "Demo User",
  username: "user",
  onDisplayNameChange: vi.fn(),
};

function mockListBoards(boards = [
  { id: 1, name: "Board One", description: "First board", version: 1, created_at: "2026-01-01", updated_at: "2026-01-15" },
  { id: 2, name: "Board Two", description: "", version: 1, created_at: "2026-01-02", updated_at: "2026-01-10" },
]) {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/boards" && method === "GET") {
      return new Response(JSON.stringify(boards), { status: 200 });
    }
    if (url === "/api/boards" && method === "POST") {
      return new Response(
        JSON.stringify({ id: 99, name: "New Board", description: "" }),
        { status: 201 }
      );
    }
    if (url.match(/\/api\/boards\/\d+$/) && method === "DELETE") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
  });
}

describe("BoardDashboard", () => {
  beforeEach(() => {
    mockListBoards();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders board list", async () => {
    render(<BoardDashboard {...defaultProps} />);
    expect(await screen.findByText("Board One")).toBeInTheDocument();
    expect(screen.getByText("Board Two")).toBeInTheDocument();
  });

  it("shows display name", async () => {
    render(<BoardDashboard {...defaultProps} />);
    await screen.findByText("Board One");
    expect(screen.getByText("Demo User")).toBeInTheDocument();
  });

  it("calls onSelectBoard when clicking a board", async () => {
    const onSelectBoard = vi.fn();
    render(<BoardDashboard {...defaultProps} onSelectBoard={onSelectBoard} />);
    await screen.findByText("Board One");

    await userEvent.click(screen.getByTestId("board-card-1"));
    expect(onSelectBoard).toHaveBeenCalledWith(1);
  });

  it("calls onLogout when clicking log out", async () => {
    const onLogout = vi.fn();
    render(<BoardDashboard {...defaultProps} onLogout={onLogout} />);
    await screen.findByText("Board One");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("shows create board form", async () => {
    render(<BoardDashboard {...defaultProps} />);
    await screen.findByText("Board One");

    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    expect(screen.getByText("Create New Board")).toBeInTheDocument();
  });

  it("creates a new board", async () => {
    const onSelectBoard = vi.fn();
    render(<BoardDashboard {...defaultProps} onSelectBoard={onSelectBoard} />);
    await screen.findByText("Board One");

    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    await userEvent.type(screen.getByPlaceholderText(/sprint 4/i), "Sprint Board");
    await userEvent.click(screen.getByRole("button", { name: /create board/i }));

    expect(onSelectBoard).toHaveBeenCalledWith(99);
  });

  it("shows empty state when no boards", async () => {
    mockListBoards([]);
    render(<BoardDashboard {...defaultProps} />);
    expect(await screen.findByText(/no boards yet/i)).toBeInTheDocument();
  });

  it("opens profile settings modal", async () => {
    render(<BoardDashboard {...defaultProps} />);
    await screen.findByText("Board One");

    await userEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(screen.getByText("Profile Settings")).toBeInTheDocument();
  });

  it("deletes a board after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BoardDashboard {...defaultProps} />);
    await screen.findByText("Board One");

    const boardCard = screen.getByTestId("board-card-1");
    const deleteBtn = within(boardCard).getByLabelText(/delete board one/i);
    await userEvent.click(deleteBtn);

    expect(screen.queryByText("Board One")).not.toBeInTheDocument();
  });
});
