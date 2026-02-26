import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { cloneInitialData } from "@/test/helpers";

const defaultProps = {
  boardId: 1,
  boardName: "Test Board",
  onBack: vi.fn(),
};

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

function mockApis() {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/boards/1" && method === "GET") {
      return new Response(
        JSON.stringify({
          id: 1,
          name: "Test Board",
          description: "",
          version: 1,
          board: cloneInitialData(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url === "/api/boards/1" && method === "PUT") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    if (url === "/api/boards/1/chat" && method === "POST") {
      return new Response(
        JSON.stringify({
          assistant_message: "AI updated board",
          board_update: {
            columns: [
              { id: "col-backlog", title: "Backlog", cardIds: ["card-1"] },
              { id: "col-discovery", title: "Discovery", cardIds: [] },
              { id: "col-progress", title: "In Progress", cardIds: [] },
              { id: "col-review", title: "Review", cardIds: [] },
              { id: "col-done", title: "Done", cardIds: [] },
            ],
            cards: {
              "card-1": { id: "card-1", title: "AI Card", details: "Generated" },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
  });
}

describe("KanbanBoard", () => {
  beforeEach(() => {
    mockApis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders five columns", async () => {
    render(<KanbanBoard {...defaultProps} />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("shows board name in header", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");
    expect(screen.getByText("Test Board")).toBeInTheDocument();
  });

  it("has back button that calls onBack", async () => {
    const onBack = vi.fn();
    render(<KanbanBoard {...defaultProps} onBack={onBack} />);
    await screen.findByTestId("column-col-backlog");

    await userEvent.click(screen.getByLabelText(/back to boards/i));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renames a column", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await user.clear(input);
    await user.type(input, "New Name");
    expect(input).toHaveValue("New Name");

    await vi.advanceTimersByTimeAsync(600);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/boards/1",
      expect.objectContaining({ method: "PUT" })
    );
    vi.useRealTimers();
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", { name: /add a card/i });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));
    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", { name: /delete new card/i });
    await userEvent.click(deleteButton);
    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("sends a chat message and applies AI board update", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");

    await userEvent.type(screen.getByLabelText(/ai message/i), "Please update board");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("AI updated board")).toBeInTheDocument();
    expect(await screen.findByText("AI Card")).toBeInTheDocument();
  });

  it("shows error when fetchBoard fails", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ detail: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    render(<KanbanBoard {...defaultProps} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
  });

  it("shows error when saveBoard fails", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/boards/1" && method === "GET") {
        return new Response(
          JSON.stringify({
            id: 1, name: "Test Board", description: "", version: 1,
            board: cloneInitialData(),
          }),
          { status: 200 }
        );
      }

      if (url === "/api/boards/1" && method === "PUT") {
        return new Response(JSON.stringify({ detail: "Save failed" }), { status: 500 });
      }

      return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
    });

    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");

    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Fail card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
  });

  it("adds a new column", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");

    const initialColumns = screen.getAllByTestId(/^column-/);
    expect(initialColumns).toHaveLength(5);

    await userEvent.click(screen.getByLabelText(/add column/i));
    expect(screen.getAllByTestId(/^column-/)).toHaveLength(6);
  });

  it("deletes a column via delete button", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");

    const deleteButtons = screen.getAllByLabelText(/delete column/i);
    expect(deleteButtons.length).toBeGreaterThan(0);

    await userEvent.click(deleteButtons[0]);
    expect(screen.getAllByTestId(/^column-/)).toHaveLength(4);
  });

  it("filters cards by search query", async () => {
    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");

    // Initially shows all cards
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
    expect(screen.getByText("Gather customer signals")).toBeInTheDocument();

    // Search for a specific card
    const searchInput = screen.getByLabelText(/search cards/i);
    await userEvent.type(searchInput, "roadmap");

    // Should show matching card
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
    // Should hide non-matching cards
    expect(screen.queryByText("Gather customer signals")).not.toBeInTheDocument();

    // Clear filter shows all cards again
    await userEvent.click(screen.getByText("Clear"));
    expect(screen.getByText("Gather customer signals")).toBeInTheDocument();
  });

  it("filters cards by priority", async () => {
    // Mock a board with priority cards
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/boards/1" && method === "GET") {
        return new Response(
          JSON.stringify({
            id: 1, name: "Test Board", description: "", version: 1,
            board: {
              columns: [
                { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
              ],
              cards: {
                "card-1": { id: "card-1", title: "High priority task", details: "Urgent", priority: "high" },
                "card-2": { id: "card-2", title: "Low priority task", details: "Later", priority: "low" },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });

    render(<KanbanBoard {...defaultProps} />);
    await screen.findByText("High priority task");

    // Both cards visible initially
    expect(screen.getByText("High priority task")).toBeInTheDocument();
    expect(screen.getByText("Low priority task")).toBeInTheDocument();

    // Filter to high priority
    await userEvent.selectOptions(screen.getByLabelText(/filter by priority/i), "high");

    expect(screen.getByText("High priority task")).toBeInTheDocument();
    expect(screen.queryByText("Low priority task")).not.toBeInTheDocument();
  });

  it("shows error when chat message fails", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/boards/1" && method === "GET") {
        return new Response(
          JSON.stringify({
            id: 1, name: "Test Board", description: "", version: 1,
            board: cloneInitialData(),
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/chat") && method === "POST") {
        return new Response(JSON.stringify({ detail: "AI unavailable" }), { status: 503 });
      }

      return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
    });

    render(<KanbanBoard {...defaultProps} />);
    await screen.findByTestId("column-col-backlog");

    await userEvent.type(screen.getByLabelText(/ai message/i), "hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("AI unavailable")).toBeInTheDocument();
  });
});
