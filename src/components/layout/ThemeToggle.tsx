"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { applyTheme, readTheme, subscribeTheme, THEME_LABEL, type Theme } from "@/lib/theme";

/**
 * 라이트 ↔ 다크 토글. 지금 테마의 아이콘(해/달)을 보여 주고 누르면 반대로 바꾼다.
 * 어떤 아이콘을 보일지는 CSS `dark:` 변형이 고르므로 hydration 전에도 첫 페인트부터 맞는다.
 * 서버는 테마를 모르므로 라벨만 hydration 뒤에 채워진다.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribeTheme, readTheme, () => null);
  const next: Theme | null = theme && (theme === "dark" ? "light" : "dark");

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => applyTheme(readTheme() === "dark" ? "light" : "dark")}
      aria-label={next ? `${THEME_LABEL[next]} 모드로 바꾸기` : "테마 바꾸기"}
      title={next ? `${THEME_LABEL[next]} 모드로 바꾸기` : undefined}
    >
      <Sun className="size-4.5 dark:hidden" aria-hidden />
      <Moon className="hidden size-4.5 dark:block" aria-hidden />
    </Button>
  );
}
