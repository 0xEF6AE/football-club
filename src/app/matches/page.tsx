import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { AdminOnly } from "@/features/admin/components/AdminOnly";
import { MatchList } from "@/features/matches/components/MatchList";

export const metadata: Metadata = { title: "경기" };

export default function MatchesPage() {
  return (
    <Container>
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
