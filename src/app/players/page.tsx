import type { Metadata } from "next";
import { Container } from "@/components/ui/PageHeader";
import { PlayerList } from "@/features/players/components/PlayerList";

export const metadata: Metadata = { title: "선수" };

export default function PlayersPage() {
  return (
    <Container>
      <PlayerList />
    </Container>
  );
}
