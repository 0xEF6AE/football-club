/** 화면에 표시되는 모임 이름. .env의 NEXT_PUBLIC_CLUB_NAME으로 바꿀 수 있다. */
export const CLUB_NAME = process.env.NEXT_PUBLIC_CLUB_NAME?.trim() || "뽀잉 fc";

/** 링크 미리보기(카톡 등)에 쓰는 한 줄 소개 */
export const CLUB_DESCRIPTION = "경기 결과, 참석 투표, 라인업을 한곳에서";

/**
 * 사이트 기본 주소. 링크 미리보기 이미지 주소를 절대 경로로 만드는 데 쓴다.
 * .env의 NEXT_PUBLIC_SITE_URL → Vercel이 넣어 주는 운영 도메인 → 로컬 순서로 고른다.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
