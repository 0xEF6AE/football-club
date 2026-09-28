import type { Metadata, Viewport } from "next";
import { Oswald } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { CLUB_DESCRIPTION, CLUB_NAME, SITE_URL } from "@/lib/config";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SPLASH_INIT_SCRIPT } from "@/lib/splash";
import { Providers } from "./providers";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: CLUB_NAME, template: `%s · ${CLUB_NAME}` },
  description: CLUB_DESCRIPTION,
  applicationName: CLUB_NAME,
  // 카톡 미리보기는 og: 태그를 읽는다 (없으면 "여기를 눌러 링크를 확인하세요"가 뜬다).
  // 이미지는 app/opengraph-image.jpg 파일이 자동으로 붙는다. 경기 상세는 자기 openGraph를 따로 정한다.
  openGraph: { type: "website", siteName: CLUB_NAME, locale: "ko_KR", title: CLUB_NAME, description: CLUB_DESCRIPTION },
  appleWebApp: { capable: true, title: CLUB_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1410" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme는 첫 페인트 전 인라인 스크립트가 붙이므로 서버 HTML과 달라질 수 있다.
    <html lang="ko" className={`${oswald.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + SPLASH_INIT_SCRIPT }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
