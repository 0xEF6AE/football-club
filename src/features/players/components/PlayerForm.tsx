"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { InlineError } from "@/components/ui/States";
import { errorsFromApi, FORM_ERROR_KEY, validate, type FieldErrors } from "@/lib/form";
import {
  POSITION_GROUP,
  POSITION_GROUP_LABEL,
  POSITION_GROUPS,
  POSITION_LABEL,
  POSITIONS,
  type Position,
} from "@/lib/positions";
import { playerInputSchema, type PlayerInput } from "../schema";

type PlayerFormProps = {
  initial?: PlayerInput;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: PlayerInput) => Promise<unknown>;
  onCancel: () => void;
};

export function PlayerForm({ initial, submitLabel, pending, onSubmit, onCancel }: PlayerFormProps) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  // 누른 순서 = 선호 순서. 배열 앞이 주 포지션.
  const [positions, setPositions] = useState<Position[]>(initial?.positions ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});

  const toggle = (position: Position) =>
    setPositions((list) => (list.includes(position) ? list.filter((p) => p !== position) : [...list, position]));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors: fieldErrors } = validate(playerInputSchema, { name, positions });
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

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4"
      aria-label={initial ? "선수 수정" : "선수 추가"}
    >
      <Field label="이름" htmlFor={`${id}-name`} error={errors.name}>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="off"
          autoFocus
          invalid={!!errors.name}
        />
      </Field>

      <div className="flex flex-col gap-2.5">
        <p className="text-sm font-medium">
          가능한 포지션 <span className="ml-1 text-xs font-normal text-muted">누르는 순서가 선호 순서예요</span>
        </p>
        <div role="group" aria-label="가능한 포지션" className="flex flex-col gap-2">
          {POSITION_GROUPS.map((group) => (
            <div key={group} className="flex flex-wrap items-center gap-1.5">
              <span className="w-14 shrink-0 text-xs text-muted">{POSITION_GROUP_LABEL[group]}</span>
              {POSITIONS.filter((p) => POSITION_GROUP[p] === group).map((position) => {
                const order = positions.indexOf(position);
                return (
                  <Chip
                    key={position}
                    size="sm"
                    pressed={order >= 0}
                    onClick={() => toggle(position)}
                    className="font-display tracking-wide"
                    title={POSITION_LABEL[position]}
                    aria-label={`${POSITION_LABEL[position]} ${position}`}
                  >
                    {position}
                    {order >= 0 && (
                      <span
                        aria-hidden
                        className="grid size-4 place-items-center rounded-full bg-on-pitch/25 text-[10px] leading-none"
                      >
                        {order + 1}
                      </span>
                    )}
                  </Chip>
                );
              })}
            </div>
          ))}
        </div>
        {positions.length > 0 ? (
          <p className="text-xs text-muted">주 포지션은 {POSITION_LABEL[positions[0]]}이에요.</p>
        ) : null}
        <InlineError>{errors.positions}</InlineError>
      </div>

      <InlineError>{errors[FORM_ERROR_KEY]}</InlineError>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          취소
        </Button>
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
