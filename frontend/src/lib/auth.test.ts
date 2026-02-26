import {
  AUTH_PASSWORD,
  AUTH_STORAGE_KEY,
  AUTH_USER,
  getStoredAuth,
  isValidCredentials,
  setStoredAuth,
} from "@/lib/auth";

describe("auth helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("accepts only MVP hardcoded credentials", () => {
    expect(isValidCredentials(AUTH_USER, AUTH_PASSWORD)).toBe(true);
    expect(isValidCredentials("user", "wrong")).toBe(false);
    expect(isValidCredentials("wrong", "password")).toBe(false);
  });

  it("stores authenticated session flag", () => {
    setStoredAuth(true);
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");
    expect(getStoredAuth()).toBe(true);
  });

  it("clears authenticated session flag", () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setStoredAuth(false);
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(getStoredAuth()).toBe(false);
  });
});
