import axios, { isAxiosError, isCancel } from "axios";

import { API_BASE_URL } from "@/constants/api";
import { notifySessionExpired } from "@/hooks/auth-session";
import { clearGlobalError, emitGlobalError } from "@/hooks/error-bus";
import { normalizeApiError } from "@/hooks/error-utils";
import { getCurrentLocale } from "@/hooks/use-i18n";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

function shouldInvalidateSession(error: unknown) {
  if (!isAxiosError(error) || error.response?.status !== 401) {
    return false;
  }

  const requestUrl = error.config?.url ?? "";
  if (requestUrl.startsWith("/auth/") && requestUrl.split("?")[0] !== "/auth/me") {
    return false;
  }

  const authHeader =
    error.config?.headers?.Authorization ??
    error.config?.headers?.authorization ??
    api.defaults.headers.common.Authorization;

  return typeof authHeader === "string" && authHeader.trim().length > 0;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isCancel(error)) return Promise.reject(error);
    const normalized = normalizeApiError(error);
    const requestToken = isAxiosError(error)
      ? error.config?.headers?.Authorization ?? error.config?.headers?.authorization
      : undefined;
    // Requests from a signed-out or replaced session must not show errors or
    // invalidate the user's next session when they finish late.
    if (requestToken && requestToken !== api.defaults.headers.common.Authorization) {
      normalized.shouldNotify = false;
      normalized.message = "";
      return Promise.reject(normalized);
    }
    if (
      isAxiosError(error) &&
      error.config?.url?.split("?")[0] === "/auth/login" &&
      normalized.status === 401
    ) {
      // The login form displays invalid credentials beside the inputs.
      normalized.shouldNotify = false;
    }
    if (shouldInvalidateSession(error)) {
      // Session expiry is handled by signing out, not by error UI.
      // Clear the display message for screen-level catch handlers as well.
      normalized.shouldNotify = false;
      normalized.message = "";
      clearGlobalError();
      notifySessionExpired();
    }
    if (normalized.shouldNotify) {
      emitGlobalError(normalized.message);
    }
    return Promise.reject(normalized);
  }
);

api.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers["x-locale"] = getCurrentLocale();
  return config;
});

export function setApiAccessToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
