@AGENTS.md

# 축구 모임 웹 (football-club)

주말 축구 모임의 경기 결과, 익명 피드백, 포메이션을 한곳에서 관리하는 앱. 모임원이 카톡방 대신 여기서 결과를 보고 피드백을 남기고, 주장이 참석자로 라인업을 짠다. 화면 문구는 전부 한국어.

## 명령

```bash
npm run dev        # http://localhost:3000
npm run db:push    # 스키마 → DB 테이블 (최초 1회, 스키마 바꿀 때마다)
npm run db:seed    # 예시 선수/경기 넣기 (선수가 있으면 건너뜀)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest: 순수 로직(src/**/*.test.ts) + API 규칙(tests/api, 파일마다 빈 SQLite)
npm run build
node scripts/make-icons.mjs <엠블럼.png>   # 로고·파비콘·PWA 아이콘 일괄 생성
```

DB는 기본으로 프로젝트 루트의 `local.db`(SQLite). 배포 시 `.env`에 `DATABASE_URL`, `DATABASE_AUTH_TOKEN`(Turso 등 libsql 호환) 설정. `.env.example` 참고.

## 스택

Next.js 16 App Router(Route Handlers로 API) + React 19 + TypeScript + Tailwind v4 + TanStack Query v5 + Drizzle ORM(libsql) + zod v4.

**Next 16은 학습 데이터와 다르다.** `node_modules/next/dist/docs/`의 문서를 먼저 읽는다. 지금까지 확인한 차이:
- `params`는 `Promise` → `const { id } = await params`.
- `error.tsx`의 복구 함수는 `retry` (`reset`이 아님).
- Route Handler는 기본으로 캐시되지 않는다.
- `@libsql/client`는 Next 기본 `serverExternalPackages`에 포함되어 별도 설정 불필요.

## 구조

```
src/
  app/                  라우트. 페이지는 Server Component로 얇게 두고 feature 컴포넌트를 렌더
    api/**/route.ts     Route Handler. 검증 → server 함수 호출 → JSON
  features/<domain>/    players | matches | attendance(참석 투표 + 댓글) | feedback | formations
    schema.ts           zod 입력 스키마 + 타입. 클라이언트 폼과 서버가 같은 스키마로 검증
    api.ts              fetch 래퍼 호출 (브라우저 전용)
    queries.ts          TanStack Query 훅과 query key
    components/         해당 도메인 UI (대부분 "use client")
  server/               DB 접근 함수. Route Handler에서만 import (클라이언트에서 절대 import 금지)
  lib/                  db(드리즐 스키마·커넥션), positions, utils, api-client, form
  components/ui         Button, Field/Input, Chip, ConfirmDialog, States, Skeleton, PageHeader
  components/layout     AppShell, Nav
scripts/seed.ts         예시 데이터
scripts/make-icons.mjs  엠블럼 PNG 하나로 public/logo.png, src/app/icon.png·apple-icon.png·opengraph-image.jpg, public/icons/* 생성
```

의존 방향: `app → features → lib`, `app/api → server → lib`. `features/*`는 `server/*`를 import하지 않는다.

## 규칙

- **검증은 한 곳에서.** 입력 스키마는 `features/<domain>/schema.ts`에만 정의. 클라이언트는 `lib/form.ts`의 `validate()`, 서버는 `server/http.ts`의 `parseBody()`로 같은 스키마를 쓴다.
- **서버 오류 형식.** `{ error: string, issues: { path, message }[] }`. 클라이언트는 `ApiError`로 받아 `errorsFromApi()`로 필드 오류에 매핑.
- **Query key는 `queries.ts`의 `xxxKeys` 객체만 사용.** 변경 후 무효화 범위도 거기서 결정한다 (예: 선수 이름 변경 → matches도 무효화).
- **속도.** DB(Turso)는 도쿄에 있고 Vercel 함수도 `vercel.json`의 `regions: ["hnd1"]`로 도쿄에 둔다. 둘이 떨어지면 쿼리마다 왕복이 붙으니 리전을 바꿀 때는 같이 옮긴다. 서버 함수에서 서로 기다릴 필요 없는 쿼리는 `Promise.all`로 한 번에 보낸다. 클라이언트는 앱 시작 시 경기·선수 목록을 미리 받고(`app/providers.tsx`), 화면 아래쪽 섹션이 쓰는 데이터는 상위 컴포넌트에서 미리 요청해 요청이 줄 서지 않게 한다(예: `MatchDetail`의 `usePrefetchMatchSections`). 기본 staleTime은 1분.
- **페이지는 Server Component, 상태·훅이 필요한 곳만 `"use client"`.** 페이지에서 데이터를 미리 가져오지 않고 클라이언트 훅이 가져온다 (로딩·오류·빈 상태는 컴포넌트 안에서 처리).
- **익명 피드백.** 작성자를 알 수 있는 정보(IP, UA, 쿠키, 세션)는 받지도 저장하지도 않는다. 이 규칙을 깨는 기능은 만들지 않는다. 피드백은 결과가 기록된 경기에만, 경기 후 14일(`FEEDBACK_WINDOW_DAYS`, 한국 시간 자정)까지 받는다. 도배 방지는 작성자를 식별하지 않고 저장된 `createdAt`으로 최근 글 수만 센다(`server/feedback.ts`의 `FEEDBACK_RATE_LIMITS`).
- **참석 투표.** 상태는 참석/불참/보류(`yes`/`no`/`maybe`, `features/attendance/schema.ts`). 마감은 `matches.voteDeadline`(ISO)이고 마감 판정은 `isVoteClosed()` 하나를 클라이언트·서버가 같이 쓴다. 마감 뒤 명단 수정은 비밀번호가 걸린 배포에서 관리자만. 투표 아래 댓글(`match_comments`)은 "왜 불참/보류인지" 알리는 글이라 선수 이름을 밝히며, 익명 피드백과 다르다. 댓글은 마감 뒤에도 남길 수 있다.
- **개인 PIN(숫자 4자리).** 참석 응답·응답 지우기·투표 댓글 쓰기/지우기는 그 선수의 PIN이 맞아야 한다. 판정은 `server/pin.ts`의 `authorizePlayer()` 한 곳에서만 한다. 처음 보낸 PIN이 그 선수의 PIN이 되고(scrypt 해시로 `players.pinHash`), 5번 틀리면 10분 잠금(DB에 저장). 비밀번호가 걸린 배포의 관리자는 PIN 없이 통과하고 `DELETE /api/players/[id]/pin`으로 초기화한다. API 응답에는 `hasPin`만 싣고 해시는 절대 내보내지 않는다(`toPlayer`). 브라우저는 한 번 맞힌 PIN을 `fc:pins`에 기억한다.
- **포메이션 로직은 순수 함수.** `lineup-reducer.ts`(상태 전이), `auto-lineup.ts`(이분 매칭), `templates.ts`(슬롯 좌표), `lineup-text.ts`(텍스트). UI는 `dispatch`만 한다. 로직 변경은 여기서, UI 파일에서 규칙을 추가하지 않는다.
- **포메이션 편집은 관리자만.** `/formation`은 관리자면 `FormationBuilder`(자리 바꾸기·자동 배치·저장), 아니면 `FormationViewer`(저장된 라인업을 쿼터별로 보기·카톡 텍스트 복사만)를 띄운다. 저장·삭제 API도 `requireAdmin`으로 막혀 있다.
- **포메이션 하나 = 1~4쿼터 라인업.** `SavedFormation.quarters`(길이 `QUARTER_COUNT`)에 쿼터별 모양과 배치가 들어가고 참석자는 네 쿼터가 공유한다. 리듀서의 자리 조작(모양, 탭, 비우기, 자동 배치)은 `activeQuarter`에만 적용된다. 자동 배치는 다른 쿼터 출전 수(`appearances`)를 받아 적게 뛴 선수를 먼저 세운다.
- **포지션 목록은 `lib/positions.ts`가 유일한 출처.** 새 포지션은 여기에 추가하고 `POSITION_FALLBACKS`도 함께 채운다.
- **타임스탬프는 ISO 문자열**, 경기 날짜는 `YYYY-MM-DD` 문자열, 킥오프 시각은 정각 단위 `HH:00` 문자열(`matches.kickoffTime`, null이면 미정. 표시는 `formatKickoffTime()` → "오전 7시"). Date 객체를 API 경계로 넘기지 않는다.
- **선수 기록은 `features/players/stats.ts`의 `buildPlayerStats()` 한 곳에서 계산**하고 `GET /api/players/[id]/stats`가 돌려준다. "출전"은 따로 입력받지 않고 참석 투표 "참석", 경기에 붙인 포메이션 명단, 골·도움 기록 중 하나라도 있으면 출전으로 센다. 참석률 = 출전 ÷ 결과가 기록된 팀 경기 수.
- **상대전적은 `features/matches/stats.ts`의 `buildHeadToHead()`**. 상대 이름은 공백 제거 + 대소문자 무시로 비교한다(`normalizeOpponent`). 철자가 다르면 다른 팀이다.

- **규칙은 API 테스트로 지킨다 (`tests/api`).** 쓰기 API는 `src/app/api`를 자동으로 훑어 관리자 쿠키 없이 401인지 본다. 모임원 누구나 쓰는 API를 새로 만들면 `admin-guard.test.ts`의 `OPEN_TO_MEMBERS`에 이유와 함께 적는다. 피드백 익명성(저장 열, 헤더 미사용), PIN, 피드백 마감·도배 방지도 여기서 검사한다. 규칙을 바꾸면 테스트를 먼저 고친다.

## 디자인

컨셉은 "경기장과 전광판". 색은 `globals.css`의 토큰만 쓴다 (`bg-pitch`, `text-amber`, `border-line`…). 임의 hex 금지.
- 잔디색(`pitch`) = 기본 동작 색. amber = 전광판 숫자와 화면당 하나의 핵심 버튼(`variant="accent"`)에만.
- 숫자·점수·포지션 약어는 `font-display`(Oswald). 한글 본문에는 쓰지 않는다.
- 카드 남발 대신 `divide-y divide-line` 목록. 그림자는 어두운 전광판 패널에만.
- **움직임은 두 곳만.** 첫 화면 `/`의 킥오프 스플래시(`components/layout/Splash.tsx`, AppShell에 있음. 처음 접속뿐 아니라 헤더 로고로 `/`에 올 때마다 처음부터 다시 돈다. 연출 중 `/matches`로 넘어가고 경기 화면이 준비되면 갈라진다. 누르면 건너뜀)와 그 뒤 전광판 점등(`SeasonBoard`, 페이지 로드당 한 번). 표시 여부는 `lib/splash.ts`의 인라인 스크립트가 첫 페인트 전에 `<html data-splash="off">`로 정한다. 홈 화면 앱(PWA)은 `/`에서 시작한다. 동작 줄이기 설정이면 둘 다 없다. 다른 곳에 입장 애니메이션을 흩뿌리지 않는다.
- 모바일 우선. 하단 탭(모바일)/상단 메뉴(데스크톱)는 `components/layout/Nav.tsx`.
- 문구는 반말 아닌 해요체, 능동태. 버튼은 일어나는 일을 그대로 ("기록 저장", "남기기").
- 로고는 모임 엠블럼(검정 바탕에 금색 호랑이, "BBOING FOOTBALL CLUB"). 원형으로 잘라낸 `public/logo.png`를 헤더와 경기 링크 미리보기(OG)에 쓰고, 첫 주소 미리보기는 `src/app/opengraph-image.jpg`(1200×630)다. 카톡은 `og:` 태그를 읽으므로 페이지에서 제목·설명을 바꿀 때는 `openGraph`에도 넣는다(경기 상세의 `withPreview`). 로고 파일을 손으로 고치지 말고 원본 PNG를 받아 `scripts/make-icons.mjs`로 전부 다시 만든다.
