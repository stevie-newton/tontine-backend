import Constants from "expo-constants";
import { Platform } from "react-native";

function normalizeConfiguredApiUrl(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;

  // Be forgiving when env values omit the scheme.
  // Local/private addresses default to http; hosted domains default to https.
  const isLocalHost =
    raw.startsWith("localhost") ||
    raw.startsWith("127.") ||
    raw.startsWith("10.") ||
    raw.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(raw);

  return `${isLocalHost ? "http" : "https"}://${raw}`;
}

function getExpoDevHost(): string | null {
  // Usually "<ip-or-hostname>:<port>" (e.g. "192.168.1.10:8081")
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { hostUri?: string }).hostUri ??
    null;

  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host || null;
}

function getDefaultDevApiUrl(): string {
  if (Platform.OS === "android" && !Constants.isDevice) {
    // Android emulator -> host machine localhost
    return "http://10.0.2.2:8000";
  }

  if (Platform.OS === "ios" && !Constants.isDevice) {
    // iOS simulator shares localhost with the host machine
    return "http://127.0.0.1:8000";
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    // When running in a browser, default to same host (port 8000)
    const hostname = (globalThis as any)?.location?.hostname as string | undefined;
    if (hostname) return `http://${hostname}:8000`;
  }

  const devHost = getExpoDevHost();
  if (devHost) return `http://${devHost}:8000`;

  return "http://127.0.0.1:8000";
}

export const API_BASE_URL =
  normalizeConfiguredApiUrl(process.env.EXPO_PUBLIC_API_URL) ??
  (__DEV__ ? getDefaultDevApiUrl() : "http://127.0.0.1:8000");
