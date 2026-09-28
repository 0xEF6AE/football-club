import type { z } from "zod";
import { ApiError, getErrorMessage } from "./api-client";

/** 필드 경로("goals.0.scorerId") → 메시지. 폼 전체 오류는 "" 키에 담는다. */
export type FieldErrors = Record<string, string>;

export const FORM_ERROR_KEY = "";

type Issue = { path: PropertyKey[] | string; message: string };

function toErrors(issues: readonly Issue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = Array.isArray(issue.path) ? issue.path.map(String).join(".") : issue.path;
    // 같은 필드에 오류가 여럿이면 첫 번째만 보여준다.
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/** 클라이언트에서 제출 전 검증. 서버와 같은 zod 스키마를 쓴다. */
export function validate<T>(schema: z.ZodType<T>, raw: unknown): { data: T; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(raw);
  if (result.success) return { data: result.data, errors: null };
  return { data: null, errors: toErrors(result.error.issues) };
}

/** 서버가 돌려준 400 필드 오류를 폼 오류로. 필드 오류가 없으면 폼 전체 오류로 담는다. */
export function errorsFromApi(error: unknown): FieldErrors {
  if (error instanceof ApiError && error.issues.length > 0) return toErrors(error.issues);
  return { [FORM_ERROR_KEY]: getErrorMessage(error) };
}
