/**
 * 브라우저 → Route Handler 호출용 fetch 래퍼.
 * 2xx가 아니면 ApiError를 던지므로 TanStack Query의 error 상태로 자연스럽게 흘러간다.
 */
export type ApiIssue = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues: ApiIssue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiInit = Omit<RequestInit, "body"> & { json?: unknown };

export async function api<T>(url: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body?.error === "string" ? body.error : `요청에 실패했습니다 (${response.status})`;
    throw new ApiError(response.status, message, Array.isArray(body?.issues) ? body.issues : []);
  }

  return body as T;
}

export function getErrorMessage(error: unknown, fallback = "문제가 생겼어요. 잠시 후 다시 시도해 주세요.") {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
