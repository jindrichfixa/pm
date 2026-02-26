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
  updateProfile,
  changePassword,
  getCardComments,
  addCardComment,
  deleteCardComment,
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

  // --- Card comments ---

  it("getCardComments returns comment list", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ id: 1, card_id: "card-1", content: "Test", created_at: "2026-01-01", username: "user", display_name: "User" }]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const comments = await getCardComments(1, "card-1");
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe("Test");
  });

  it("addCardComment sends POST and returns comment", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 2, card_id: "card-1", content: "New comment", created_at: "2026-01-01", username: "user", display_name: "User" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    const comment = await addCardComment(1, "card-1", "New comment");
    expect(comment.content).toBe("New comment");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/boards/1/cards/card-1/comments",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("deleteCardComment sends DELETE", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })
    );

    await deleteCardComment(1, "card-1", 5);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/boards/1/cards/card-1/comments/5",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  // --- Profile management ---

  it("updateProfile sends PATCH and returns updated user", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 1, username: "alice", display_name: "New Name" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await updateProfile("New Name");
    expect(result.display_name).toBe("New Name");
  });

  it("changePassword sends POST and resolves on success", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })
    );

    await changePassword("oldpass", "newpass");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("changePassword throws on wrong current password", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Current password is incorrect" }), { status: 400 })
    );

    await expect(changePassword("wrong", "newpass")).rejects.toThrow("Current password is incorrect");
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
