# 포메이션

이 폴더 파일을 열 때 함께 읽힌다. `src/app/formation`, `src/app/api/formations`, `src/server/formations.ts`를 고칠 때도 먼저 읽는다.

- **로직은 순수 함수.** `lineup-reducer.ts`(상태 전이), `auto-lineup.ts`(이분 매칭), `templates.ts`(슬롯 좌표), `lineup-text.ts`(텍스트). UI는 `dispatch`만 한다. 로직 변경은 여기서 하고, UI 파일에서 규칙을 추가하지 않는다.
- **편집은 관리자만.** `/formation`은 관리자면 `FormationBuilder`(자리 바꾸기·자동 배치·저장), 아니면 `FormationViewer`(저장된 라인업을 쿼터별로 보기·카톡 텍스트 복사만)를 띄운다. 저장·삭제 API도 `requireAdmin`으로 막혀 있다.
- **포메이션 하나 = 1~4쿼터 라인업.** `SavedFormation.quarters`(길이 `QUARTER_COUNT`)에 쿼터별 모양과 배치가 들어가고, 참석자는 네 쿼터가 공유한다. 리듀서의 자리 조작(모양, 탭, 비우기, 자동 배치)은 `activeQuarter`에만 적용된다.
- **자동 배치 우선순위** (`auto-lineup.ts`). 포지션 정확도보다 고른 출전이 먼저인 건 의도다.
  1. 출전 시간을 고르게: 덜 뛴 사람부터, 같으면 뒤에 뛸 기회가 적은 사람부터.
  2. 골키퍼는 GK가 되는 사람끼리 돌아가며 맡는다(`keeperDuty`). GK만 하는 사람은 필드로 안 돌린다.
  3. 그 안에서 포지션: 정확 → 유사 → 남으면 아무 자리. GK가 없으면 필드 선수가 골문에 선다.
  - 뛸 수 있는 쿼터(`availability`) 밖에는 세우지 않는다.
- **용병·늦참.** 용병 id는 `guest-` 접두사(`isGuestId`)라 선수 id와 섞여 쓰인다. 저장할 때 `guests`·`availability`를 함께 넣어 나중에 다시 그린다. 용병을 넣고 빼는 규칙은 `features/attendance/CLAUDE.md`에 있다.
- 포지션 목록은 `lib/positions.ts`가 유일한 출처다(루트 CLAUDE.md).
