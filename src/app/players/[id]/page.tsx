import type { Metadata } from "next";
import { Container } from "@/components/ui/PageHeader";
import { PlayerDetail } from "@/features/players/components/PlayerDetail";
import { getPlayer } from "@/server/players";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  return { title: player ? `${player.name} 기록` : "선수 기록" };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  return (
    <Container>
      <PlayerDetail id={id} />
    </Container>
  );
}
