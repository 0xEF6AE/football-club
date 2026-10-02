import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * 로컬: `npm run db:push` → .env 기준, 보통 프로젝트 루트 local.db에 반영.
 * 배포: `npm run db:push:turso` → DRIZZLE_ENV=.env.turso 의 Turso 접속 정보로 배포 DB에 반영.
 * 스키마(src/lib/db/schema.ts)를 바꾸면 둘 다 실행한다. URL 규칙은 src/lib/db/index.ts와 동일해야 한다.
 */
const envFile = process.env.DRIZZLE_ENV;
const loaded = config({ path: envFile ?? ".env", quiet: true });

// Turso용 파일을 지정했는데 못 읽었거나 주소가 Turso가 아니면, 조용히 local.db로 가지 않게 멈춘다.
if (envFile && (loaded.error || !process.env.DATABASE_URL?.trim().startsWith("libsql://"))) {
  throw new Error(`${envFile}에서 Turso DATABASE_URL(libsql://...)을 읽지 못했어요`);
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL?.trim() || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  },
});
