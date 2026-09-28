"use client";

import { useState } from "react";
import { MessageCircle, Trash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useAdmin } from "@/features/admin/queries";
import { getErrorMessage } from "@/lib/api-client";
import { errorsFromApi, FORM_ERROR_KEY, validate, type FieldErrors } from "@/lib/form";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useAddComment, useComments, useRemoveComment } from "../queries";
import { ATTENDANCE_LABEL, commentInputSchema, type AttendanceStatus, type MatchComment } from "../schema";

const STATUS_PILL: Record<AttendanceStatus, string> = {
  yes: "bg-pitch/10 text-pitch",
  no: "bg-surface-2 text-muted",
  maybe: "bg-amber/20 text-fg",
};

/** 투표 칸에서 입력한 내 PIN과, 서버 응답에 따라 PIN을 기억하거나 잊는 콜백. */
export type PinCredential = {
  /** 요청에 실을 PIN. 관리자라 필요 없으면 undefined */
  pin: string | undefined;
  /** 지금 요청을 보낼 수 있는지 (PIN 4자리가 채워졌거나 관리자) */
  ready: boolean;
  accept: () => void;
  reject: (error: unknown) => void;
};

type CommentThreadProps = {
  matchId: string;
  /** 투표 칸에서 고른 내 선수 id. 없으면 댓글을 쓸 수 없다. */
  me: string;
  myName: string | null;
  /** 선수 id → 현재 참석 상태. 댓글 옆에 작은 표시로 붙인다. */
  statusOf: ReadonlyMap<string, AttendanceStatus>;
  credential: PinCredential;
};

/**
 * 참석 투표 아래 댓글. "왜 불참인지, 왜 보류인지" 남기는 곳이라 이름을 밝히고 쓴다.
 * 투표가 마감된 뒤에도 남길 수 있다. 쓰기·삭제는 그 선수의 PIN이 맞아야 하고, 관리자는 PIN 없이 지울 수 있다.
 */
export function CommentThread({ matchId, me, myName, statusOf, credential }: CommentThreadProps) {
  const comments = useComments(matchId);
  const add = useAddComment(matchId);
  const remove = useRemoveComment(matchId);
  const { isAdmin } = useAdmin();

  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [deleting, setDeleting] = useState<MatchComment | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors: fieldErrors } = validate(commentInputSchema, { playerId: me, content, pin: credential.pin });
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    try {
      await add.mutateAsync({ matchId, input: data });
      credential.accept();
      setContent("");
    } catch (error) {
      credential.reject(error);
      setErrors(errorsFromApi(error));
    }
  };

  const items = comments.data ?? [];
  const canWrite = me !== "" && credential.ready;
  const message = errors.content ?? errors.pin ?? errors.playerId ?? errors[FORM_ERROR_KEY];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <MessageCircle className="size-4 text-muted" aria-hidden />
        댓글 {items.length > 0 && <span className="font-display text-muted">{items.length}</span>}
      </h3>

      {comments.isPending ? (
        <ListSkeleton rows={1} />
      ) : comments.isError ? (
        <ErrorState
          message={getErrorMessage(comments.error)}
          onRetry={() => comments.refetch()}
          retrying={comments.isFetching}
        />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">불참이나 보류면 이유를 남겨 주세요. 라인업 짤 때 참고해요.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((comment) => {
            const status = statusOf.get(comment.playerId);
            const mine = canWrite && comment.playerId === me;
            return (
              <li key={comment.id} className="flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                    <span className="font-medium text-fg">{comment.playerName}</span>
                    {status && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", STATUS_PILL[status])}>
                        {ATTENDANCE_LABEL[status]}
                      </span>
                    )}
                    <time dateTime={comment.createdAt}>{formatRelativeTime(comment.createdAt)}</time>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed">{comment.content}</p>
                </div>
                {(mine || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-2 -mt-1 text-muted hover:text-danger"
                    aria-label="댓글 삭제"
                    onClick={() => setDeleting(comment)}
                  >
                    <Trash className="size-4" aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
        <Textarea
          aria-label="댓글 내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            !me
              ? "위에서 내 이름을 고르면 댓글을 남길 수 있어요"
              : !credential.ready
                ? "위에서 PIN 4자리를 넣으면 댓글을 남길 수 있어요"
                : "예: 회사 야근이라 불참이요 / 토요일 저녁에 확정할게요"
          }
          rows={2}
          maxLength={300}
          disabled={!canWrite}
          invalid={!!errors.content}
          className="min-h-0 bg-surface"
        />
        <div className="flex items-center justify-between gap-3">
          <p className={cn("text-xs", message ? "text-danger" : "text-muted")} role={message ? "alert" : undefined}>
            {message ?? (myName ? `${myName} 이름으로 남겨져요` : "이름을 고르면 남길 수 있어요")}
          </p>
          <Button type="submit" size="sm" pending={add.isPending} disabled={!canWrite}>
            남기기
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={deleting !== null}
        title="이 댓글을 삭제할까요?"
        description={deleting ? `${deleting.playerName}: ${deleting.content}` : undefined}
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onConfirm={() => {
          if (deleting) {
            remove.mutate(
              { matchId, commentId: deleting.id, playerId: me || null, pin: credential.pin },
              {
                onSuccess: () => {
                  credential.accept();
                  setDeleting(null);
                },
                onError: credential.reject,
              },
            );
          }
        }}
        onCancel={() => {
          if (!remove.isPending) setDeleting(null);
        }}
      />
    </div>
  );
}
