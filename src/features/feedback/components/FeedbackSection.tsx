"use client";

import { useEffect, useState } from "react";
import { Lock, Trash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useAdmin } from "@/features/admin/queries";
import { getErrorMessage } from "@/lib/api-client";
import { errorsFromApi, FORM_ERROR_KEY, validate, type FieldErrors } from "@/lib/form";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useCreateFeedback, useDeleteFeedback, useFeedback } from "../queries";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABEL,
  feedbackInputSchema,
  type Feedback,
  type FeedbackCategory,
} from "../schema";

const PLACEHOLDER: Record<FeedbackCategory, string> = {
  good: "오늘 잘 된 건 뭐였나요? 예: 후반 압박이 좋았어요",
  improve: "다음엔 어떻게 하면 좋을까요? 예: 수비 라인 간격이 너무 벌어졌어요",
  idea: "팀에 제안하고 싶은 게 있나요? 예: 경기 전 세트피스 연습 10분",
};

const CATEGORY_BORDER: Record<FeedbackCategory, string> = {
  good: "border-l-win",
  improve: "border-l-amber",
  idea: "border-l-muted",
};

type Filter = FeedbackCategory | "all";

export function FeedbackSection({ matchId }: { matchId: string }) {
  const query = useFeedback(matchId);
  const create = useCreateFeedback(matchId);
  const remove = useDeleteFeedback(matchId);
  const { isAdmin } = useAdmin();

  const [category, setCategory] = useState<FeedbackCategory>("good");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Feedback | null>(null);

  // "남겼어요" 안내는 잠깐만 보여준다.
  useEffect(() => {
    if (sentAt === null) return;
    const timer = setTimeout(() => setSentAt(null), 2500);
    return () => clearTimeout(timer);
  }, [sentAt]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors: fieldErrors } = validate(feedbackInputSchema, { category, content });
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    try {
      await create.mutateAsync({ matchId, input: data });
      setContent("");
      setSentAt(Date.now());
    } catch (error) {
      setErrors(errorsFromApi(error));
    }
  };

  const items = query.data ?? [];
  const countBy = (c: FeedbackCategory) => items.filter((f) => f.category === c).length;
  const visible = filter === "all" ? items : items.filter((f) => f.category === filter);
  const message = errors.content ?? errors[FORM_ERROR_KEY];

  return (
    <section aria-labelledby="feedback-heading" className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="feedback-heading" className="text-lg font-semibold">
          피드백{" "}
          {items.length > 0 && <span className="font-display text-base font-normal text-muted">{items.length}</span>}
        </h2>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Lock className="size-3.5" aria-hidden />
          익명으로 남겨져요
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 rounded-xl bg-surface-2/60 p-4">
        <div role="group" aria-label="피드백 종류" className="flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((c) => (
            <Chip key={c} size="sm" pressed={category === c} onClick={() => setCategory(c)}>
              {FEEDBACK_CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
        <Textarea
          aria-label="피드백 내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={PLACEHOLDER[category]}
          rows={3}
          maxLength={500}
          invalid={!!errors.content}
          className="bg-surface"
        />
        <div className="flex items-center justify-between gap-3">
          <p className={cn("text-xs", message ? "text-danger" : "text-muted")} role={message ? "alert" : "status"}>
            {message ?? (sentAt ? "남겼어요" : "이름이나 기기 정보는 저장하지 않아요")}
          </p>
          <Button type="submit" size="sm" pending={create.isPending}>
            남기기
          </Button>
        </div>
      </form>

      {query.isPending ? (
        <ListSkeleton rows={2} />
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">아직 피드백이 없어요. 첫 번째로 남겨 보세요.</p>
      ) : (
        <>
          <div role="group" aria-label="피드백 필터" className="flex flex-wrap gap-2">
            <Chip size="sm" pressed={filter === "all"} onClick={() => setFilter("all")}>
              전체 <span className="font-display">{items.length}</span>
            </Chip>
            {FEEDBACK_CATEGORIES.map((c) => (
              <Chip key={c} size="sm" pressed={filter === c} onClick={() => setFilter(c)} disabled={countBy(c) === 0}>
                {FEEDBACK_CATEGORY_LABEL[c]} <span className="font-display">{countBy(c)}</span>
              </Chip>
            ))}
          </div>
          <ul className="flex flex-col gap-2">
            {visible.map((feedback) => (
              <FeedbackItem
                key={feedback.id}
                feedback={feedback}
                onDelete={isAdmin ? () => setDeleting(feedback) : undefined}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="이 피드백을 삭제할까요?"
        description="익명 글이라 작성자에게 알릴 방법은 없어요. 부적절한 내용일 때만 지워 주세요."
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onConfirm={() => {
          if (deleting) remove.mutate({ matchId, feedbackId: deleting.id }, { onSuccess: () => setDeleting(null) });
        }}
        onCancel={() => {
          if (!remove.isPending) setDeleting(null);
        }}
      />
    </section>
  );
}

function FeedbackItem({ feedback, onDelete }: { feedback: Feedback; onDelete?: () => void }) {
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-lg border border-line border-l-4 bg-surface px-4 py-3",
        CATEGORY_BORDER[feedback.category],
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-xs text-muted">
          <span className="font-medium">{FEEDBACK_CATEGORY_LABEL[feedback.category]}</span>
          <time dateTime={feedback.createdAt}>{formatRelativeTime(feedback.createdAt)}</time>
        </p>
        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">{feedback.content}</p>
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 text-muted hover:text-danger"
          aria-label="피드백 삭제"
          onClick={onDelete}
        >
          <Trash className="size-4" aria-hidden />
        </Button>
      )}
    </li>
  );
}
