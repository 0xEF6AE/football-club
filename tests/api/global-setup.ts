import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { TestProject } from "vitest/node";

/**
 * API 테스트용 빈 DB 템플릿을 한 번 만든다 (drizzle 스키마 그대로 push).
 * 각 테스트 파일은 setup.ts에서 이 파일을 복사해 자기만의 DB로 쓴다. 실제 local.db·Turso는 건드리지 않는다.
 */
export default function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), "fc-api-test-"));
  const template = join(dir, "template.db");
  const root = resolve(import.meta.dirname, "../..");
  execFileSync(join(root, "node_modules/.bin/drizzle-kit"), ["push"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${template}`, DATABASE_AUTH_TOKEN: "" },
    stdio: "pipe",
  });
  project.provide("dbTemplate", template);
  return () => rmSync(dir, { recursive: true, force: true });
}

declare module "vitest" {
  export interface ProvidedContext {
    dbTemplate: string;
  }
}
