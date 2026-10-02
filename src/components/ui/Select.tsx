"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlStyles } from "./Field";
import { optionStyles, placementFor, popoverStyles, type PopoverPlacement } from "./listbox";

export type SelectOption = {
  value: string;
  label: string;
  /** 오른쪽에 흐리게 붙는 보조 정보 (예: 포메이션 모양) */
  hint?: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** 고른 값이 목록에 없을 때 보이는 문구 */
  placeholder?: string;
  /** <Field htmlFor>와 연결할 id */
  id?: string;
  "aria-label"?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** 바깥 래퍼(폭 지정용)에 붙는다 */
  className?: string;
};

/**
 * 앱 디자인에 맞춘 선택칸 (브라우저 기본 드롭다운 대신).
 * 누르면 아래(공간이 없으면 위)에 목록이 열리고, 고른 항목에 체크가 붙는다.
 * 키보드: ↑↓ 이동, Home/End, Enter·Space 고르기, Esc 닫기, 글자를 치면 그 글자로 시작하는 항목으로.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "선택",
  id,
  "aria-label": ariaLabel,
  invalid,
  disabled,
  className,
}: SelectProps) {
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const listId = `${autoId}-list`;
  const optionId = (index: number) => `${autoId}-option-${index}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<PopoverPlacement>("bottom");

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const openList = () => {
    setPlacement(placementFor(triggerRef.current));
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const choose = (option: SelectOption) => {
    setOpen(false);
    if (option.value !== value) onChange(option.value);
  };

  // 열려 있을 때 바깥을 누르면 닫는다. (iOS Safari는 버튼을 눌러도 포커스를 주지 않아 blur만으로는 안 닫힌다.)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // 움직인 항목(처음 열 때는 고른 항목)이 보이게 스크롤한다.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  /** 글자를 연달아 치면 이어 붙여서 그걸로 시작하는 항목을 찾는다 (0.7초 지나면 새로). */
  const jumpTo = (char: string) => {
    const now = Date.now();
    const buffer = now - typeahead.current.at < 700 ? typeahead.current.text + char : char;
    typeahead.current = { text: buffer, at: now };
    const needle = buffer.toLocaleLowerCase("ko");
    const index = options.findIndex((o) => o.label.toLocaleLowerCase("ko").startsWith(needle));
    if (index < 0) return;
    if (open) setActive(index);
    else if (options[index].value !== value) onChange(options[index].value);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.nativeEvent.isComposing) return;
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        jumpTo(event.key);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (options[active]) choose(options[active]);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) jumpTo(event.key);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => {
          triggerRef.current?.focus();
          if (open) setOpen(false);
          else openList();
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          controlStyles,
          "flex items-center gap-2 text-left",
          open && "border-pitch-ink ring-3 ring-pitch-ink/15",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted/80")}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.hint && <span className="shrink-0 text-xs tabular-nums text-muted">{selected.hint}</span>}
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={ariaLabel ? undefined : triggerId}
          aria-label={ariaLabel}
          // 항목을 누를 때 버튼이 먼저 blur되어 목록이 닫히지 않게 한다.
          onMouseDown={(e) => e.preventDefault()}
          className={popoverStyles(placement)}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(option)}
                onMouseMove={() => setActive(index)}
                className={optionStyles({ active: index === active, selected: isSelected })}
              >
                <Check aria-hidden className={cn("size-4 shrink-0 text-pitch-ink", !isSelected && "invisible")} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint && (
                  <span className="shrink-0 text-xs font-normal tabular-nums text-muted">{option.hint}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
