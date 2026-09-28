import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { Leaderboard } from "@/features/matches/components/Leaderboard";

export const metadata: Metadata = { title: "기록" };

export default function StatsPage() {
  return (
    <Container>
      <PageHeader title="기록" description="결과가 기록된 경기의 골과 도움을 모아 순위를 매겨요." />
      <Leaderboard />
    </Container>
  );
}
