"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { InlineError } from "@/components/ui/States";
import { useFormations } from "@/features/formations/queries";
import { summarizeShapes } from "@/features/formations/schema";
import { PlayerPicker } from "@/features/players/components/PlayerPicker";
import { usePlayers } from "@/features/players/queries";
import type { Player } from "@/features/players/schema";
import { CLUB_NAME } from "@/lib/config";
import { errorsFromApi, FORM_ERROR_KEY, validate, type FieldErrors } from "@/lib/form";
import { cn, formatKickoffTime, fromDateTimeLocal, toDateTimeLocal, todayIsoDate } from "@/lib/utils";
import { isPlayed, matchInputSchema, type Match, type MatchInput } from "../schema";

type GoalDraft = { key: string; scorerId: string; assistId: string };

/** 득점자·도움 목록에서 이름 옆에 주 포지션을 붙여 동명이인·헷갈림을 줄인다 */
const describePosition = (player: Player) => <span className="font-display tracking-wide">{player.positions[0]}</span>;

/** 킥오프는 정각만 고른다: 미정, "00:00" ~ "23:00" */
const KICKOFF_OPTIONS: SelectOption[] = [
  { value: "", label: "미정" },
  ...Array.from({ length: 24 }, (_, hour) => {
    const time = `${String(hour).padStart(2, "0")}:00`;
    return { value: time, label: formatKickoffTime(time) };
  }),
];

/** 경기 전날 21:00 (브라우저 로컬). 투표 마감의 흔한 기본값. */
function eveningBefore(playedAt: string): string {
  const date = new Date(`${playedAt}T21:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() - 1);
  return toDateTimeLocal(date.toISOString());
}

type MatchFormProps = {
  /** 수정 모드면 기존 경기 */
  initial?: Match;
  submitLabel: string;
  pending: boolean;
  /** 성공하면 resolve, 실패하면 throw (서버 필드 오류를 폼에 표시한다) */
  onSubmit: (input: MatchInput) => Promise<unknown>;
  cancelHref: string;
};

const newGoal = (): GoalDraft => ({ key: crypto.randomUUID(), scorerId: "", assistId: "" });

export function MatchForm({ initial, submitLabel, pending, onSubmit, cancelHref }: MatchFormProps) {
  const id = useId();
  const players = usePlayers();
  const playerList = players.data ?? [];
  const formations = useFormations();

  const [hasResult, setHasResult] = useState(initial ? isPlayed(initial) : true);
  const [playedAt, setPlayedAt] = useState(initial?.playedAt ?? todayIsoDate());
  const [kickoffTime, setKickoffTime] = useState(initial?.kickoffTime ?? "");
  const [opponent, setOpponent] = useState(initial?.opponent ?? "");
  const [ourScore, setOurScore] = useState(initial?.ourScore != null ? String(initial.ourScore) : "");
  const [theirScore, setTheirScore] = useState(initial?.theirScore != null ? String(initial.theirScore) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [voteDeadline, setVoteDeadline] = useState(initial?.voteDeadline ? toDateTimeLocal(initial.voteDeadline) : "");
  const [formationId, setFormationId] = useState(initial?.formationId ?? "");
  const [goals, setGoals] = useState<GoalDraft[]>(() =>
    (initial?.goals ?? []).map((goal) => ({
      key: goal.id,
      scorerId: goal.scorerId ?? "",
      assistId: goal.assistId ?? "",
    })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const toNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));
  const ourScoreNumber = toNumber(ourScore);
  const goalCountMismatch =
    hasResult && ourScoreNumber !== undefined && Number.isInteger(ourScoreNumber) && goals.length !== ourScoreNumber;

  const updateGoal = (key: string, patch: Partial<GoalDraft>) =>
    setGoals((list) => list.map((goal) => (goal.key === key ? { ...goal, ...patch } : goal)));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors: fieldErrors } = validate(matchInputSchema, {
      playedAt,
      kickoffTime,
      opponent,
      ourScore: hasResult ? ourScoreNumber : null,
      theirScore: hasResult ? toNumber(theirScore) : null,
      location,
      memo,
      // 끝난 경기에는 마감 칸이 없으니 기존 값을 그대로 둔다.
      voteDeadline: hasResult ? (initial?.voteDeadline ?? null) : fromDateTimeLocal(voteDeadline),
      formationId: formationId || null,
      goals: hasResult
        ? goals.map((goal) => ({ scorerId: goal.scorerId || null, assistId: goal.assistId || null }))
        : [],
    });
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    try {
      await onSubmit(data);
    } catch (error) {
      setErrors(errorsFromApi(error));
    }
  };

  // 전광판 위 점수 칸: 비어 있으면 흐린 "-"(0과 헷갈리지 않게)를 보여 주고, 올리거나 누르면 amber 테두리.
  const scoreInput =
    "font-display h-16 text-center text-4xl border-transparent bg-on-pitch/10 placeholder:text-on-pitch/30 hover:border-on-pitch/25 focus-visible:border-amber focus-visible:ring-amber/30";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div role="group" aria-label="경기 상태" className="flex flex-wrap gap-2">
          <Chip pressed={hasResult} onClick={() => setHasResult(true)}>
            결과 기록
          </Chip>
          <Chip pressed={!hasResult} onClick={() => setHasResult(false)}>
            예정 경기
          </Chip>
        </div>
        <p className="text-xs text-muted">
          {hasResult
            ? "끝난 경기의 점수와 득점자를 기록해요."
            : "아직 안 한 경기예요. 모임원들이 참석 여부를 답할 수 있고, 경기 뒤에 결과를 입력하면 돼요."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_9rem_1fr]">
        <Field label="경기 날짜" htmlFor={`${id}-date`} error={errors.playedAt}>
          <Input
            id={`${id}-date`}
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            invalid={!!errors.playedAt}
            required
          />
        </Field>
        <Field label="킥오프" htmlFor={`${id}-kickoff`} error={errors.kickoffTime} optional>
          <Select
            id={`${id}-kickoff`}
            value={kickoffTime}
            onChange={setKickoffTime}
            invalid={!!errors.kickoffTime}
            options={KICKOFF_OPTIONS}
          />
        </Field>
        <Field label="상대팀" htmlFor={`${id}-opponent`} error={errors.opponent} className="col-span-2 sm:col-span-1">
          <Input
            id={`${id}-opponent`}
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="예: FC 한강"
            maxLength={30}
            invalid={!!errors.opponent}
            autoComplete="off"
          />
        </Field>
      </div>

      {hasResult && (
        <fieldset className="rounded-xl bg-pitch-deep p-4 text-on-pitch">
          <legend className="sr-only">점수</legend>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <label htmlFor={`${id}-our`} className="truncate text-center text-sm text-on-pitch/80">
              {CLUB_NAME}
            </label>
            <span aria-hidden />
            <label htmlFor={`${id}-their`} className="truncate text-center text-sm text-on-pitch/80">
              {opponent.trim() || "상대팀"}
            </label>

            <Input
              id={`${id}-our`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={ourScore}
              onChange={(e) => setOurScore(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="-"
              className={cn(scoreInput, "text-amber")}
              invalid={!!errors.ourScore}
              aria-describedby={errors.ourScore ? `${id}-score-error` : undefined}
            />
            <span aria-hidden className="font-display text-3xl text-on-pitch/50">
              :
            </span>
            <Input
              id={`${id}-their`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={theirScore}
              onChange={(e) => setTheirScore(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="-"
              className={cn(scoreInput, "text-on-pitch")}
              invalid={!!errors.theirScore}
              aria-describedby={errors.theirScore ? `${id}-score-error` : undefined}
            />
          </div>
          {(errors.ourScore || errors.theirScore) && (
            <p id={`${id}-score-error`} role="alert" className="mt-3 text-center text-sm text-amber">
              {errors.ourScore ?? errors.theirScore}
            </p>
          )}
        </fieldset>
      )}

      <Field label="장소" htmlFor={`${id}-location`} error={errors.location} optional>
        <Input
          id={`${id}-location`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="예: 반포 잔디구장"
          maxLength={50}
          invalid={!!errors.location}
        />
      </Field>

      {!hasResult && (
        <Field
          label="참석 투표 마감"
          htmlFor={`${id}-deadline`}
          error={errors.voteDeadline}
          hint="마감 뒤에는 참석 여부를 바꿀 수 없어요. 비워 두면 마감 없이 계속 받아요."
          optional
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`${id}-deadline`}
              type="datetime-local"
              value={voteDeadline}
              onChange={(e) => setVoteDeadline(e.target.value)}
              invalid={!!errors.voteDeadline}
              className="sm:max-w-xs"
            />
            <Button variant="secondary" onClick={() => setVoteDeadline(eveningBefore(playedAt))} disabled={!playedAt}>
              전날 21:00
            </Button>
            {voteDeadline && (
              <Button variant="ghost" className="text-muted" onClick={() => setVoteDeadline("")}>
                지우기
              </Button>
            )}
          </div>
        </Field>
      )}

      {hasResult && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">
              득점 기록{" "}
              {goals.length > 0 && <span className="font-display text-muted">{goals.length}</span>}
            </h2>
            {goalCountMismatch && (
              <p className="text-xs text-muted">
                우리 팀 {ourScoreNumber}점인데 기록은 {goals.length}개예요
              </p>
            )}
          </div>

          {players.data && players.data.length === 0 && (
            <p className="text-sm text-muted">
              아직 등록된 선수가 없어요.{" "}
              <Link href="/players" className="font-medium text-pitch-ink underline underline-offset-2">
                선수를 먼저 등록
              </Link>
              하면 득점자를 고를 수 있어요.
            </p>
          )}

          {goals.length > 0 && (
            <ol className="flex flex-col gap-2">
              {goals.map((goal, index) => (
                <li key={goal.key} className="flex items-center gap-2">
                  <span className="font-display w-5 shrink-0 text-center text-sm text-muted">{index + 1}</span>
                  <PlayerPicker
                    compact
                    label={`${index + 1}번째 골 득점자`}
                    emptyLabel="득점자 미상"
                    players={playerList}
                    value={goal.scorerId}
                    // 도움으로 고른 사람을 득점자로 바꾸면 도움은 비운다 (같은 사람이 골·도움일 수 없다).
                    onChange={(scorerId) =>
                      updateGoal(goal.key, scorerId && scorerId === goal.assistId ? { scorerId, assistId: "" } : { scorerId })
                    }
                    describe={describePosition}
                    className="min-w-0 flex-1"
                  />
                  <PlayerPicker
                    compact
                    label={`${index + 1}번째 골 도움`}
                    emptyLabel="도움 없음"
                    players={playerList.filter((player) => player.id !== goal.scorerId)}
                    value={goal.assistId}
                    onChange={(assistId) => updateGoal(goal.key, { assistId })}
                    describe={describePosition}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${index + 1}번째 골 삭제`}
                    onClick={() => setGoals((list) => list.filter((g) => g.key !== goal.key))}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setGoals((list) => [...list, newGoal()])}
            disabled={goals.length >= 30}
          >
            <Plus className="size-4" aria-hidden />
            득점 추가
          </Button>
          <InlineError>{errors.goals}</InlineError>
        </section>
      )}

      <Field
        label="사용한 포메이션"
        htmlFor={`${id}-formation`}
        error={errors.formationId}
        hint="포메이션 화면에서 저장한 라인업을 이 경기에 붙여 둘 수 있어요."
        optional
      >
        <Select
          id={`${id}-formation`}
          value={formationId}
          onChange={setFormationId}
          invalid={!!errors.formationId}
          options={[
            { value: "", label: "없음" },
            ...(formations.data ?? []).map((formation) => ({
              value: formation.id,
              label: formation.name,
              hint: summarizeShapes(formation.quarters.map((q) => q.shape)),
            })),
          ]}
        />
      </Field>

      <Field label="메모" htmlFor={`${id}-memo`} error={errors.memo} optional>
        <Textarea
          id={`${id}-memo`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="경기 흐름, 날씨, 특이사항 등"
          maxLength={1000}
          invalid={!!errors.memo}
        />
      </Field>

      <InlineError>{errors[FORM_ERROR_KEY]}</InlineError>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Link
          href={cancelHref}
          className={buttonStyles({ variant: "ghost", className: "text-muted" })}
        >
          취소
        </Link>
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
