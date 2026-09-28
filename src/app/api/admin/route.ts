import { adminLoginSchema } from "@/features/admin/schema";
import { adminCookie, isAdminRequest, isProtected, registerLoginAttempt, verifyPasscode } from "@/server/admin";
import { HttpError, json, noContent, parseBody, withErrorHandling } from "@/server/http";

export const GET = withErrorHandling(async (request) => {
  return json({ protected: isProtected(), admin: isAdminRequest(request) });
});

export const POST = withErrorHandling(async (request) => {
  const { passcode } = await parseBody(request, adminLoginSchema);
  if (!isProtected()) return json({ protected: false, admin: true });
  if (!registerLoginAttempt()) throw new HttpError(429, "시도가 너무 많아요. 잠시 후 다시 해 주세요");
  if (!verifyPasscode(passcode)) throw new HttpError(401, "비밀번호가 맞지 않아요");

  const response = json({ protected: true, admin: true });
  const cookie = adminCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
});

export const DELETE = withErrorHandling(async () => {
  const response = noContent();
  const cookie = adminCookie();
  response.cookies.set(cookie.name, "", { ...cookie.options, maxAge: 0 });
  return response;
});
