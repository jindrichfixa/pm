import { fetchBoard, saveBoard, sendChatMessage } from "@/lib/boardApi";
import { initialData } from "@/lib/kanban";

describe("boardApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches board data", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(initialData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const board = await fetchBoard();
    expect(board.columns).toHaveLength(5);
    expect(board.cards["card-1"].title).toBe("Align roadmap themes");
  });

  it("throws on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Board not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchBoard()).rejects.toThrow("Board not found");
  });

  it("saves board data", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

    await saveBoard(initialData);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("sends chat message", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          assistant_message: "Done",
          board_update: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const response = await sendChatMessage("help me");

    expect(response.assistant_message).toBe("Done");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on saveBoard failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Validation error" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(saveBoard(initialData)).rejects.toThrow("Validation error");
  });

  it("throws on sendChatMessage failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "AI unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(sendChatMessage("hello")).rejects.toThrow("AI unavailable");
  });
});
