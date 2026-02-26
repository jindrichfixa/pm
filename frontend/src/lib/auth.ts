export const AUTH_USER = "user";
export const AUTH_PASSWORD = "password";
export const AUTH_STORAGE_KEY = "pm-authenticated";

export const isValidCredentials = (username: string, password: string): boolean =>
  username === AUTH_USER && password === AUTH_PASSWORD;

export const getStoredAuth = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
};

export const setStoredAuth = (isAuthenticated: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (isAuthenticated) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};
