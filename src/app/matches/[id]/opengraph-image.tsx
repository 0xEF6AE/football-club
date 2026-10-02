import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getMatchResult, isPlayed, MATCH_RESULT_LABEL, summarizeScorers } from "@/features/matches/schema";
import { CLUB_NAME } from "@/lib/config";
import { formatKickoffTime, formatMatchDate } from "@/lib/utils";
import { getMatch } from "@/server/matches";

export const alt = "경기 결과";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 모임 엠블럼을 data URL로. Satori는 외부 경로 대신 데이터 URL을 그대로 그린다. 파일이 없으면 엠블럼 없이 그린다. */
async function loadLogo(): Promise<string | null> {
  try {
    const file = await readFile(join(process.cwd(), "public/logo.png"));
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * 링크 미리보기 이미지(전광판). 한글은 next/og가 Noto Sans KR을 자동으로 불러와 그린다.
 * Satori 규칙: 자식이 둘 이상인 요소는 반드시 display:flex.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [match, logo] = await Promise.all([getMatch(id), loadLogo()]);

  const meta = match
    ? [
        formatMatchDate(match.playedAt, { withYear: true }),
        match.kickoffTime ? formatKickoffTime(match.kickoffTime) : null,
        match.location,
      ]
        .filter(Boolean)
        .join("   ")
    : "";
  const played = match !== null && isPlayed(match);
  const resultLabel = match?.cancelled
    ? "경기 취소"
    : match && isPlayed(match)
      ? MATCH_RESULT_LABEL[getMatchResult(match)]
      : "경기 예정";
  const scorers = match ? summarizeScorers(match.goals) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f3d26",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {!match ? (
          <div style={{ fontSize: 48 }}>경기를 찾을 수 없어요</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
            <div style={{ fontSize: 30, opacity: 0.75 }}>{meta}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 320 }}>
                {/* Satori는 next/image를 지원하지 않으므로 일반 img에 데이터 URL을 넣는다 */}
                {logo ? <img src={logo} alt="" width={132} height={132} /> : null}
                <div style={{ fontSize: 40, fontWeight: 600, textAlign: "center" }}>{CLUB_NAME}</div>
              </div>
              {played ? (
                <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 190, fontWeight: 700, lineHeight: 1 }}>
                  <div style={{ color: "#e8a21b" }}>{match.ourScore}</div>
                  <div style={{ fontSize: 90, opacity: 0.4 }}>:</div>
                  <div>{match.theirScore}</div>
                </div>
              ) : (
                <div style={{ fontSize: 120, fontWeight: 700, color: "#e8a21b", lineHeight: 1 }}>vs</div>
              )}
              <div style={{ fontSize: 44, fontWeight: 600, maxWidth: 320, textAlign: "center" }}>{match.opponent}</div>
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 600,
                padding: "10px 32px",
                borderRadius: 999,
                background: played ? "#e8a21b" : "rgba(255,255,255,0.15)",
                color: played ? "#1a1200" : "#ffffff",
              }}
            >
              {resultLabel}
            </div>
            {played && scorers ? <div style={{ fontSize: 30, opacity: 0.8 }}>{`득점 ${scorers}`}</div> : null}
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
