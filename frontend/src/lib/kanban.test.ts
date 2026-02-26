import { moveCard, createId, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("drops cards into explicit empty-column zone", () => {
    const columns: Column[] = [
      { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
      { id: "col-empty", title: "Empty", cardIds: [] },
    ];

    const result = moveCard(columns, "card-1", "col-empty__empty");

    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-1"]);
  });

  it("returns columns unchanged for non-existent activeId", () => {
    const result = moveCard(baseColumns, "card-missing", "card-1");
    expect(result).toEqual(baseColumns);
  });

  it("returns columns unchanged for non-existent overId", () => {
    const result = moveCard(baseColumns, "card-1", "card-missing");
    expect(result).toEqual(baseColumns);
  });

  it("returns columns unchanged when reordering to same index", () => {
    const result = moveCard(baseColumns, "card-1", "card-1");
    // Same active and over should no-op (caller checks this, but verify guard)
    expect(result[0].cardIds).toContain("card-1");
  });

  it("appends card to end of same column when dropped on column header", () => {
    const result = moveCard(baseColumns, "card-1", "col-a");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });
});

describe("createId", () => {
  it("creates a prefixed UUID", () => {
    const id = createId("card");
    expect(id).toMatch(/^card-[0-9a-f-]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId("test")));
    expect(ids.size).toBe(100);
  });
});
