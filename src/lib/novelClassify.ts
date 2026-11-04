/**
 * '한국문학' 탭의 출판사 목록과 소설/장편 판정. 순수 함수만 둔다(네트워크는 novelsApi.ts).
 *
 * 판정 근거는 인수인계 문서 4절("소설/장편 추정")을 그대로 옮긴 것:
 * 알라딘 카테고리·책소개 스크레이핑은 브라우저에서 CORS로 막혀 있어 쓸 수 없으므로,
 * NL 서지정보로 얻을 수 있는 신호(부가기호 KDC 813, 종이책 쪽수, 제목 키워드, 공저자 수)만으로
 * '장편'을 추정한다. 문서가 밝혔듯 사실상 "한국소설(813) + 250쪽 이상"이 기준이다.
 */
import type { NovelCandidate, NovelVerdict } from '../types/novel'

/** 대상 출판사 17곳. query는 publisher 검색어(형태소 검색이라 일부만 써도 된다) */
export const TARGET_PUBLISHERS = [
  '문학동네',
  '민음사',
  '창비',
  '열린책들',
  '현대문학',
  '문학과지성사',
  '은행나무',
  '자음과모음',
  '을유문화사',
  '아침달',
  '교유서가',
  '열림원',
  '에피케',
  '북다',
  '위즈덤하우스',
  '봄날의책',
  '걷는사람',
] as const

/**
 * NL 응답의 PUBLISHER 표기(예: "(주식회사)은행나무출판사")에서 법인 표시·지점·괄호 주석을 떼어
 * 비교하기 쉬운 형태로 만든다.
 */
export function normalizePublisher(raw: string): string {
  return raw
    .replace(/[㈜]/g, '')
    .replace(/\(주식회사\)|\(도서출판\)|\(유한회사\)|\(주\)|\(유\)/g, '')
    .replace(/주식회사|도서출판|유한회사/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\([^)]*\)\s*$/g, '')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * 정규화한 표기가 요청한 출판사명과 같거나, '요청명+출판사'/'요청명+출판' 꼴일 때만 통과시킨다.
 * (형태소 검색이 걸려 온 다른 출판사 — 예: "창비" 요청에 "창비교육" — 를 걸러낸다)
 */
export function publisherMatches(rawPublisher: string, query: string): boolean {
  const normalized = normalizePublisher(rawPublisher)
  return (
    normalized === query ||
    normalized === `${query}출판사` ||
    normalized === `${query}출판`
  )
}

/** 부가기호(5자리)에서 내용분류 3자리를 뽑는다. "03813" → "813" */
export function kdc3FromAddCode(addCode: string | undefined): string | undefined {
  const digits = addCode?.replace(/\D/g, '') ?? ''
  return digits.length >= 5 ? digits.slice(2, 5) : undefined
}

/** 부가기호 첫 자리(독자대상). "7"이면 아동·청소년용 */
export function readerCodeFromAddCode(addCode: string | undefined): string | undefined {
  const digits = addCode?.replace(/\D/g, '') ?? ''
  return digits.length >= 1 ? digits[0] : undefined
}

const EXCLUDE_TITLE = /시집|산문집?|에세이|동화|그림책|대본집|희곡|웹툰|만화|사진집|화집/
const COLLECTION_TITLE = /소설집|단편집|연작소설|중단편|단편선/
const BOUNDARY_MIN_PAGES = 200
const NOVEL_MIN_PAGES = 250

/**
 * 장편/소설집·중편/확인 필요/소설 아님을 추정한다.
 * - KDC 3자리가 있는데 81x이면서 813이 아니면 '소설 아님'(시·수필·희곡 등).
 * - 제목에 시집·에세이·동화·희곡 등이 있으면 '소설 아님'.
 * - 공저 3인 이상이면 앤솔로지로 보고 '소설 아님'.
 * - 제목에 소설집·단편·연작소설 등이 있거나 쪽수가 200 미만이면 '소설집·중편'.
 * - 쪽수가 없으면 '확인 필요'.
 * - 쪽수가 `minPages`(기본 250) 이상이면 '장편', 200~minPages-1이면 '확인 필요'.
 */
export function classifyNovel(
  candidate: Pick<NovelCandidate, 'title' | 'kdc3' | 'authorCount'>,
  pages: number | null | undefined,
  minPages = NOVEL_MIN_PAGES,
): NovelVerdict {
  const { title, kdc3, authorCount } = candidate

  if (kdc3 && kdc3.startsWith('81') && kdc3 !== '813') return '소설 아님'
  if (EXCLUDE_TITLE.test(title)) return '소설 아님'
  if ((authorCount ?? 0) >= 3) return '소설 아님'

  if (COLLECTION_TITLE.test(title)) return '소설집·중편'
  if (pages == null) return '확인 필요'
  if (pages < BOUNDARY_MIN_PAGES) return '소설집·중편'
  if (pages < minPages) return '확인 필요'
  return '장편'
}

/** 알라딘 상품 페이지 링크(ISBN 기준). CORS 때문에 내용을 긁어 오지 못하니 '보러 가기' 링크로만 쓴다. */
export function aladinProductUrl(isbn13: string): string {
  return `https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${isbn13}`
}
