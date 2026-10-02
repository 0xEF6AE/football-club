"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ClipboardPen, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useAdmin } from "@/features/admin/queries";
import { formatMatchDate } from "@/lib/utils";
import { useMatches } from "../queries";
import { isAwaitingResult } from "../schema";

/**
 * 관리자에게만, 모든 화면 맨 위(헤더 바로 아래)에 "결과를 입력해 주세요"를 띄운다.
 * 결과를 기다리는 경기가 여럿이면 가장 오래된 경기부터 안내한다. 입력하면 경기 목록이 새로 받아져 저절로 사라진다.
 * "나중에"를 누르면 같은 경기 묶음에 대해서는 새로고침 전까지 다시 띄우지 않는다.
 */
export function ResultReminder() {
  const { isAdmin } = useAdmin();
  const matches = useMatches();
  const pathname = usePathname();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  if (!isAdmin || !matches.data) return null;

  const waiting = matches.data
    .filter((match) => isAwaitingResult(match))
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  if (waiting.length === 0) return null;

  const key = waiting.map((match) => match.id).join(",");
  const first = waiting[0];
  const editHref = `/matches/${first.id}/edit`;
  // 이미 그 경기 결과를 입력하는 중이거나, 첫 화면 연출 중이면 띄우지 않는다.
  if (dismissedKey === key || pathname === editHref || pathname === "/") return null;

  return (
    <div role="status" className="border-b border-pitch-ink/20 bg-pitch-ink/8">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <ClipboardPen className="size-5 shrink-0 text-pitch-ink" aria-hidden />
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <b className="font-semibold">
            {formatMatchDate(first.playedAt)} {first.opponent}전
          </b>{" "}
          결과를 입력해 주세요
          {waiting.length > 1 && <span className="text-muted"> (외 {waiting.length - 1}경기)</span>}
        </p>
        <Link href={editHref} className={buttonStyles({ size: "sm" })}>
          결과 입력
        </Link>
        <Button
          variant="ghost"
          size="sm"
          aria-label="나중에 하기"
          title="나중에 하기"
          className="-mr-2 w-9 px-0 text-muted"
          onClick={() => setDismissedKey(key)}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
