"use client";

import Link from "next/link";
import { useState } from "react";
import { Medal } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useMatches } from "../queries";
import { isPlayed } from "../schema";
import { buildLeaderboard, filterSeason, listSeasons, type PlayerStat } from "../stats";
import { SeasonBoard } from "./SeasonBoard";

const sameRank = (a: PlayerStat, b: PlayerStat) => a.goals === b.goals && a.assists === b.assists;

function Tag({ children, tone }: { children: React.ReactNode; tone: "amber" | "pitch" }) {
  return (
    <span
      className={cn(
        "ml-1.5 rounded-sm px-1.5 py-0.5 align-middle text-[11px] font-semibold",
        tone === "amber" ? "bg-amber text-amber-fg" : "bg-pitch text-on-pitch",
      )}
    >
      {children}
    </span>
  );
}

/** 골·도움 순위. 결과가 있는 경기만 집계하고, 시즌(연도)이 둘 이상이면 골라 볼 수 있다. */
export function Leaderboard() {
  const query = useMatches();
  const [season, setSeason] = useState<string | null>(null);

  if (query.isPending) return <ListSkeleton rows={6} />;

  if (query.isError) {
    return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  const seasons = listSeasons(query.data);
  const scoped = filterSeason(query.data, season);
  const played = scoped.filter(isPlayed);
  const board = buildLeaderboard(scoped);
  const topGoals = board[0]?.goals ?? 0;
  const topAssists = Math.max(0, ...board.map((s) => s.assists));
  // 골·도움이 같으면 같은 순위(공동). 앞쪽으로 거슬러 올라가 같은 기록의 첫 번째 위치를 순위로 쓴다.
  const ranks = board.map((stat, index) => {
    let first = index;
    while (first > 0 && sameRank(board[first - 1], stat)) first -= 1;
    return first + 1;
  });

  return (
    <div className="flex flex-col gap-6">
      {seasons.length > 1 && (
        <div role="group" aria-label="시즌" className="flex flex-wrap gap-2">
          <Chip size="sm" pressed={season === null} onClick={() => setSeason(null)}>
            전체
          </Chip>
          {seasons.map((year) => (
            <Chip key={year} size="sm" pressed={season === year} onClick={() => setSeason(year)} className="font-display">
              {year}
            </Chip>
          ))}
        </div>
      )}

      {played.length > 0 && <SeasonBoard matches={played} />}

      {board.length === 0 ? (
        <EmptyState
          icon={<Medal />}
          title="아직 득점 기록이 없어요"
          description="경기 결과에 득점자와 도움을 적으면 여기에 순위가 쌓여요."
        />
      ) : (
        <table className="w-full text-[15px]">
          <caption className="sr-only">골과 도움 순위</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="w-10 py-2 font-medium">
                순위
              </th>
              <th scope="col" className="py-2 font-medium">
                선수
              </th>
              <th scope="col" className="w-14 py-2 text-right font-medium">
                골
              </th>
              <th scope="col" className="w-14 py-2 text-right font-medium">
                도움
              </th>
              <th scope="col" className="w-16 py-2 text-right font-medium">
                포인트
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {board.map((stat, index) => {
              return (
                <tr key={stat.playerId}>
                  <td className="font-display py-3 text-muted">{ranks[index]}</td>
                  <td className="py-3 font-medium">
                    <Link
                      href={`/players/${stat.playerId}`}
                      className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pitch/40"
                    >
                      {stat.name}
                    </Link>
                    {topGoals > 0 && stat.goals === topGoals && <Tag tone="amber">득점왕</Tag>}
                    {topAssists > 0 && stat.assists === topAssists && <Tag tone="pitch">도움왕</Tag>}
                  </td>
                  <td className="font-display py-3 text-right text-xl leading-none">{stat.goals}</td>
                  <td className="font-display py-3 text-right text-xl leading-none text-muted">{stat.assists}</td>
                  <td className="font-display py-3 text-right text-muted">{stat.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
