import type { Metadata } from "next";
import { Container } from "@/components/ui/PageHeader";
import { MatchDetail } from "@/features/matches/components/MatchDetail";
import { getMatchResult, isPlayed, MATCH_RESULT_LABEL, summarizeScorers } from "@/features/matches/schema";
import { formatDateTime, formatKickoffTime, formatMatchDate } from "@/lib/utils";
import { getMatch } from "@/server/matches";

type Props = { params: Promise<{ id: string }> };

/** 카톡 등에 링크를 올리면 점수와 득점자가 미리보기에 뜨도록 제목/설명을 경기 데이터로 만든다. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) return { title: "경기 상세" };

  const date = formatMatchDate(match.playedAt);
  if (isPlayed(match)) {
    const title = `${date} vs ${match.opponent} ${match.ourScore}:${match.theirScore} ${MATCH_RESULT_LABEL[getMatchResult(match)]}`;
    const scorers = summarizeScorers(match.goals);
    const description = [scorers ? `득점 ${scorers}` : null, match.location, "경기 피드백을 익명으로 남겨 보세요"]
      .filter(Boolean)
      .join(" / ");
    return { title, description };
  }

  const title = `${date} vs ${match.opponent} 경기 예정`;
  const description = [
    match.kickoffTime ? `${formatKickoffTime(match.kickoffTime)} 킥오프` : null,
    match.location,
    match.voteDeadline ? `투표 마감 ${formatDateTime(match.voteDeadline)}` : null,
    "참석 여부를 알려 주세요",
  ]
    .filter(Boolean)
    .join(" / ");
  return { title, description };
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  return (
    <Container>
      <MatchDetail id={id} />
    </Container>
  );
}
