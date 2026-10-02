"use client";

import { Chip } from "@/components/ui/Chip";
import { normalizeQuarterList, QUARTER_INDEXES } from "@/features/formations/schema";

type QuarterPickerProps = {
  /** 뛸 수 있는 쿼터. null = 네 쿼터 모두 */
  value: number[] | null;
  onChange: (quarters: number[] | null) => void;
  disabled?: boolean;
  label?: string;
};

/**
 * 늦참·조퇴용 쿼터 고르기 칩 (1Q~4Q). 켜진 쿼터가 뛸 수 있는 쿼터다.
 * 마지막 하나는 끌 수 없다 (전부 못 뛰면 불참이다).
 */
export function QuarterPicker({ value, onChange, disabled, label = "뛸 수 있는 쿼터" }: QuarterPickerProps) {
  const on = (q: number) => !value || value.includes(q);
  const toggle = (q: number) => {
    const current = QUARTER_INDEXES.filter(on);
    const next = on(q) ? current.filter((v) => v !== q) : [...current, q];
    if (next.length === 0) return;
    onChange(normalizeQuarterList(next));
  };
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {QUARTER_INDEXES.map((q) => (
        <Chip key={q} size="sm" pressed={on(q)} disabled={disabled} onClick={() => toggle(q)} className="font-display px-3 tracking-wide">
          {q + 1}Q
        </Chip>
      ))}
    </div>
  );
}
