import Constants from "expo-constants";
import { Platform } from "react-native";

import { api } from "@/hooks/api-client";

export type ProblemReportValues = {
  location: string;
  description: string;
  requesterName: string;
  requesterPhone: string;
};

export type ProblemReportErrors = Partial<Record<keyof ProblemReportValues, string>>;

export const REPORT_LOCATION_LIMIT = 120;
export const REPORT_DESCRIPTION_LIMIT = 3000;

function normalizePhone(phone: string) {
  return phone.replace(/[\s().-]/g, "");
}

export function getProblemReportErrors(values: ProblemReportValues): ProblemReportErrors {
  const errors: ProblemReportErrors = {};
  if (!values.location.trim() || values.location.trim().length > REPORT_LOCATION_LIMIT) {
    errors.location = "Enter the screen or step where you got stuck.";
  }
  if (values.description.trim().length < 10 || values.description.trim().length > REPORT_DESCRIPTION_LIMIT) {
    errors.description = "Describe what happened (at least 10 characters).";
  }
  if (!values.requesterName.trim() || values.requesterName.trim().length > 100) {
    errors.requesterName = "Enter your name.";
  }
  if (!/^\+?\d{7,15}$/.test(normalizePhone(values.requesterPhone))) {
    errors.requesterPhone = "Enter a valid phone number.";
  }
  return errors;
}

export async function submitProblemReport(values: ProblemReportValues, locale: string, origin: string) {
  const errors = getProblemReportErrors(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  // Include only useful app context, never tokens, logs, device IDs, or route parameters.
  const message = [
    "Cercora beta feedback",
    `Where I got stuck: ${values.location.trim()}`,
    "",
    "What happened:",
    values.description.trim(),
    "",
    `App version: ${Constants.expoConfig?.version ?? "unknown"}`,
    `Platform: ${Platform.OS}`,
    ...(Platform.OS !== "web" ? [`OS version: ${Platform.Version}`] : []),
    `Language: ${locale === "fr" ? "fr" : "en"}`,
    `Opened from: ${origin === "sign-in" || origin === "profile" ? origin : "direct"}`,
  ].join("\n");

  const response = await api.post<{ id: number }>("/support/ticket", {
    message,
    // These also let the optional-auth endpoint accept a report if the session expired.
    requester_name: values.requesterName.trim(),
    requester_phone: normalizePhone(values.requesterPhone),
  }, { timeout: 30_000 });

  if (!Number.isSafeInteger(response.data?.id) || response.data.id <= 0) {
    throw new Error("We could not confirm that your report was received. Your text is still here; please try again.");
  }
  return { id: response.data.id };
}
