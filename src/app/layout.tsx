import type { Metadata, Viewport } from "next";
import { Oswald } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { CLUB_NAME } from "@/lib/config";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: CLUB_NAME, template: `%s · ${CLUB_NAME}` },
  description: "경기 결과, 익명 피드백, 포메이션을 한곳에서",
  applicationName: CLUB_NAME,
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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
