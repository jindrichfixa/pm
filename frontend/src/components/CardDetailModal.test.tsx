import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardDetailModal } from "@/components/CardDetailModal";

const mockCard = {
  id: "card-1",
  title: "Test Card",
  details: "Card description here",
  priority: "high" as const,
  due_date: "2026-03-15",
  labels: ["frontend", "urgent"],
};

const defaultProps = {
  boardId: 1,
  card: mockCard,
  columnTitle: "Backlog",
  onClose: vi.fn(),
  onUpdateCard: vi.fn(),
};

function mockCommentApis(comments: unknown[] = []) {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/comments") && method === "GET") {
      return new Response(JSON.stringify(comments), { status: 200 });
    }
    if (url.includes("/comments") && method === "POST") {
      const body = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 1,
          card_id: "card-1",
          content: body.content,
          created_at: "2026-02-27T10:00:00",
          username: "user",
          display_name: "Demo User",
        }),
        { status: 201 }
      );
    }
    if (url.includes("/comments") && method === "DELETE") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
  });
}

describe("CardDetailModal", () => {
  beforeEach(() => {
    mockCommentApis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders card title and details", async () => {
    render(<CardDetailModal {...defaultProps} />);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Card description here")).toBeInTheDocument();
  });

  it("shows column title", async () => {
    render(<CardDetailModal {...defaultProps} />);
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });

  it("shows priority badge", async () => {
    render(<CardDetailModal {...defaultProps} />);
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("shows due date", async () => {
    render(<CardDetailModal {...defaultProps} />);
    expect(screen.getByText("Due: 2026-03-15")).toBeInTheDocument();
  });

  it("shows labels", async () => {
    render(<CardDetailModal {...defaultProps} />);
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(<CardDetailModal {...defaultProps} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText(/close card detail/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows no comments initially", async () => {
    render(<CardDetailModal {...defaultProps} />);
    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it("loads and displays existing comments", async () => {
    mockCommentApis([
      { id: 1, card_id: "card-1", content: "Great work!", created_at: "2026-01-01T10:00:00", username: "user", display_name: "Demo User" },
    ]);

    render(<CardDetailModal {...defaultProps} />);
    expect(await screen.findByText("Great work!")).toBeInTheDocument();
  });

  it("adds a new comment", async () => {
    render(<CardDetailModal {...defaultProps} />);
    await screen.findByText(/no comments yet/i);

    await userEvent.type(screen.getByLabelText(/comment/i), "New comment text");
    await userEvent.click(screen.getByRole("button", { name: /post/i }));

    expect(await screen.findByText("New comment text")).toBeInTheDocument();
  });

  it("edits title on click", async () => {
    const onUpdateCard = vi.fn();
    render(<CardDetailModal {...defaultProps} onUpdateCard={onUpdateCard} />);
    await screen.findByText(/no comments yet/i);

    // Click title to edit
    await userEvent.click(screen.getByText("Test Card"));
    const input = screen.getByLabelText("Card title");
    await userEvent.clear(input);
    await userEvent.type(input, "Updated Title");
    await userEvent.tab(); // blur to save

    expect(onUpdateCard).toHaveBeenCalledWith("card-1", { title: "Updated Title" });
  });
});
