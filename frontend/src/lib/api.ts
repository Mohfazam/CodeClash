import { API_URL } from "@/lib/config";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

type RequestConfig = {
  path: string;
  method?: Method;
  token?: string | null;
  body?: unknown;
};

export async function apiRequest<T>({ path, method = "GET", token, body }: RequestConfig): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? "Request failed");
  }

  return data as T;
}
