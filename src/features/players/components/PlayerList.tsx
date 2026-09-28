"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Pencil, Trash, UserRoundPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAdmin } from "@/features/admin/queries";
import { getErrorMessage } from "@/lib/api-client";
import { POSITION_GROUP, POSITION_GROUP_LABEL, POSITION_GROUPS, type PositionGroup } from "@/lib/positions";
import { cn } from "@/lib/utils";
import { useCreatePlayer, useDeletePlayer, usePlayers, useUpdatePlayer } from "../queries";
import type { Player } from "../schema";
import { PlayerForm } from "./PlayerForm";

/** 주 포지션 그룹(GK → DF → MF → FW)별로 묶고, 그룹 안에서는 이름순 */
function groupPlayers(players: Player[]) {
  const groups = new Map<PositionGroup, Player[]>();
  for (const player of players) {
    const group = POSITION_GROUP[player.positions[0]] ?? "FW";
    groups.set(group, [...(groups.get(group) ?? []), player]);
  }
  return POSITION_GROUPS.flatMap((group) => {
    const list = groups.get(group);
    if (!list) return [];
    return [{ group, players: [...list].sort((a, b) => a.name.localeCompare(b.name, "ko")) }];
  });
}

export function PlayerList() {
  const query = usePlayers();
  const create = useCreatePlayer();
  const update = useUpdatePlayer();
  const remove = useDeletePlayer();
  const { isAdmin } = useAdmin();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);

  const players = query.data ?? [];
  const canEdit = isAdmin;

  return (
    <>
      <PageHeader
        title="선수"
        meta={players.length > 0 ? players.length : undefined}
        actions={
          canEdit ? (
            <Button
              variant="accent"
              onClick={() => {
                setEditingId(null);
                setAdding(true);
              }}
              disabled={adding}
            >
              <UserRoundPlus className="size-4" aria-hidden />
              선수 추가
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-5">
        {adding && canEdit && (
          <PlayerForm
            submitLabel="추가"
            pending={create.isPending}
            onSubmit={async (input) => {
              await create.mutateAsync(input);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {query.isPending ? (
          <ListSkeleton rows={6} />
        ) : query.isError ? (
          <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : players.length === 0 ? (
          !adding && (
            <EmptyState
              icon={<Users />}
              title="아직 등록된 선수가 없어요"
              description={
                canEdit
                  ? "이름과 가능한 포지션만 넣어 두면 포메이션을 자동으로 짜 드려요."
                  : "관리자가 선수를 등록하면 여기에 보여요."
              }
              action={
                canEdit ? (
                  <Button variant="accent" onClick={() => setAdding(true)}>
                    첫 선수 등록
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          groupPlayers(players).map(({ group, players: list }) => (
            <section key={group} aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`} className="mb-1 text-sm font-medium text-muted">
                {POSITION_GROUP_LABEL[group]} <span className="font-display">{list.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {list.map((player) =>
                  editingId === player.id && canEdit ? (
                    <li key={player.id} className="py-3">
                      <PlayerForm
                        initial={{ name: player.name, positions: player.positions }}
                        submitLabel="저장"
                        pending={update.isPending}
                        onSubmit={async (input) => {
                          await update.mutateAsync({ id: player.id, input });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </li>
                  ) : (
                    <li key={player.id} className="flex items-center gap-2 py-3">
                      <Link
                        href={`/players/${player.id}`}
                        className="-my-1 -ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pl-2 pr-1 outline-none transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70"
                        aria-label={`${player.name} 기록 보기`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{player.name}</p>
                          <p className="font-display mt-1 flex flex-wrap gap-1 text-xs tracking-wide">
                            {player.positions.map((position, index) => (
                              <span
                                key={position}
                                className={cn(
                                  "rounded px-1.5 py-0.5",
                                  index === 0 ? "bg-pitch text-on-pitch" : "bg-surface-2 text-muted",
                                )}
                              >
                                {position}
                              </span>
                            ))}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${player.name} 수정`}
                            onClick={() => {
                              setAdding(false);
                              setEditingId(player.id);
                            }}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted hover:text-danger"
                            aria-label={`${player.name} 삭제`}
                            onClick={() => setDeleting(player)}
                          >
                            <Trash className="size-4" aria-hidden />
                          </Button>
                        </>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ""} 선수를 삭제할까요?`}
        description="경기 득점 기록은 남지만 득점자는 미상으로 표시돼요. 참석 응답과 저장된 포메이션에서는 빠져요."
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
    </>
  );
}
