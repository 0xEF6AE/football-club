import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * 로컬: `npm run db:push` → 프로젝트 루트 local.db에 테이블 생성.
 * 배포: DATABASE_URL / DATABASE_AUTH_TOKEN(Turso 등 libsql 호환)을 .env에 넣고 같은 명령 실행.
 * URL 규칙은 src/lib/db/index.ts와 동일해야 한다.
 */
export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
});
