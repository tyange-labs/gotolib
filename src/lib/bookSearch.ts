/**
 * 도서관 정보나루 도서 검색(srchBooks) 응답 → 이 앱의 책 데이터. 순수 함수만 둔다.
 *
 * 응답은 알라딘 내보내기와 모양이 다르다: 제목 뒤에 부제(" :부제")와 공백이 붙고, 저자는
 * "지은이: 유발 하라리 ;옮긴이: 조현욱"처럼 역할이 앞에 붙으며, 여러 권짜리는 vol로 구분된다.
 */
import type { Book } from '../types/book'

/** srchBooks의 docs[].doc 중 이 앱이 읽는 필드 */
export interface SearchDoc {
  bookname?: string
  authors?: string
  publisher?: string
  publication_year?: string
  isbn13?: string
  /** KDC 분류번호(예: "813.6"). 첫 자리가 주류다 */
  class_no?: string
  /** 권차(예: "2"). 같은 제목의 여러 권을 구분한다 */
  vol?: string
}

/** 검색 결과: 책에서 '담은 시각'만 뺀 것. 추가하는 순간 시각이 붙는다. */
export type SearchResult = Omit<Book, 'addedAt' | 'updatedAt'>

const ISBN13 = /^97[89]\d{10}$/

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed : undefined
}

/** "사피엔스 :유인원에서…" → "사피엔스". 권차가 있으면 뒤에 붙인다("… 2"). */
function titleOf(doc: SearchDoc): string | undefined {
  const main = clean(doc.bookname?.split(/\s*[:：]\s*/)[0])
  if (!main) return undefined
  const vol = clean(doc.vol)
  return vol ? `${main} ${vol}` : main
}

/** "지은이: 유발 하라리 ;옮긴이: 조현욱" → "유발 하라리, 조현욱 옮김" */
function authorsOf(raw: string | undefined): string | undefined {
  const text = raw
    ?.replace(/\s*;\s*/g, ', ')
    .replace(/지은이\s*:\s*/g, '')
    .replace(/옮긴이\s*:\s*([^,]+)/g, '$1 옮김')
    .replace(/그린이\s*:\s*([^,]+)/g, '$1 그림')
  return clean(text)
}

/** ISBN13이 없거나 올바르지 않은 결과는 책으로 담을 수 없어서(id가 ISBN이다) null. */
export function toSearchResult(doc: SearchDoc): SearchResult | null {
  const isbn13 = (doc.isbn13 ?? '').replace(/\D/g, '')
  if (!ISBN13.test(isbn13)) return null
  const title = titleOf(doc)
  if (!title) return null

  const kdc = /^\d/.test(doc.class_no ?? '') ? doc.class_no![0] : undefined
  return {
    id: isbn13,
    title,
    author: authorsOf(doc.authors),
    publisher: clean(doc.publisher),
    pubDate: clean(doc.publication_year),
    isbn13,
    kdc,
  }
}

/** 검색 결과를 서재에 담는다: 지금 시각을 담은 시각으로 붙인다(최신순 목록의 맨 위로 간다). */
export function toBook(result: SearchResult, now = Date.now()): Book {
  return { ...result, addedAt: now }
}
