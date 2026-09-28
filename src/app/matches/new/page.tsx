import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { MatchCreate } from "@/features/matches/components/MatchEditor";

export const metadata: Metadata = { title: "경기 기록" };

export default function NewMatchPage() {
  return (
    <Container>
      <PageHeader title="경기 기록" description="점수와 득점자를 적어 두면 시즌 전적에 바로 반영돼요." />
      <MatchCreate />
    </Container>
  );
}
