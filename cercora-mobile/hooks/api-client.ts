import axios from "axios";

import { API_BASE_URL } from "@/constants/api";
import { emitGlobalError } from "@/hooks/error-bus";
import { normalizeApiError } from "@/hooks/error-utils";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeApiError(error);
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
