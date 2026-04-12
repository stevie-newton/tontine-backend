// src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set");

function buildHeaders(options: RequestInit = {}): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const locale =
    typeof window !== "undefined" ? localStorage.getItem("app_locale") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(((options.headers as Record<string, string> | undefined) || {}) as Record<
      string,
      string
    >),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (locale === "en" || locale === "fr") headers["x-locale"] = locale;

  return headers;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = buildHeaders(options);

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function apiFetchText(
  path: string,
  options: RequestInit = {}
): Promise<string> {
  const headers = buildHeaders(options);

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return text;
}
