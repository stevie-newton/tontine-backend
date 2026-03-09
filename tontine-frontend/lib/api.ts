const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function getApiBaseUrl(): string {
  if (!API_URL) {
    throw new Error("Missing NEXT_PUBLIC_API_URL in .env.local");
  }
  return API_URL.replace(/\/+$/, "");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) {
    throw new Error("Missing NEXT_PUBLIC_API_URL in .env.local");
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const locale =
    typeof window !== "undefined"
      ? localStorage.getItem("app_locale") || navigator.language || "en"
      : "en";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept-Language": locale,
    "X-Locale": locale,
    ...((options.headers as Record<string, string> | undefined) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      msg = data?.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : JSON.stringify(data);
    } catch {
      msg = await res.text();
    }
    throw new Error(msg);
  }

  // Handle endpoints that intentionally return no body (e.g. HTTP 204 No Content).
  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
