# 참석 투표 · 댓글 · PIN · 용병

이 폴더 파일을 열 때 함께 읽힌다. 이 규칙을 지키는 코드는 폴더 밖에도 있으니, 아래 파일을 고칠 때도 먼저 읽는다.
- `src/app/api/matches/[id]/attendance`, `comments`, `guests`, `late-join` 라우트
- `src/server/pin.ts`, `attendance.ts`, `comments.ts`, `guests.ts`
- 마감 판정 함수가 있는 `src/features/matches/schema.ts`

## 참석 투표

- 상태는 참석/불참/보류(`yes`/`no`/`maybe`, `schema.ts`). 참석이면 뛸 수 있는 쿼터(`quarters`, 늦참·조퇴, null = 전부)를 받는다.
- 마감은 `matches.voteDeadline`(ISO). 비어 있으면 킥오프 시각, 킥오프 미정이면 경기 당일 0시(`effectiveVoteDeadline`). 결과가 나왔거나 취소된 경기도 마감이다. 판정은 `isVoteClosed()`·`canJoinLate()`(matches/schema) 하나를 클라이언트·서버가 같이 쓴다.
- 마감 뒤 ~ 추가 참석 마감(`matches.lateJoinDeadline`, 주장이 "추가 참석 받기"에서 정함. 없으면 킥오프 2시간 뒤, `lateJoinCloseAt`)에는 두 가지만 받는다: "늦게라도 참석"(참석으로만, `lateJoin` 표시)과 이미 참석인 사람의 쿼터 변경. 불참·보류로 바꾸는 건 막는다(댓글로 알리고 주장이 고친다). 그 밖의 마감 뒤 수정은 비밀번호가 걸린 배포의 관리자만.
- 투표가 마감되면 주장 화면에 "추가 참석 받기"(`SecondCallPanel`)가 뜬다. 보류·불참·미투표 명단, 추가 참석 마감, 단톡방용 "다시 묻기" 글(`formatSecondCallText`)을 준다.
- 포메이션의 가져오기는 참석자만 켜고, 나머지 이름에 보류·불참·미투표·마감 후 표시를 붙인다.
- "내 이름 고르기"는 검색 칸(`features/players/components/PlayerPicker.tsx`)이다. 이름 일부·초성·입력 중인 글자 검색 규칙은 `features/players/search.ts` 한 곳에 있다.

## 댓글

- 투표 아래 댓글(`match_comments`)은 "왜 불참/보류인지" 알리는 글이라 선수 이름을 밝힌다. 익명 피드백과 다르다.
- 마감 뒤에도 남길 수 있다.

## 개인 PIN (숫자 4자리)

- 참석 응답, 응답 지우기, 투표 댓글 쓰기·지우기는 그 선수의 PIN이 맞아야 한다. 판정은 `server/pin.ts`의 `authorizePlayer()` 한 곳에서만 한다.
- 처음 보낸 PIN이 그 선수의 PIN이 된다(scrypt 해시로 `players.pinHash`). 5번 틀리면 10분 잠금(DB에 저장).
- 비밀번호가 걸린 배포의 관리자는 PIN 없이 통과하고, `DELETE /api/players/[id]/pin`으로 초기화한다.
- API 응답에는 `hasPin`만 싣고 해시는 절대 내보내지 않는다(`toPlayer`).
- 브라우저는 한 번 맞힌 PIN을 `fc:pins`에 기억한다.

## 용병(게스트)

- 경기별 `match_guests`. 관리자만 넣고 뺀다.
- id는 `guest-` 접두사(`isGuestId`)라 라인업에서 선수 id와 섞여 쓰인다. 포메이션은 `guests`·`availability`를 함께 저장해 나중에 다시 그린다.
- 기록(득점왕·참석률)에는 들어가지 않는다.
