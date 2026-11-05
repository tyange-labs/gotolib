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
 * 부가기호 내용분류 중 '소설이 아님'을 확정하는 코드만. 810은 "한국문학" 대분류일 뿐 하위 갈래가
 * 안 적힌 전자책에 흔히 붙어서(소설도 810으로 들어온다) 제외 대상이 아니다 — 813(소설)과 똑같이
 * "모른다"로 보고 제목·쪽수로 더 추정한다. 811 시·812 희곡·814 수필·815 평론 등 구체적으로 소설이
 * 아닌 하위 갈래만 제외한다.
 */
const EXCLUDE_KDC3 = new Set(['811', '812', '814', '815', '816', '817', '818', '819'])

/**
 * 알라딘 책소개에서 뽑은 형식어(book_info::extract_form_hint)를 판정으로 옮긴다. 장편·중편·단편집을
 * 따로 구분하지 않는다 — NL 서지·알라딘 어느 쪽도 그 셋을 안정적으로 구분해 주지 않아서, 장편이
 * 아니면 전부 뭉뚱그려 '소설집'으로 본다.
 */
const FORM_HINT_VERDICT: Record<string, NovelVerdict> = {
  장편소설: '장편',
  경장편소설: '장편',
  연작소설: '소설집',
  소설집: '소설집',
}

/**
 * 장편/소설집/확인 필요/소설 아님을 추정한다.
 * - KDC 3자리가 EXCLUDE_KDC3에 있으면 '소설 아님'(시·수필·희곡 등). 813은 물론이고 810(갈래 미기재)도
 *   통과시킨다.
 * - 제목에 시집·에세이·동화·희곡 등이 있으면 '소설 아님'.
 * - 공저 3인 이상이면 앤솔로지로 보고 '소설 아님'.
 * - 제목에 소설집·단편·연작소설 등이 있으면 '소설집'(쪽수와 무관하게 확정).
 * - 쪽수가 없으면 '확인 필요'.
 * - 쪽수가 200 미만이면: kdc3가 813(한국소설 확정)일 때만 '소설집', 아니면 '확인 필요'로 둔다
 *   (시집·에세이도 흔히 그만큼 짧고, NL 서지에는 구분할 신호가 아예 없는 레코드가 많다 — 예: 문학동네
 *   시인선 시집들은 kdc3·SERIES_TITLE 모두 비어 있어서 쪽수만 보면 소설집과 구별이 안 된다.
 *   알라딘이 분류를 확정해 줄 때까지 섣불리 소설로 단정하지 않는다).
 * - 쪽수가 `minPages`(기본 250) 이상이면 '장편', 200~minPages-1이면 '확인 필요'.
 */
export function classifyNovel(
  candidate: Pick<NovelCandidate, 'title' | 'kdc3' | 'authorCount'>,
  pages: number | null | undefined,
  minPages = NOVEL_MIN_PAGES,
): NovelVerdict {
  const { title, kdc3, authorCount } = candidate

  if (kdc3 && EXCLUDE_KDC3.has(kdc3)) return '소설 아님'
  if (EXCLUDE_TITLE.test(title)) return '소설 아님'
  if ((authorCount ?? 0) >= 3) return '소설 아님'

  if (COLLECTION_TITLE.test(title)) return '소설집'
  if (pages == null) return '확인 필요'
  if (pages < BOUNDARY_MIN_PAGES) return kdc3 === '813' ? '소설집' : '확인 필요'
  if (pages < minPages) return '확인 필요'
  return '장편'
}

/** 알라딘(book-info)에서 받은 신호. 모르면(아직 수집 전) undefined */
export interface AladinSignal {
  /** 알라딘 주제 분류 경로(예: "국내도서 > 소설/시/희곡 > 한국소설 > …") */
  category?: string
  /** 책소개에서 뽑은 형식어: "장편소설"·"경장편소설"·"연작소설"·"소설집" */
  formHint?: string
  pages?: number
}

/**
 * NL 서지 신호에 알라딘 신호를 겹쳐 더 정확하게 판정한다(알라딘이 1차, NL 서지가 보강·대체).
 * - formHint가 있으면 그걸로 바로 '장편'/'소설집' 확정(책소개에 직접 적힌 값이라 가장 믿을 만하다).
 * - 분류 경로가 있는데 '소설'이 전혀 안 들어 있으면(시·에세이·희곡 등 알라딘 자체 분류) '소설 아님'.
 * - 그 외엔 알라딘 쪽수(있으면 NL 쪽수보다 믿는다)로 classifyNovel을 그대로 쓴다.
 */
export function classifyWithAladin(
  candidate: Pick<NovelCandidate, 'title' | 'kdc3' | 'authorCount'>,
  nlPages: number | null | undefined,
  aladin: AladinSignal | undefined,
  minPages = NOVEL_MIN_PAGES,
): NovelVerdict {
  if (aladin?.formHint && FORM_HINT_VERDICT[aladin.formHint]) return FORM_HINT_VERDICT[aladin.formHint]
  // 알라딘의 "소설/시/희곡" 묶음 카테고리명 자체에는 항상 "소설"이 들어 있으니(시여도 마찬가지) 맨 끝
  // 갈래(예: "한국시"·"한국소설")만 본다.
  const lastSegment = aladin?.category?.split('>').at(-1)?.trim()
  if (lastSegment && !lastSegment.includes('소설')) return '소설 아님'
  return classifyNovel(candidate, aladin?.pages ?? nlPages, minPages)
}

/** 알라딘 상품 페이지 링크(ISBN 기준). CORS 때문에 내용을 긁어 오지 못하니 '보러 가기' 링크로만 쓴다. */
export function aladinProductUrl(isbn13: string): string {
  return `https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${isbn13}`
}
