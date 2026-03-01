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

export type CardComment = {
  id: number;
  card_id: string;
  content: string;
  created_at: string;
  username: string;
  display_name: string;
};

async function apiRequest<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { detail?: string };
      message = payload.detail || message;
    } catch { /* use default message */ }
    throw new Error(message);
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function authGet<T>(url: string): Promise<T> {
  return apiRequest<T>(url, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
  });
}

function authPost<T>(url: string, body: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
}

function authPut<T>(url: string, body: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
}

function authPatch<T>(url: string, body: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
}

function authDelete(url: string): Promise<void> {
  return apiRequest<void>(url, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
}

// --- Auth ---

export function loginUser(username: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function registerUser(username: string, password: string, displayName: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, display_name: displayName }),
  });
}

// --- Board CRUD ---

export function listBoards(): Promise<BoardMeta[]> {
  return authGet<BoardMeta[]>("/api/boards");
}

export function createBoard(name: string, description: string = ""): Promise<{ id: number; name: string; description: string }> {
  return authPost("/api/boards", { name, description });
}

export function fetchBoardById(boardId: number): Promise<BoardDetail> {
  return authGet<BoardDetail>(`/api/boards/${boardId}`);
}

export function saveBoardById(boardId: number, board: BoardData): Promise<void> {
  return authPut(`/api/boards/${boardId}`, board);
}

export function updateBoardMeta(boardId: number, name: string, description: string): Promise<void> {
  return authPatch(`/api/boards/${boardId}/meta`, { name, description });
}

export function deleteBoard(boardId: number): Promise<void> {
  return authDelete(`/api/boards/${boardId}`);
}

export function sendChatMessageToBoard(boardId: number, message: string): Promise<ChatResponse> {
  return authPost<ChatResponse>(`/api/boards/${boardId}/chat`, { message });
}

// --- Card comments ---

export function getCardComments(boardId: number, cardId: string): Promise<CardComment[]> {
  return authGet<CardComment[]>(`/api/boards/${boardId}/cards/${cardId}/comments`);
}

export function addCardComment(boardId: number, cardId: string, content: string): Promise<CardComment> {
  return authPost<CardComment>(`/api/boards/${boardId}/cards/${cardId}/comments`, { content });
}

export function deleteCardComment(boardId: number, cardId: string, commentId: number): Promise<void> {
  return authDelete(`/api/boards/${boardId}/cards/${cardId}/comments/${commentId}`);
}

// --- Profile management ---

export function updateProfile(displayName: string): Promise<{ id: number; username: string; display_name: string }> {
  return authPatch("/api/auth/profile", { display_name: displayName });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return authPost("/api/auth/change-password", { current_password: currentPassword, new_password: newPassword });
}

// --- Legacy endpoints ---

export function fetchBoard(): Promise<BoardData> {
  return authGet<BoardData>("/api/board");
}

export function saveBoard(board: BoardData): Promise<void> {
  return authPut("/api/board", board);
}

export function sendChatMessage(message: string): Promise<ChatResponse> {
  return authPost<ChatResponse>("/api/chat", { message });
}
