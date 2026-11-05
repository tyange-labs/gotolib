/**
 * '한국문학' 탭의 대상 출판사와 NL 서지 레코드를 거르는 데 쓰는 순수 함수들(네트워크는 novelsApi.ts).
 * 장편 판정은 여기서 하지 않는다 — 서버가 모은 YES24 "한국 장편소설" 분류로만 한다(KoreanLitView).
 * TARGET_PUBLISHERS는 서버(tyange-cms-api `book_info/yes24.rs`)에도 같은 목록이 있다 — 함께 고친다.
 */

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

