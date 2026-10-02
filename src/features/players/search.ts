/**
 * 선수 이름 검색 (참석 투표의 "내 이름 고르기" 등).
 * - 이름 일부: "무성" → 이무성
 * - 초성: "ㅇㅁㅅ" → 이무성, 섞어도 된다: "이ㅁ" → 이무성
 * - 한글 입력 중인 글자: "뭇"(무+ㅅ 입력 중) → 이무성, "서"(성 입력 중) → 이무성
 * 공백과 대소문자는 무시한다.
 */
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
/** 받침 순서(0 = 없음). 홑받침만 다음 글자의 초성으로 넘길 수 있다. */
const JONGSEONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

type Syllable = { cho: number; jung: number; jong: number };

function decompose(char: string): Syllable | null {
  const code = char.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return null;
  const offset = code - HANGUL_START;
  return { cho: Math.floor(offset / 588), jung: Math.floor((offset % 588) / 28), jong: offset % 28 };
}

function compose({ cho, jung, jong }: Syllable): string {
  return String.fromCharCode(HANGUL_START + cho * 588 + jung * 28 + jong);
}

const isChoseongJamo = (char: string) => CHOSEONG.includes(char);

/** 이름 글자 하나와 검색어 글자 하나가 맞는지. isLast면 입력 중인 글자(받침 전)도 허용한다. */
function charMatches(nameChar: string, queryChar: string, isLast: boolean): boolean {
  if (nameChar === queryChar) return true;
  const name = decompose(nameChar);
  if (!name) return false;
  if (isChoseongJamo(queryChar)) return CHOSEONG[name.cho] === queryChar;
  const query = decompose(queryChar);
  // "서"까지 친 상태에서 "성"과 맞게: 초성·중성이 같고 검색어에 받침이 아직 없으면 맞다.
  return isLast && query !== null && query.jong === 0 && query.cho === name.cho && query.jung === name.jung;
}

const normalize = (text: string) => text.replace(/\s+/g, "").toLocaleLowerCase("ko");

/**
 * 검색어 후보. 마지막 글자에 홑받침이 있으면 그 받침이 다음 글자의 초성일 수도 있다
 * ("무성"을 치는 중에 화면에는 "뭇"이 보인다) → "무ㅅ"도 함께 시도한다.
 */
function queryVariants(query: string): string[] {
  const last = decompose(query.at(-1) ?? "");
  if (!last || last.jong === 0) return [query];
  const carried = JONGSEONG[last.jong];
  if (!isChoseongJamo(carried)) return [query];
  return [query, query.slice(0, -1) + compose({ ...last, jong: 0 }) + carried];
}

/** 이름 안에서 검색어가 처음 맞는 위치. 안 맞으면 -1. */
export function matchIndex(name: string, rawQuery: string): number {
  const target = normalize(name);
  const query = normalize(rawQuery);
  if (query === "") return 0;
  let best = -1;
  for (const variant of queryVariants(query)) {
    for (let start = 0; start + variant.length <= target.length; start++) {
      const hit = [...variant].every((char, i) => charMatches(target[start + i], char, i === variant.length - 1));
      if (hit) {
        if (best === -1 || start < best) best = start;
        break;
      }
    }
  }
  return best;
}

/**
 * 검색어에 맞는 항목만, 이름 앞부분이 맞는 것부터 (그다음 가나다순).
 * 검색어가 비어 있으면 전체를 가나다순으로.
 */
export function searchByName<T extends { name: string }>(items: readonly T[], query: string): T[] {
  return items
    .map((item) => ({ item, at: matchIndex(item.name, query) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at || a.item.name.localeCompare(b.item.name, "ko"))
    .map(({ item }) => item);
}
