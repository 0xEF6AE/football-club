import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    projects: [
      {
        // 순수 로직 단위 테스트
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      {
        // Route Handler를 직접 불러 규칙(관리자·PIN·익명·도배 방지)을 지키는지 본다. 파일마다 빈 SQLite를 쓴다.
        resolve: { alias },
        test: {
          name: "api",
          include: ["tests/api/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/api/global-setup.ts"],
          setupFiles: ["tests/api/setup.ts"],
        },
      },
    ],
  },
});
