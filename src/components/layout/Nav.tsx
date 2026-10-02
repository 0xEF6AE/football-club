"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, LayoutGrid, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/matches", label: "경기", icon: Trophy },
  { href: "/stats", label: "기록", icon: ChartColumn },
  { href: "/players", label: "선수", icon: Users },
  { href: "/formation", label: "포메이션", icon: LayoutGrid },
] as const;

export function Nav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "top") {
    return (
      <nav aria-label="주 메뉴" className="mr-2 hidden items-center gap-1 md:flex">
        {ITEMS.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-[15px] font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-pitch-ink/40",
                active ? "text-pitch-ink" : "text-muted hover:text-fg",
              )}
            >
              {label}
              {active && <span aria-hidden className="absolute inset-x-3 -bottom-3.75 h-0.5 rounded-full bg-pitch-ink" />}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-surface/85 md:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium outline-none transition-colors",
                  active ? "text-pitch-ink" : "text-muted active:text-fg",
                )}
              >
                {/* 현재 탭은 아이콘 뒤에 옅은 알약을 깔아 한눈에 보이게 한다 */}
                <span
                  className={cn(
                    "grid h-7 w-14 place-items-center rounded-full transition-colors duration-200",
                    "group-focus-visible:ring-2 group-focus-visible:ring-pitch-ink/40",
                    active ? "bg-pitch-ink/12" : "group-active:bg-surface-2",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
