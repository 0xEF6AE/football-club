"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { InlineError } from "./States";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 되돌릴 수 없는 동작이면 확인 버튼을 빨간색으로 */
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 네이티브 <dialog> 기반 확인창. 포커스 트랩·ESC·배경 클릭 차단은 브라우저가 처리한다. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  destructive = false,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-5 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px] transition-[opacity,scale] duration-200 ease-out starting:open:scale-95 starting:open:opacity-0"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
      <InlineError className="mt-3">{error}</InlineError>
      {/* 모바일에서는 두 버튼을 반씩 나눠 누르기 쉽게, 넓은 화면에서는 오른쪽 정렬 */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        {/* 기본 포커스는 취소에. Enter 한 번에 지워지는 사고를 막는다. */}
        <Button variant="secondary" onClick={onCancel} disabled={pending} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "dangerSolid" : "primary"} onClick={onConfirm} pending={pending}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
