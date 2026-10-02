import { describe, expect, it } from "vitest";
import { matchIndex, searchByName } from "./search";

const people = ["이무성", "장상준", "김도현", "박지훈", "최민재", "임동혁", "이민호", "Kim Tom"].map((name) => ({ name }));
const names = (query: string) => searchByName(people, query).map((p) => p.name);

describe("searchByName", () => {
  it("검색어가 없으면 전체를 가나다순으로", () => {
    // 한국어 정렬이라 한글 이름이 영문보다 먼저 온다
    expect(names("")).toEqual(["김도현", "박지훈", "이무성", "이민호", "임동혁", "장상준", "최민재", "Kim Tom"]);
  });

  it("이름 일부로 찾는다", () => {
    expect(names("무성")).toEqual(["이무성"]);
    expect(names("민")).toEqual(["이민호", "최민재"]);
  });

  it("앞부분이 맞는 이름이 먼저 온다", () => {
    // "임"을 치는 도중에도 "이"가 먼저 보이므로 임동혁도 나온다
    expect(names("이")).toEqual(["이무성", "이민호", "임동혁"]);
    expect(names("ㅁ")[0]).toBe("이무성"); // 둘째 글자에서 맞는 것들 중 가나다순
  });

  it("초성으로 찾는다", () => {
    expect(names("ㅇㅁㅅ")).toEqual(["이무성"]);
    expect(names("ㅇㅁ")).toEqual(["이무성", "이민호"]);
    expect(names("ㅈㅅㅈ")).toEqual(["장상준"]);
  });

  it("초성과 글자를 섞어 쓸 수 있다", () => {
    expect(names("이ㅁㅎ")).toEqual(["이민호"]);
    expect(names("ㅈ상")).toEqual(["장상준"]);
  });

  it("한글을 치는 중인 마지막 글자도 맞는다", () => {
    expect(names("뭇")).toEqual(["이무성"]); // "무성"을 치는 중 화면에 "뭇"
    expect(names("이무서")).toEqual(["이무성"]); // "성"을 치는 중 "서"
    expect(names("장사")).toEqual(["장상준"]);
  });

  it("중간 글자에서는 입력 중 규칙을 적용하지 않는다", () => {
    expect(names("서준")).toEqual([]);
  });

  it("공백과 대소문자는 무시한다", () => {
    expect(names(" 이 무 ")).toEqual(["이무성"]);
    expect(names("kimt")).toEqual(["Kim Tom"]);
  });

  it("맞는 게 없으면 빈 목록", () => {
    expect(names("손흥민")).toEqual([]);
  });
});

describe("matchIndex", () => {
  it("처음 맞는 위치를 돌려준다", () => {
    expect(matchIndex("이무성", "무")).toBe(1);
    expect(matchIndex("이무성", "")).toBe(0);
    expect(matchIndex("이무성", "철")).toBe(-1);
  });
});
