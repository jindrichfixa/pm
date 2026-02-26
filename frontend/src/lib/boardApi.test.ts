import {
  fetchBoard,
  saveBoard,
  sendChatMessage,
  loginUser,
  registerUser,
  listBoards,
  createBoard,
  fetchBoardById,
  saveBoardById,
  deleteBoard,
  sendChatMessageToBoard,
} from "@/lib/boardApi";
import { initialData } from "@/lib/kanban";

describe("boardApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // --- Auth ---

  it("loginUser sends credentials and returns token", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ token: "jwt-token", user: { id: 1, username: "alice", display_name: "Alice" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await loginUser("alice", "pass123");
    expect(result.token).toBe("jwt-token");
    expect(result.user.username).toBe("alice");
    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("loginUser throws on failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Invalid credentials" }), { status: 401 })
    );
    await expect(loginUser("alice", "wrong")).rejects.toThrow("Invalid credentials");
  });

  it("registerUser sends registration data", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ token: "jwt-token", user: { id: 2, username: "bob", display_name: "Bob" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await registerUser("bob", "pass123", "Bob");
    expect(result.token).toBe("jwt-token");
    expect(result.user.username).toBe("bob");
  });

  // --- Board CRUD ---

  it("listBoards returns board list", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 1, name: "Board 1" }]), { status: 200 })
    );

    const boards = await listBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].name).toBe("Board 1");
  });

  it("createBoard sends name and returns id", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 5, name: "New", description: "" }), { status: 201 })
    );

    const result = await createBoard("New");
    expect(result.id).toBe(5);
  });

  it("fetchBoardById returns board detail", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 1, name: "Test", description: "", version: 1, board: initialData }),
        { status: 200 }
      )
    );

    const result = await fetchBoardById(1);
    expect(result.board.columns).toHaveLength(5);
  });

  it("saveBoardById sends PUT request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })
    );

    await saveBoardById(1, initialData);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/boards/1",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("deleteBoard sends DELETE request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })
    );

    await deleteBoard(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/boards/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("sendChatMessageToBoard sends POST to board-specific endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ assistant_message: "Done", board_update: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await sendChatMessageToBoard(1, "help me");
    expect(response.assistant_message).toBe("Done");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/boards/1/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  // --- Legacy endpoints ---

  it("fetches board data (legacy)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    const board = await fetchBoard();
    expect(board.columns).toHaveLength(5);
  });

  it("throws on fetch failure (legacy)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Board not found" }), { status: 404 })
    );

    await expect(fetchBoard()).rejects.toThrow("Board not found");
  });

  it("saves board data (legacy)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })
    );

    await saveBoard(initialData);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("sends chat message (legacy)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ assistant_message: "Done", board_update: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await sendChatMessage("help me");
    expect(response.assistant_message).toBe("Done");
  });

  it("throws on saveBoard failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Validation error" }), { status: 422 })
    );

    await expect(saveBoard(initialData)).rejects.toThrow("Validation error");
  });
});
