import Image from "next/image";
import Link from "next/link";
import { AdminMenu } from "@/features/admin/components/AdminMenu";
import { CLUB_NAME } from "@/lib/config";
import { Nav } from "./Nav";
import { ThemeToggle } from "./ThemeToggle";

/**
 * 상단 바 + 본문 + (모바일) 하단 탭.
 * 데스크톱에서는 메뉴가 상단 바 오른쪽으로 올라가고, 모바일에서는 엄지가 닿는 하단 탭으로 내려간다.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur supports-backdrop-filter:bg-bg/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link
            href="/matches"
            className="flex min-w-0 items-center gap-2.5 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-pitch/40"
          >
            {/* 모임 엠블럼. 링 바깥이 투명한 원형 PNG라 라이트·다크 어디서나 그대로 얹힌다 */}
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              priority
              className="size-8 shrink-0 rounded-full"
            />
            <span className="truncate">{CLUB_NAME}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Nav variant="top" />
            <ThemeToggle />
            <AdminMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 pb-24 pt-3 md:pb-12">{children}</main>
      <Nav variant="bottom" />
    </>
  );
}
