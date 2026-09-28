"use client";

import { useState, type Dispatch } from "react";
import { FolderOpen, Save, Trash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, InlineError } from "@/components/ui/States";
import { useAdmin } from "@/features/admin/queries";
import { getErrorMessage } from "@/lib/api-client";
import { validate } from "@/lib/form";
import { formatMatchDate, formatRelativeTime, todayIsoDate } from "@/lib/utils";
import type { LineupAction, LineupState } from "../lineup-reducer";
import { useCreateFormation, useDeleteFormation, useFormations, useUpdateFormation } from "../queries";
import { formationInputSchema, summarizeShapes, type SavedFormation } from "../schema";

type SavedFormationsProps = {
  state: LineupState;
  dispatch: Dispatch<LineupAction>;
  validPlayerIds: ReadonlySet<string>;
};

export function SavedFormations({ state, dispatch, validPlayerIds }: SavedFormationsProps) {
  const list = useFormations();
  const create = useCreateFormation();
  const update = useUpdateFormation();
  const remove = useDeleteFormation();
  const { isAdmin } = useAdmin();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedFormation | null>(null);

  const loaded = state.loadedId ? list.data?.find((f) => f.id === state.loadedId) : undefined;
  const defaultName = `${formatMatchDate(todayIsoDate())} 라인업`;

  /** 네 쿼터를 한 포메이션으로 저장한다. */
  const buildInput = (formationName: string) => {
    const { data, errors } = validate(formationInputSchema, {
      name: formationName,
      attendingIds: state.attendingIds,
      quarters: state.quarters,
    });
    if (errors) {
      setError(Object.values(errors)[0] ?? "입력값을 확인해 주세요");
      return null;
    }
    setError(null);
    return data;
  };

  const saveAsNew = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = buildInput(name.trim() || defaultName);
    if (!input) return;
    try {
      const saved = await create.mutateAsync(input);
      dispatch({ type: "markSaved", id: saved.id });
      setName("");
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const overwrite = async () => {
    if (!loaded) return;
    const input = buildInput(loaded.name);
    if (!input) return;
    try {
      await update.mutateAsync({ id: loaded.id, input });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const items = list.data ?? [];

  return (
    <section aria-labelledby="saved-heading" className="flex flex-col gap-3 border-t border-line pt-5">
      <h2 id="saved-heading" className="text-sm font-medium">
        저장된 포메이션{" "}
        {items.length > 0 && <span className="font-display text-muted">{items.length}</span>}
      </h2>

      {isAdmin ? (
        <>
          <form onSubmit={saveAsNew} className="flex gap-2">
            <Input
              aria-label="포메이션 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`예: ${defaultName}`}
              maxLength={30}
            />
            <Button type="submit" pending={create.isPending}>
              <Save className="size-4" aria-hidden />
              {loaded ? "새로 저장" : "저장"}
            </Button>
          </form>
          <p className="text-xs text-muted">1~4쿼터 라인업이 한 번에 저장돼요.</p>

          {loaded && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2/60 px-3 py-2 text-sm">
              <span>
                불러온 포메이션 <b className="font-semibold">{loaded.name}</b>
              </span>
              <Button size="sm" variant="secondary" onClick={overwrite} pending={update.isPending}>
                덮어쓰기
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted">저장과 삭제는 관리자만 할 수 있어요. 불러오기는 누구나 가능해요.</p>
      )}

      <InlineError>{error}</InlineError>

      {list.isPending ? (
        <ListSkeleton rows={2} />
      ) : list.isError ? (
        <ErrorState message={getErrorMessage(list.error)} onRetry={() => list.refetch()} retrying={list.isFetching} />
      ) : items.length === 0 ? (
        <p className="py-3 text-sm text-muted">
          저장한 포메이션이 없어요. 라인업을 짜고 이름을 붙여 저장해 두면 다음 경기에 다시 불러올 수 있어요.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((formation) => (
            <li key={formation.id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{formation.name}</p>
                <p className="text-xs text-muted">
                  <span className="font-display tracking-wide">
                    {summarizeShapes(formation.quarters.map((q) => q.shape))}
                  </span>
                  <span className="mx-1.5">|</span>
                  참석 {formation.attendingIds.length}명
                  <span className="mx-1.5">|</span>
                  <time dateTime={formation.updatedAt}>{formatRelativeTime(formation.updatedAt)}</time>
                </p>
              </div>
              <Button
                size="sm"
                variant={state.loadedId === formation.id ? "primary" : "secondary"}
                onClick={() => dispatch({ type: "load", formation, validPlayerIds })}
              >
                <FolderOpen className="size-4" aria-hidden />
                불러오기
              </Button>
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted hover:text-danger"
                  aria-label={`${formation.name} 삭제`}
                  onClick={() => setDeleting(formation)}
                >
                  <Trash className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ""} 포메이션을 삭제할까요?`}
        description="지금 화면의 라인업은 그대로 남아요. 이 포메이션을 붙여 둔 경기에서는 연결만 풀려요."
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        onCancel={() => {
          if (!remove.isPending) setDeleting(null);
        }}
      />
    </section>
  );
}
