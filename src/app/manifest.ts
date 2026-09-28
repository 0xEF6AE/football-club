import type { MetadataRoute } from "next";
import { CLUB_NAME } from "@/lib/config";

/** 홈 화면에 추가할 때 쓰는 웹 앱 매니페스트. /manifest.webmanifest 로 제공된다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: CLUB_NAME,
    short_name: CLUB_NAME,
    description: "경기 결과, 익명 피드백, 포메이션을 한곳에서",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4ef",
    theme_color: "#1b5e3b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
