import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { MatchEdit } from "@/features/matches/components/MatchEditor";

export const metadata: Metadata = { title: "경기 수정" };

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Container>
      <PageHeader title="경기 수정" />
      <MatchEdit id={id} />
    </Container>
  );
}
