export const AUTH_STORAGE_KEY = "pm-auth-token";
export const USER_STORAGE_KEY = "pm-auth-user";

export type AuthUser = {
  id: number;
  username: string;
  display_name: string;
};

export const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const setStoredAuth = (token: string | null, user: AuthUser | null): void => {
  if (typeof window === "undefined") return;

  if (token && user) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, token);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
};

export const isAuthenticated = (): boolean => {
  return getStoredToken() !== null;
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
