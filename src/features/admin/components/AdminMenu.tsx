"use client";

import { useId, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { getErrorMessage } from "@/lib/api-client";
import { validate } from "@/lib/form";
import { useAdmin, useAdminLogin, useAdminLogout } from "../queries";
import { adminLoginSchema } from "../schema";

/** 상단 바의 자물쇠. 비밀번호가 설정된 배포에서만 보인다. */
export function AdminMenu() {
  const { isAdmin, isProtected, isLoading } = useAdmin();
  const login = useAdminLogin();
  const logout = useAdminLogout();
  const id = useId();

  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !isProtected) return null;

  const close = () => {
    if (login.isPending || logout.isPending) return;
    setOpen(false);
    setPasscode("");
    setError(null);
  };

  if (isAdmin) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="관리자 모드 켜짐. 누르면 끌 수 있어요">
          <LockOpen className="size-4 text-pitch-ink" aria-hidden />
          <span className="hidden sm:inline">관리자</span>
        </Button>
        <ConfirmDialog
          open={open}
          title="관리자 모드를 끌까요?"
          description="다시 켜려면 비밀번호를 입력해야 해요."
          confirmLabel="끄기"
          pending={logout.isPending}
          error={logout.isError ? getErrorMessage(logout.error) : null}
          onConfirm={() => logout.mutate(undefined, { onSuccess: close })}
          onCancel={close}
        />
      </>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validate(adminLoginSchema, { passcode });
    if (errors) {
      setError(errors.passcode ?? "비밀번호를 입력해 주세요");
      return;
    }
    try {
      await login.mutateAsync(data);
      close();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="관리자 모드 켜기">
        <Lock className="size-4" aria-hidden />
        <span className="hidden sm:inline">관리자</span>
      </Button>
      <Dialog
        open={open}
        title="관리자 비밀번호"
        description="경기·선수·포메이션을 등록하고 고치려면 필요해요. 피드백과 참석 응답은 누구나 할 수 있어요."
        onClose={close}
      >
        <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
          <Field label="비밀번호" htmlFor={`${id}-passcode`} error={error ?? undefined}>
            <Input
              id={`${id}-passcode`}
              type="password"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              invalid={!!error}
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={login.isPending}>
              취소
            </Button>
            <Button type="submit" pending={login.isPending}>
              켜기
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
