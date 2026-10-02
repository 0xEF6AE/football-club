@AGENTS.md

# 축구 모임 웹 (football-club)

주말 축구 모임의 경기 결과, 익명 피드백, 포메이션을 한곳에서 관리하는 앱. 모임원이 카톡방 대신 여기서 결과를 보고 피드백을 남기고, 주장이 참석자로 라인업을 짠다. 화면 문구는 전부 한국어.

## 명령

```bash
npm run dev        # http://localhost:3000
npm run db:push        # 스키마 → 로컬 DB(local.db) 테이블
npm run db:push:turso  # 스키마 → 배포 DB(Turso). 접속 정보는 .env.turso (git 제외)
npm run db:seed    # 예시 선수/경기 넣기 (선수가 있으면 건너뜀)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest: 순수 로직(src/**/*.test.ts) + API 규칙(tests/api, 파일마다 빈 SQLite)
npm run build
node scripts/make-icons.mjs <엠블럼.png>   # 로고·파비콘·PWA 아이콘 일괄 생성
```

DB는 기본으로 프로젝트 루트의 `local.db`(SQLite). 배포(Vercel)는 Turso이고, Vercel 환경변수에 `DATABASE_URL`, `DATABASE_AUTH_TOKEN`이 있다. `.env.example` 참고.

**`src/lib/db/schema.ts`를 바꾸면 반드시 `npm run db:push`와 `npm run db:push:turso`를 둘 다 실행한다.** Turso를 빠뜨리면 배포 사이트가 새 열을 못 찾아 바로 오류가 난다. 둘 다 "No changes detected"가 나오면 맞춰진 것이다.

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
- **참석 투표.** 상태는 참석/불참/보류(`yes`/`no`/`maybe`, `features/attendance/schema.ts`). 마감은 `matches.voteDeadline`(ISO), 비어 있으면 킥오프 시각(킥오프 미정이면 경기 당일 0시, `effectiveVoteDeadline`). 결과가 나왔거나 취소된 경기도 마감이다. 판정은 `isVoteClosed()`·`canJoinLate()`(matches/schema) 하나를 클라이언트·서버가 같이 쓴다. 마감 뒤 ~ 추가 모집 마감(`matches.lateJoinDeadline`, 주장이 "추가 참석 받기"에서 정함. 없으면 킥오프 2시간 뒤, `lateJoinCloseAt`)에는 "늦게라도 참석"(참석으로만, `lateJoin` 표시)과 이미 참석인 사람의 쿼터 변경만 받고, 불참·보류로 바꾸는 건 막는다(댓글로 알리고 주장이 고친다). 그 밖의 마감 뒤 수정은 비밀번호가 걸린 배포의 관리자만. 투표가 마감되면 주장 화면에 "추가 참석 받기"(`SecondCallPanel`)가 떠서 보류·불참·미투표 명단, 추가 모집 마감, 단톡방용 "다시 묻기" 글(`formatSecondCallText`)을 준다. 포메이션의 가져오기는 참석자만 켜고 나머지 이름에 보류·불참·미투표·마감 후 표시를 붙인다. 참석이면 뛸 수 있는 쿼터(`quarters`, 늦참·조퇴, null = 전부)를 받는다. 투표 아래 댓글(`match_comments`)은 "왜 불참/보류인지" 알리는 글이라 선수 이름을 밝히며, 익명 피드백과 다르다. 댓글은 마감 뒤에도 남길 수 있다. "내 이름 고르기"는 검색 칸(`features/players/components/PlayerPicker.tsx`)이고, 이름 일부·초성·입력 중인 글자 검색 규칙은 `features/players/search.ts` 한 곳에 있다.
- **개인 PIN(숫자 4자리).** 참석 응답·응답 지우기·투표 댓글 쓰기/지우기는 그 선수의 PIN이 맞아야 한다. 판정은 `server/pin.ts`의 `authorizePlayer()` 한 곳에서만 한다. 처음 보낸 PIN이 그 선수의 PIN이 되고(scrypt 해시로 `players.pinHash`), 5번 틀리면 10분 잠금(DB에 저장). 비밀번호가 걸린 배포의 관리자는 PIN 없이 통과하고 `DELETE /api/players/[id]/pin`으로 초기화한다. API 응답에는 `hasPin`만 싣고 해시는 절대 내보내지 않는다(`toPlayer`). 브라우저는 한 번 맞힌 PIN을 `fc:pins`에 기억한다.
- **포메이션 로직은 순수 함수.** `lineup-reducer.ts`(상태 전이), `auto-lineup.ts`(이분 매칭), `templates.ts`(슬롯 좌표), `lineup-text.ts`(텍스트). UI는 `dispatch`만 한다. 로직 변경은 여기서, UI 파일에서 규칙을 추가하지 않는다.
- **용병(게스트).** 경기별 `match_guests`, 관리자만 넣고 뺀다. id는 `guest-` 접두사(`isGuestId`)라 라인업에서 선수 id와 섞여 쓰인다. 포메이션은 `guests`·`availability`를 함께 저장해 나중에 다시 그린다. 기록(득점왕·참석률)에는 들어가지 않는다.
- **경기 취소.** `matches.cancelled`·`cancelReason`, `POST /api/matches/[id]/cancel`(관리자). 취소된 경기는 투표가 닫히고 결과 입력 대기·관리자 알림에서 빠지며 목록의 지난 경기 쪽에 "취소"로 보인다. 결과를 입력하면 취소가 풀린다.
- **포메이션 편집은 관리자만.** `/formation`은 관리자면 `FormationBuilder`(자리 바꾸기·자동 배치·저장), 아니면 `FormationViewer`(저장된 라인업을 쿼터별로 보기·카톡 텍스트 복사만)를 띄운다. 저장·삭제 API도 `requireAdmin`으로 막혀 있다.
- **포메이션 하나 = 1~4쿼터 라인업.** `SavedFormation.quarters`(길이 `QUARTER_COUNT`)에 쿼터별 모양과 배치가 들어가고 참석자는 네 쿼터가 공유한다. 리듀서의 자리 조작(모양, 탭, 비우기, 자동 배치)은 `activeQuarter`에만 적용된다. 자동 배치(`auto-lineup.ts`)의 우선순위는 ① 출전 시간을 고르게(덜 뛴 사람부터, 같으면 뒤에 뛸 기회가 적은 사람부터) ② 골키퍼는 GK가 되는 사람끼리 돌아가며(`keeperDuty`), GK만 하는 사람은 필드로 안 돌림 ③ 그 안에서 포지션(정확 → 유사 → 남으면 아무 자리, GK가 없으면 필드 선수가 골문). 뛸 수 있는 쿼터(`availability`) 밖에는 세우지 않는다. 포지션 정확도보다 고른 출전이 먼저인 건 의도다.
- **포지션 목록은 `lib/positions.ts`가 유일한 출처.** 새 포지션은 여기에 추가하고 `POSITION_FALLBACKS`도 함께 채운다.
- **타임스탬프는 ISO 문자열**, 경기 날짜는 `YYYY-MM-DD` 문자열, 킥오프 시각은 정각 단위 `HH:00` 문자열(`matches.kickoffTime`, null이면 미정. 표시는 `formatKickoffTime()` → "오전 7시"). Date 객체를 API 경계로 넘기지 않는다.
- **선수 기록은 `features/players/stats.ts`의 `buildPlayerStats()` 한 곳에서 계산**하고 `GET /api/players/[id]/stats`가 돌려준다. "출전"은 따로 입력받지 않고 참석 투표 "참석", 경기에 붙인 포메이션 명단, 골·도움 기록 중 하나라도 있으면 출전으로 센다. 참석률 = 출전 ÷ 결과가 기록된 팀 경기 수.
- **상대전적은 `features/matches/stats.ts`의 `buildHeadToHead()`**. 상대 이름은 공백 제거 + 대소문자 무시로 비교한다(`normalizeOpponent`). 철자가 다르면 다른 팀이다.

- **규칙은 API 테스트로 지킨다 (`tests/api`).** 쓰기 API는 `src/app/api`를 자동으로 훑어 관리자 쿠키 없이 401인지 본다. 모임원 누구나 쓰는 API를 새로 만들면 `admin-guard.test.ts`의 `OPEN_TO_MEMBERS`에 이유와 함께 적는다. 피드백 익명성(저장 열, 헤더 미사용), PIN, 피드백 마감·도배 방지도 여기서 검사한다. 규칙을 바꾸면 테스트를 먼저 고친다.

## 디자인

컨셉은 "경기장과 전광판". 색은 `globals.css`의 토큰만 쓴다 (`bg-pitch`, `text-amber`, `border-line`…). 임의 hex 금지.
- `pitch`는 채우는 색(버튼·칩 배경), `pitch-ink`는 배경 위 초록 글자·아이콘·포커스 테두리. 다크 모드에서 `text-pitch`는 대비가 모자라므로 글자에는 `text-pitch-ink`를 쓴다.
- **선택칸은 `components/ui/Select.tsx`** (네이티브 `<select>` 쓰지 않음, `options` 배열을 넘긴다). 떠 있는 목록 모양과 위아래 위치는 `components/ui/listbox.ts`를 Select와 PlayerPicker가 같이 쓴다.
- 높이: 입력칸·선택칸·md 버튼 44px, sm 버튼·sm 칩 36px. 버튼과 칩은 누르면 살짝 눌린다(`active:scale`), 채운 버튼은 윗면에 1px 빛.
- 잔디색(`pitch`) = 기본 동작 색. amber = 전광판 숫자와 화면당 하나의 핵심 버튼(`variant="accent"`)에만.
- 숫자·점수·포지션 약어는 `font-display`(Oswald). 한글 본문에는 쓰지 않는다.
- 카드 남발 대신 `divide-y divide-line` 목록. 그림자는 어두운 전광판 패널과 떠 있는 층(선택 목록, 대화상자)에만.
- **움직임은 두 곳만.** 첫 화면 `/`의 킥오프 스플래시(`components/layout/Splash.tsx`, AppShell에 있음. 처음 접속뿐 아니라 헤더 로고로 `/`에 올 때마다 처음부터 다시 돈다. 연출 중 `/matches`로 넘어가고 경기 화면이 준비되면 갈라진다. 누르면 건너뜀)와 그 뒤 전광판 점등(`SeasonBoard`, 페이지 로드당 한 번). 표시 여부는 `lib/splash.ts`의 인라인 스크립트가 첫 페인트 전에 `<html data-splash="off">`로 정한다. 홈 화면 앱(PWA)은 `/`에서 시작한다. 동작 줄이기 설정이면 둘 다 없다. 다른 곳에 입장 애니메이션을 흩뿌리지 않는다.
- 모바일 우선. 하단 탭(모바일)/상단 메뉴(데스크톱)는 `components/layout/Nav.tsx`.
- 문구는 반말 아닌 해요체, 능동태. 버튼은 일어나는 일을 그대로 ("기록 저장", "남기기").
- 로고는 모임 엠블럼(검정 바탕에 금색 호랑이, "BBOING FOOTBALL CLUB"). 원형으로 잘라낸 `public/logo.png`를 헤더와 경기 링크 미리보기(OG)에 쓰고, 첫 주소 미리보기는 `src/app/opengraph-image.jpg`(1200×630)다. 카톡은 `og:` 태그를 읽으므로 페이지에서 제목·설명을 바꿀 때는 `openGraph`에도 넣는다(경기 상세의 `withPreview`). 로고 파일을 손으로 고치지 말고 원본 PNG를 받아 `scripts/make-icons.mjs`로 전부 다시 만든다.
