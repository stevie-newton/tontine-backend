import axios from "axios";

import { API_BASE_URL } from "@/constants/api";
import { notifySessionExpired } from "@/hooks/auth-session";
import { emitGlobalError } from "@/hooks/error-bus";
import { normalizeApiError } from "@/hooks/error-utils";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

function shouldInvalidateSession(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) {
    return false;
  }

  const requestUrl = error.config?.url ?? "";
  if (requestUrl.startsWith("/auth/")) {
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
    const normalized = normalizeApiError(error);
    if (shouldInvalidateSession(error)) {
      notifySessionExpired();
    }
    if (normalized.shouldNotify) {
      emitGlobalError(normalized.message);
    }
    return Promise.reject(normalized);
  }
);

export function setApiAccessToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
