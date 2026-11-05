"use client";

export async function request<T>(
  url: string,
  body?: unknown,
  adminKey?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminKey ? { "x-admin-key": adminKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response
      .json()
      .catch(() => ({ error: "The server returned an unreadable response." }));
    if (!response.ok || data.error)
      throw new Error(data.error || "That action could not be completed.");
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("The connection timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
