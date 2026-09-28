import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { isAdminRequest } from "./admin";

/**
 * Route Handler 공통 유틸.
 * - HttpError: 의도한 실패(400/404 등)를 던지면 withErrorHandling이 JSON 응답으로 바꿔 준다.
 * - parseBody: zod 스키마로 본문을 검증하고, 실패 시 400과 함께 필드별 메시지를 돌려준다.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (message = "찾을 수 없습니다") => new HttpError(404, message);

/** 등록·수정·삭제 핸들러 첫 줄에서 호출. 관리자 쿠키가 없으면 401. */
export function requireAdmin(request: NextRequest) {
  if (!isAdminRequest(request)) throw new HttpError(401, "관리자만 할 수 있어요");
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "요청 본문이 올바른 JSON이 아닙니다");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(
      400,
      "입력값을 확인해 주세요",
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

type Handler<Ctx> = (request: NextRequest, context: Ctx) => Promise<Response>;

export function withErrorHandling<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: error.message, issues: error.issues },
          { status: error.status },
        );
      }
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}`, error);
      return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
    }
  };
}

export type IdContext = { params: Promise<{ id: string }> };
