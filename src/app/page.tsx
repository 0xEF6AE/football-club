import Link from "next/link";
import { CLUB_NAME } from "@/lib/config";

/**
 * 첫 화면 "/". 레이아웃의 킥오프 스플래시(components/layout/Splash.tsx)가 화면을 덮고 연출이 끝나면 /matches로 넘긴다.
 * 여기 자체에는 보여 줄 게 없다. 자바스크립트가 꺼진 브라우저를 위해 경기 목록 링크만 둔다.
 */
export default function HomePage() {
  return (
    <noscript>
      <p className="py-10 text-center">
        <Link href="/matches" className="font-medium text-pitch underline underline-offset-2">
          {CLUB_NAME} 경기 목록 보기
        </Link>
      </p>
    </noscript>
  );
}
