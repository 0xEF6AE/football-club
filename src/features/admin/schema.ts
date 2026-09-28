import { z } from "zod";

export const adminLoginSchema = z.object({
  passcode: z.string().min(1, "비밀번호를 입력해 주세요").max(100),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export type AdminStatus = {
  /** 서버에 ADMIN_PASSCODE가 설정돼 있는지. false면 누구나 편집할 수 있다. */
  protected: boolean;
  /** 이 브라우저가 관리자 쿠키를 가지고 있는지 (protected가 false면 항상 true) */
  admin: boolean;
};
