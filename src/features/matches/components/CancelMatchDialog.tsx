"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { InlineError } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/api-client";
import { useCancelMatch } from "../queries";
import { CANCEL_REASONS } from "../schema";

type CancelMatchDialogProps = {
  matchId: string;
  open: boolean;
  onClose: () => void;
};

/** 우천·인원 부족 등으로 경기를 취소한다. 사유는 고르지 않아도 된다. 되돌리기는 경기 화면의 버튼으로. */
export function CancelMatchDialog({ matchId, open, onClose }: CancelMatchDialogProps) {
  const cancel = useCancelMatch();
  const [reason, setReason] = useState<string | null>(null);

  const close = () => {
    if (cancel.isPending) return;
    setReason(null);
    cancel.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      title="이 경기를 취소할까요?"
      description="참석 투표가 닫히고, 결과 입력 알림에서도 빠져요. 기록과 응답은 지워지지 않고, 나중에 되돌릴 수 있어요."
      onClose={close}
    >
      <div role="group" aria-label="취소 사유" className="mt-4 flex flex-wrap gap-1.5">
        {CANCEL_REASONS.map((r) => (
          <Chip key={r} size="sm" pressed={reason === r} onClick={() => setReason(reason === r ? null : r)}>
            {r}
          </Chip>
        ))}
      </div>
      <InlineError className="mt-3">{cancel.isError ? getErrorMessage(cancel.error) : null}</InlineError>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button variant="secondary" onClick={close} disabled={cancel.isPending} autoFocus>
          그대로 두기
        </Button>
        <Button
          variant="dangerSolid"
          pending={cancel.isPending}
          onClick={() => cancel.mutate({ id: matchId, input: { cancelled: true, reason } }, { onSuccess: close })}
        >
          경기 취소
        </Button>
      </div>
    </Dialog>
  );
}
