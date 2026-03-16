import axios from "axios";

import { getCurrentLocale } from "@/hooks/use-i18n";

export type AppErrorKind =
  | "auth"
  | "network"
  | "timeout"
  | "validation"
  | "server"
  | "client"
  | "unknown";

export class AppApiError extends Error {
  status?: number;
  code?: string;
  kind: AppErrorKind;
  shouldNotify: boolean;

  constructor(args: {
    message: string;
    kind: AppErrorKind;
    status?: number;
    code?: string;
    shouldNotify?: boolean;
  }) {
    super(args.message);
    this.name = "AppApiError";
    this.status = args.status;
    this.code = args.code;
    this.kind = args.kind;
    this.shouldNotify = Boolean(args.shouldNotify);
  }
}

function t(en: string, fr: string) {
  return getCurrentLocale() === "fr" ? fr : en;
}

export function normalizeApiError(
  error: unknown,
  fallbackMessage = t("Something went wrong. Please try again.", "Une erreur s'est produite. Veuillez réessayer.")
) {
  if (error instanceof AppApiError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const code = error.code;
    const responseMessage =
      typeof detail === "string" && detail.trim().length > 0 ? detail : null;

    if (code === "ECONNABORTED") {
      return new AppApiError({
        message: t(
          "The request timed out. Please try again.",
          "La requête a expiré. Veuillez réessayer."
        ),
        kind: "timeout",
        status,
        code,
        shouldNotify: true,
      });
    }

    if (!error.response) {
      return new AppApiError({
        message: t(
          "Unable to reach the server. Check your connection and try again.",
          "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez."
        ),
        kind: "network",
        code,
        shouldNotify: true,
      });
    }

    if (status === 401) {
      return new AppApiError({
        message:
          responseMessage ??
          t("Your session has expired. Please sign in again.", "Votre session a expiré. Veuillez vous reconnecter."),
        kind: "auth",
        status,
        code,
        shouldNotify: true,
      });
    }

    if (status === 403) {
      return new AppApiError({
        message:
          responseMessage ??
          t("You do not have permission to perform this action.", "Vous n'avez pas l'autorisation d'effectuer cette action."),
        kind: "client",
        status,
        code,
      });
    }

    if (status === 422 || status === 400) {
      return new AppApiError({
        message: responseMessage ?? fallbackMessage,
        kind: "validation",
        status,
        code,
      });
    }

    if (status && status >= 500) {
      return new AppApiError({
        message:
          responseMessage ??
          t(
            "The server hit a problem. Please try again in a moment.",
            "Le serveur a rencontré un problème. Veuillez réessayer dans un instant."
          ),
        kind: "server",
        status,
        code,
        shouldNotify: true,
      });
    }

    return new AppApiError({
      message: responseMessage ?? fallbackMessage,
      kind: status && status >= 400 ? "client" : "unknown",
      status,
      code,
    });
  }

  if (error instanceof Error) {
    return new AppApiError({
      message: error.message || fallbackMessage,
      kind: "unknown",
    });
  }

  return new AppApiError({
    message: fallbackMessage,
    kind: "unknown",
  });
}

export function getErrorMessage(error: unknown, fallbackMessage?: string) {
  return normalizeApiError(error, fallbackMessage).message;
}
