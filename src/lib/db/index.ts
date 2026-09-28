import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * 로컬 개발: DATABASE_URL 미설정 시 프로젝트 루트의 local.db(SQLite 파일)를 사용.
 * 배포: Turso 등 libsql 호환 URL + DATABASE_AUTH_TOKEN.
 */
function createDb() {
  const client = createClient({
    // 배포 화면에 붙여 넣을 때 끝에 줄바꿈·공백이 섞여도 동작하도록 잘라 낸다.
    url: process.env.DATABASE_URL?.trim() || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

// 개발 중 HMR로 모듈이 다시 평가될 때 커넥션이 계속 늘어나지 않도록 전역에 보관한다.
const globalForDb = globalThis as unknown as { __db?: Db };

export const db: Db = globalForDb.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}
