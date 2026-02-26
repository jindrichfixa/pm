import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanCard } from "@/components/KanbanCard";

// Mock @dnd-kit/sortable
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

const mockCard = {
  id: "card-1",
  title: "Test Card",
  details: "Some details",
  priority: "high" as const,
  due_date: "2026-03-15",
  labels: ["frontend"],
};

describe("KanbanCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders card title and details", () => {
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} />);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Some details")).toBeInTheDocument();
  });

  it("shows priority badge", () => {
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} />);
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("shows due date", () => {
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} />);
    expect(screen.getByText("2026-03-15")).toBeInTheDocument();
  });

  it("shows labels", () => {
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} />);
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    render(<KanbanCard card={mockCard} onDelete={onDelete} />);
    await userEvent.click(screen.getByLabelText(/delete test card/i));
    expect(onDelete).toHaveBeenCalledWith("card-1");
  });

  it("enters edit mode when edit button clicked", async () => {
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/edit test card/i));

    // Edit mode shows input fields
    expect(screen.getByLabelText("Card title")).toHaveValue("Test Card");
    expect(screen.getByLabelText("Card details")).toHaveValue("Some details");
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
  });

  it("saves changes in edit mode", async () => {
    const onUpdate = vi.fn();
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByLabelText(/edit test card/i));

    const titleInput = screen.getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated Title");
    await userEvent.click(screen.getByText("Save"));

    expect(onUpdate).toHaveBeenCalledWith("card-1", expect.objectContaining({
      title: "Updated Title",
    }));
  });

  it("cancels edit mode", async () => {
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/edit test card/i));

    const titleInput = screen.getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Changed");
    await userEvent.click(screen.getByText("Cancel"));

    // Should go back to display mode with original title
    expect(screen.getByText("Test Card")).toBeInTheDocument();
  });

  it("calls onOpenDetail when view button clicked", async () => {
    const onOpenDetail = vi.fn();
    render(<KanbanCard card={mockCard} onDelete={vi.fn()} onOpenDetail={onOpenDetail} />);
    await userEvent.click(screen.getByLabelText(/view test card/i));
    expect(onOpenDetail).toHaveBeenCalledWith("card-1");
  });

  it("hides details text 'No details yet.'", () => {
    const card = { ...mockCard, details: "No details yet." };
    render(<KanbanCard card={card} onDelete={vi.fn()} />);
    expect(screen.queryByText("No details yet.")).not.toBeInTheDocument();
  });
});
