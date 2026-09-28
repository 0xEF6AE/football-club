import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { inject } from "vitest";

/**
 * 테스트 파일마다 빈 DB를 복사해 DATABASE_URL로 지정한다. src/lib/db를 import하기 전에 실행된다.
 * 개발 모드에서 커넥션을 globalThis에 캐시하므로, 이전 파일의 커넥션이 남아 있으면 지운다.
 */
const template = inject("dbTemplate");
const file = join(dirname(template), `${crypto.randomUUID()}.db`);
copyFileSync(template, file);
process.env.DATABASE_URL = `file:${file}`;
process.env.DATABASE_AUTH_TOKEN = "";
delete (globalThis as { __db?: unknown }).__db;
