import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { Splash } from "@/components/layout/Splash";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { AdminOnly } from "@/features/admin/components/AdminOnly";
import { MatchList } from "@/features/matches/components/MatchList";

export const metadata: Metadata = { title: "경기" };

export default function MatchesPage() {
  return (
    <Container>
      {/* 첫 화면 킥오프 연출. 세션당 한 번, 서버 HTML에 들어 있어야 본문이 먼저 번쩍이지 않는다. */}
      <Splash />
      <PageHeader
        title="경기"
        actions={
          <AdminOnly>
            <Link href="/matches/new" className={buttonStyles({ variant: "accent" })}>
              <Plus className="size-4" aria-hidden />
              경기 등록
            </Link>
          </AdminOnly>
        }
      />
      <MatchList />
    </Container>
  );
}
