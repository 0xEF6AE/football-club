import type { Metadata } from "next";
import { Container } from "@/components/ui/PageHeader";
import { MatchDetail } from "@/features/matches/components/MatchDetail";
import { formatVoteDeadline } from "@/features/matches/match-text";
import { getMatchResult, isPlayed, MATCH_RESULT_LABEL, summarizeScorers } from "@/features/matches/schema";
import { CLUB_NAME } from "@/lib/config";
import { formatKickoffTime, formatMatchDate } from "@/lib/utils";
import { getMatch } from "@/server/matches";

type Props = { params: Promise<{ id: string }> };

/**
 * 제목·설명을 <title>/<meta description>과 og: 태그 양쪽에 넣는다. 카톡은 og:를 읽는다.
 * 루트 레이아웃의 openGraph를 통째로 덮어쓰므로 siteName·locale도 다시 적는다. 이미지는 같은 폴더의 opengraph-image가 붙는다.
 */
function withPreview(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: { type: "website", siteName: CLUB_NAME, locale: "ko_KR", title, description },
  };
}

/** 카톡 등에 링크를 올리면 점수와 득점자가 미리보기에 뜨도록 제목/설명을 경기 데이터로 만든다. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) return { title: "경기 상세" };

  const date = formatMatchDate(match.playedAt);
  if (match.cancelled) {
    return withPreview(`${date} vs ${match.opponent} 경기 취소`, match.cancelReason ? `취소 사유: ${match.cancelReason}` : "이 경기는 취소됐어요");
  }
  if (isPlayed(match)) {
    const title = `${date} vs ${match.opponent} ${match.ourScore}:${match.theirScore} ${MATCH_RESULT_LABEL[getMatchResult(match)]}`;
    const scorers = summarizeScorers(match.goals);
    const description = [scorers ? `득점 ${scorers}` : null, match.location, "경기 피드백을 익명으로 남겨 보세요"]
      .filter(Boolean)
      .join(" / ");
    return withPreview(title, description);
  }

  const title = `${date} vs ${match.opponent} 경기 예정`;
  const description = [
    match.kickoffTime ? `킥오프 ${formatKickoffTime(match.kickoffTime)}` : null,
    match.location,
    `투표 마감 ${formatVoteDeadline(match)}`,
    "참석 여부를 알려 주세요",
  ]
    .filter(Boolean)
    .join(" / ");
  return withPreview(title, description);
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  return (
    <Container>
      <MatchDetail id={id} />
    </Container>
  );
}
