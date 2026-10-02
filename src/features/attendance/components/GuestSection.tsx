"use client";

import { useId, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { InlineError } from "@/components/ui/States";
import { formatQuarters } from "@/features/formations/schema";
import { getErrorMessage } from "@/lib/api-client";
import { errorsFromApi, FORM_ERROR_KEY, validate, type FieldErrors } from "@/lib/form";
import { POSITIONS, type Position } from "@/lib/positions";
import { useAddGuest, useRemoveGuest } from "../queries";
import { guestInputSchema, type MatchGuest } from "../schema";
import { QuarterPicker } from "./QuarterPicker";

type GuestSectionProps = {
  matchId: string;
  guests: MatchGuest[];
  /** 관리자(주장)면 추가·삭제 가능 */
  canEdit: boolean;
};

/**
 * 용병(게스트): 선수로 등록하지 않고 그 경기에만 오는 사람.
 * 주장이 이름·포지션·뛸 수 있는 쿼터를 넣으면 포메이션 화면의 "참석 투표에서 가져오기"로 라인업에 함께 들어간다.
 * 득점왕·참석률 같은 기록에는 들어가지 않는다.
 */
export function GuestSection({ matchId, guests, canEdit }: GuestSectionProps) {
  const id = useId();
  const add = useAddGuest(matchId);
  const remove = useRemoveGuest(matchId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [quarters, setQuarters] = useState<number[] | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  if (guests.length === 0 && !canEdit) return null;

  const reset = () => {
    setName("");
    setPositions([]);
    setQuarters(null);
    setErrors({});
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors: fieldErrors } = validate(guestInputSchema, { name, positions, quarters });
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    try {
      await add.mutateAsync({ matchId, input: data });
      reset();
      setOpen(false);
    } catch (error) {
      setErrors(errorsFromApi(error));
    }
  };

  const togglePosition = (position: Position) =>
    setPositions((list) => (list.includes(position) ? list.filter((p) => p !== position) : [...list, position]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">
          용병 <span className="font-display">{guests.length}</span>
        </p>
        {canEdit && !open && (
          <Button size="sm" variant="ghost" className="-mr-2 text-pitch-ink" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            용병 추가
          </Button>
        )}
      </div>

      {guests.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {guests.map((guest) => (
            <li
              key={guest.id}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-line bg-surface py-1 pl-2 pr-1 text-sm"
            >
              {guest.name}
              <span className="font-display text-xs text-muted">{guest.positions.join(" ")}</span>
              {formatQuarters(guest.quarters) && (
                <span className="text-xs text-muted">{formatQuarters(guest.quarters)}</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  aria-label={`용병 ${guest.name} 빼기`}
                  onClick={() => remove.mutate({ matchId, guestId: guest.id })}
                  className="-my-1 grid size-8 place-items-center rounded-md text-muted outline-none hover:bg-surface-2 hover:text-danger focus-visible:ring-2 focus-visible:ring-pitch-ink/40"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted/70">없음</p>
      )}
      <InlineError>{remove.isError ? getErrorMessage(remove.error) : null}</InlineError>

      {open && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              이름
            </label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              maxLength={20}
              invalid={!!errors.name}
              autoComplete="off"
            />
            {errors.name && <p className="text-sm text-danger">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">가능한 포지션</p>
            <div role="group" aria-label="가능한 포지션" className="flex flex-wrap gap-1.5">
              {POSITIONS.map((position) => (
                <Chip
                  key={position}
                  size="sm"
                  pressed={positions.includes(position)}
                  onClick={() => togglePosition(position)}
                  className="font-display px-3 tracking-wide"
                >
                  {position}
                </Chip>
              ))}
            </div>
            {errors.positions && <p className="text-sm text-danger">{errors.positions}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">뛸 수 있는 쿼터</p>
            <QuarterPicker value={quarters} onChange={setQuarters} />
          </div>
          <InlineError>{errors[FORM_ERROR_KEY]}</InlineError>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              className="text-muted"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              취소
            </Button>
            <Button type="submit" pending={add.isPending}>
              용병 추가
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
