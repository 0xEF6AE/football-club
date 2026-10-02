"use client";

import { Check, Megaphone, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { InlineError } from "@/components/ui/States";
import { formatSecondCallText } from "@/features/matches/match-text";
import { useSetLateJoinDeadline } from "@/features/matches/queries";
import { lateJoinCloseAt, resultDueAt, type Match } from "@/features/matches/schema";
import { getErrorMessage } from "@/lib/api-client";
import { CLUB_NAME } from "@/lib/config";
import { useCopy } from "@/lib/use-copy";
import { formatDateTime } from "@/lib/utils";

type SecondCallPanelProps = {
  match: Match;
  maybe: string[];
  no: string[];
  none: string[];
  attending: number;
  guests: number;
};

const HOUR = 3_600_000;
/** 지금 시각. 화면은 버튼을 누를 때마다 다시 그려지므로 렌더 시점 값으로 충분하다. */
const nowMs = () => Date.now();
/** 지금부터 hours시간 뒤를 10분 단위로 올린 시각 */
const roundedFromNow = (hours: number) => Math.ceil((nowMs() + hours * HOUR) / (10 * 60_000)) * 10 * 60_000;

/**
 * 주장용 "추가 참석 받기": 투표가 마감된 뒤 보류·불참·미투표에게 다시 묻는다.
 * 1) 언제까지 받을지(추가 모집 마감) 정하고  2) 단톡방에 붙일 글을 복사한다.
 * 그 사람들은 경기 화면에서 "늦게라도 참석"을 누르고, 주장은 마감 뒤 포메이션에서 다시 가져오기를 하면 된다.
 */
export function SecondCallPanel({ match, maybe, no, none, attending, guests }: SecondCallPanelProps) {
  const setDeadline = useSetLateJoinDeadline();
  const { copied, copy } = useCopy();
  const limit = resultDueAt(match);
  const closeAt = lateJoinCloseAt(match);
  const presets = [1, 3]
    .map((h) => ({ label: `${h}시간 뒤`, at: roundedFromNow(h) }))
    .filter((p) => p.at < limit);
  const total = maybe.length + no.length + none.length;
  const now = nowMs();
  const open = closeAt > now;

  const apply = (at: number | null) =>
    setDeadline.mutate({ id: match.id, deadline: at === null ? null : new Date(at).toISOString() });

  return (
    <section aria-labelledby="second-call-heading" className="flex flex-col gap-3 rounded-xl border border-pitch-ink/25 bg-pitch-ink/5 p-4">
      <h3 id="second-call-heading" className="flex items-center gap-1.5 text-sm font-semibold">
        <Megaphone className="size-4 text-pitch-ink" aria-hidden />
        추가 참석 받기 <span className="text-xs font-normal text-muted">주장만 보여요</span>
      </h3>
      {total === 0 ? (
        <p className="text-sm text-muted">보류·불참·미투표인 사람이 없어요.</p>
      ) : (
        <p className="text-sm leading-relaxed">
          보류 <b className="font-display">{maybe.length}</b> · 불참 <b className="font-display">{no.length}</b> · 미투표{" "}
          <b className="font-display">{none.length}</b>명에게 다시 물어볼 수 있어요. 올 수 있는 사람은 이 경기 화면에서 &lsquo;늦게라도
          참석&rsquo;을 누르면 돼요.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-sm">
          추가 모집 마감 <b className="font-medium">{formatDateTime(new Date(closeAt).toISOString())}</b>
          {!match.lateJoinDeadline && <span className="text-xs text-muted"> (기본: 킥오프 2시간 뒤)</span>}
        </p>
        <div role="group" aria-label="추가 모집 마감 정하기" className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Chip key={p.label} size="sm" pressed={match.lateJoinDeadline === new Date(p.at).toISOString()} onClick={() => apply(p.at)} disabled={setDeadline.isPending}>
              {p.label}
            </Chip>
          ))}
          <Chip size="sm" pressed={!match.lateJoinDeadline} onClick={() => apply(null)} disabled={setDeadline.isPending}>
            킥오프 2시간 뒤
          </Chip>
          <Chip size="sm" pressed={!open} onClick={() => apply(nowMs() + 60_000)} disabled={setDeadline.isPending || !open}>
            {open ? "1분 뒤 닫기" : "닫혔어요"}
          </Chip>
        </div>
        <InlineError>{setDeadline.isError ? getErrorMessage(setDeadline.error) : null}</InlineError>
      </div>

      {total > 0 && open && (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() =>
            copy(formatSecondCallText(match, { maybe, no, none, attending, guests }, `${window.location.origin}/matches/${match.id}`))
          }
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "복사했어요" : "카톡으로 다시 묻기"}
        </Button>
      )}
      <p className="text-xs text-muted">
        추가 모집이 끝나면 포메이션 화면에서 &lsquo;참석 투표에서 가져오기&rsquo;를 다시 눌러 주세요. {CLUB_NAME} 단톡방에 붙이면 링크 미리보기도 함께 떠요.
      </p>
    </section>
  );
}
