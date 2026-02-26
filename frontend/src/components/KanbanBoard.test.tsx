import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { cloneInitialData } from "@/test/helpers";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
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
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/chat" && method === "POST") {
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
                "card-1": {
                  id: "card-1",
                  title: "AI Card",
                  details: "Generated",
                },
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders five columns", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<KanbanBoard />);
    await screen.findByTestId("column-col-backlog");
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await user.clear(input);
    await user.type(input, "New Name");
    expect(input).toHaveValue("New Name");

    // Advance past the 500ms debounce
    await vi.advanceTimersByTimeAsync(600);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({ method: "PUT" })
    );
    vi.useRealTimers();
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    await screen.findByTestId("column-col-backlog");
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("sends a chat message and applies AI board update", async () => {
    render(<KanbanBoard />);

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

    render(<KanbanBoard />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
  });

  it("shows error when saveBoard fails", async () => {
    let putCallCount = 0;
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
        putCallCount++;
        return new Response(JSON.stringify({ detail: "Save failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
    });

    render(<KanbanBoard />);
    await screen.findByTestId("column-col-backlog");

    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Fail card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
  });

  it("shows error when sendChatMessage fails", async () => {
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

      if (url === "/api/chat" && method === "POST") {
        return new Response(JSON.stringify({ detail: "AI unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
    });

    render(<KanbanBoard />);
    await screen.findByTestId("column-col-backlog");

    await userEvent.type(screen.getByLabelText(/ai message/i), "hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("AI unavailable")).toBeInTheDocument();
  });
});
