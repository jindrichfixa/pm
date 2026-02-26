import type { BoardData } from "@/lib/kanban";
import { getAuthHeaders } from "@/lib/auth";

export type ChatResponse = {
  assistant_message: string;
  board_update: BoardData | null;
};

export type BoardMeta = {
  id: number;
  name: string;
  description: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type BoardDetail = {
  id: number;
  name: string;
  description: string;
  version: number;
  board: BoardData;
};

export type AuthResponse = {
  token: string;
  user: { id: number; username: string; display_name: string };
};

const getErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail || "Request failed";
  } catch {
    return "Request failed";
  }
};

// --- Auth ---

export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AuthResponse;
};

export const registerUser = async (
  username: string,
  password: string,
  displayName: string
): Promise<AuthResponse> => {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, display_name: displayName }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as AuthResponse;
};

// --- Board CRUD ---

export const listBoards = async (): Promise<BoardMeta[]> => {
  const response = await fetch("/api/boards", {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as BoardMeta[];
};

export const createBoard = async (name: string, description: string = ""): Promise<{ id: number; name: string; description: string }> => {
  const response = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as { id: number; name: string; description: string };
};

export const fetchBoardById = async (boardId: number): Promise<BoardDetail> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as BoardDetail;
};

export const saveBoardById = async (boardId: number, board: BoardData): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
    body: JSON.stringify(board),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

export const updateBoardMeta = async (boardId: number, name: string, description: string): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}/meta`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

export const deleteBoard = async (boardId: number): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

export const sendChatMessageToBoard = async (boardId: number, message: string): Promise<ChatResponse> => {
  const response = await fetch(`/api/boards/${boardId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as ChatResponse;
};

// --- Card comments ---

export type CardComment = {
  id: number;
  card_id: string;
  content: string;
  created_at: string;
  username: string;
  display_name: string;
};

export const getCardComments = async (boardId: number, cardId: string): Promise<CardComment[]> => {
  const response = await fetch(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as CardComment[];
};

export const addCardComment = async (boardId: number, cardId: string, content: string): Promise<CardComment> => {
  const response = await fetch(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as CardComment;
};

export const deleteCardComment = async (boardId: number, cardId: string, commentId: number): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}/cards/${cardId}/comments/${commentId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

// --- Profile management ---

export const updateProfile = async (displayName: string): Promise<{ id: number; username: string; display_name: string }> => {
  const response = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ display_name: displayName }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as { id: number; username: string; display_name: string };
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

// --- Legacy endpoints (still used during transition) ---

export const fetchBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board", {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as BoardData;
};

export const saveBoard = async (board: BoardData): Promise<void> => {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
    body: JSON.stringify(board),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};

export const sendChatMessage = async (message: string): Promise<ChatResponse> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as ChatResponse;
};
