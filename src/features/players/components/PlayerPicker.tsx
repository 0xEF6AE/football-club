"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { controlStyles } from "@/components/ui/Field";
import { optionStyles, placementFor, popoverStyles, type PopoverPlacement } from "@/components/ui/listbox";
import { cn } from "@/lib/utils";
import type { Player } from "../schema";
import { searchByName } from "../search";

type PlayerPickerProps = {
  players: Player[];
  /** 고른 선수 id. 없으면 "" */
  value: string;
  onChange: (playerId: string) => void;
  /** 화면에 보이지 않는 이름표 (스크린 리더용) */
  label: string;
  placeholder?: string;
  /** 목록에서 이름 오른쪽에 붙일 짧은 정보 (예: 지금 참석 상태) */
  describe?: (player: Player) => React.ReactNode;
  /**
   * "아무도 아님"을 고를 수 있게 목록 맨 위에 둘 항목 (예: "득점자 미상"). 값은 "".
   * 아무도 안 골랐을 때 칸에 흐리게 이 문구가 보인다.
   */
  emptyLabel?: string;
  /** 좁은 칸용: 앞의 돋보기 아이콘을 뺀다 */
  compact?: boolean;
  className?: string;
};

/** 목록의 한 줄. id가 ""이면 emptyLabel 항목 */
type Entry = { id: string; name: string; player?: Player };

/**
 * 이름을 쳐서 찾는 선수 선택 칸 (콤보박스).
 * 이름 일부·초성("ㅇㅁㅅ")·입력 중인 글자로 거른다(search.ts). 방향키로 움직이고 Enter로 고르고 Esc로 닫는다.
 * 고른 뒤에는 칸에 그 이름이 보이고, 다시 누르면 전체 목록이 열린다.
 */
export function PlayerPicker({
  players,
  value,
  onChange,
  label,
  placeholder = "이름 검색",
  describe,
  emptyLabel,
  compact = false,
  className,
}: PlayerPickerProps) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<PopoverPlacement>("bottom");

  const selected = players.find((p) => p.id === value);
  const results = useMemo<Entry[]>(() => {
    const found = searchByName(players, query).map((player) => ({ id: player.id, name: player.name, player }));
    // "없음" 항목은 검색어가 없을 때만 맨 위에 둔다 (이름을 치는 중에는 방해만 된다).
    return emptyLabel && query.trim() === "" ? [{ id: "", name: emptyLabel }, ...found] : found;
  }, [players, query, emptyLabel]);
  const optionId = (index: number) => `${id}-option-${index}`;

  // 방향키로 움직인 항목이 목록 밖에 있으면 보이게 스크롤한다.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    setPlacement(placementFor(inputRef.current));
    setQuery("");
    setActive(Math.max(0, results.findIndex((p) => p.id === value)));
    setOpen(true);
  };

  const choose = (entry: Entry) => {
    onChange(entry.id);
    setOpen(false);
    setQuery("");
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 Enter는 글자 확정이므로 고르지 않는다.
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.min(results.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Enter":
        if (open && results[active]) {
          event.preventDefault();
          choose(results[active]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
    }
  };

  return (
    <div className={cn("relative", className)}>
      {!compact && (
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      )}
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? optionId(active) : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        value={open ? query : (selected?.name ?? "")}
        placeholder={open ? (selected?.name ?? placeholder) : (emptyLabel ?? placeholder)}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={cn(controlStyles, compact ? "pl-3 pr-9" : "pl-9 pr-10", selected && !open && "font-medium")}
      />
      {selected && !open ? (
        <button
          type="button"
          aria-label={emptyLabel ? `${emptyLabel}로 바꾸기` : "고른 이름 지우기"}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-pitch-ink/40"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : (
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      )}

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${label} 목록`}
          // 항목을 누를 때 입력칸이 먼저 blur되어 목록이 닫히지 않게 한다.
          onMouseDown={(e) => e.preventDefault()}
          className={popoverStyles(placement)}
        >
          {results.length === 0 ? (
            <li className="px-2.5 py-2.5 text-sm text-muted">
              &lsquo;{query.trim()}&rsquo;와(과) 맞는 이름이 없어요
            </li>
          ) : (
            results.map((entry, index) => (
              <li
                key={entry.id || "none"}
                id={optionId(index)}
                data-index={index}
                role="option"
                aria-selected={entry.id === value}
                onClick={() => choose(entry)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  optionStyles({ active: index === active, selected: entry.id === value }),
                  !entry.player && "text-muted",
                )}
              >
                <Check aria-hidden className={cn("size-4 shrink-0 text-pitch-ink", entry.id !== value && "invisible")} />
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                {describe && entry.player && (
                  <span className="shrink-0 text-xs font-normal text-muted">{describe(entry.player)}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
