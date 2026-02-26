import { describe, it, expect, beforeEach } from "vitest";
import {
  AUTH_STORAGE_KEY,
  USER_STORAGE_KEY,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  isAuthenticated,
  getAuthHeaders,
} from "@/lib/auth";

describe("auth helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores and retrieves token", () => {
    setStoredAuth("test-token", { id: 1, username: "alice", display_name: "Alice" });
    expect(getStoredToken()).toBe("test-token");
  });

  it("stores and retrieves user", () => {
    setStoredAuth("test-token", { id: 1, username: "alice", display_name: "Alice" });
    const user = getStoredUser();
    expect(user).not.toBeNull();
    expect(user?.username).toBe("alice");
    expect(user?.display_name).toBe("Alice");
  });

  it("clears auth when null is passed", () => {
    setStoredAuth("test-token", { id: 1, username: "alice", display_name: "Alice" });
    setStoredAuth(null, null);
    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it("isAuthenticated returns true when token exists", () => {
    setStoredAuth("test-token", { id: 1, username: "alice", display_name: "Alice" });
    expect(isAuthenticated()).toBe(true);
  });

  it("isAuthenticated returns false when no token", () => {
    expect(isAuthenticated()).toBe(false);
  });

  it("getAuthHeaders returns Bearer header when token exists", () => {
    setStoredAuth("test-token", { id: 1, username: "alice", display_name: "Alice" });
    expect(getAuthHeaders()).toEqual({ Authorization: "Bearer test-token" });
  });

  it("getAuthHeaders returns empty when no token", () => {
    expect(getAuthHeaders()).toEqual({});
  });

  it("handles corrupted user JSON gracefully", () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "test-token");
    localStorage.setItem(USER_STORAGE_KEY, "not-json");
    expect(getStoredUser()).toBeNull();
  });
});
