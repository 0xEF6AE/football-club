import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더(/Users/smd)에 다른 package-lock.json이 있어 워크스페이스 루트를 명시한다.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
