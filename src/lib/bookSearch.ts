/**
 * 국립중앙도서관 서지정보 API(ISBN 서지정보) 응답 → 이 앱의 책 데이터. 순수 함수만 둔다.
 *
 * 왜 이 API인가: 도서관 정보나루 검색은 '도서관이 소장한 책'만 찾아서 신간이 검색조차 안 됐고, 국립중앙도서관
 * 통합 검색(search.do)은 납본·정리가 끝난 책만 있어서 개정판이 몇 주~몇 달 늦게 올라왔다. 서지정보 API는
 * 출간 예정 단계의 ISBN까지 담고 있어 신간·개정판이 바로 나온다. 모든 레코드가 ISBN을 가져서 소장 조회도 된다.
 *
 * 응답에서 정리할 것(실제 응답으로 확인):
 * - 저자 표기가 제각각이다: '지은이: 엄원태', '저자 : 아포리아에듀', '김현경 지음', '집필인: A,B,C'
 * - 전자책이 별도 ISBN으로 섞여 나온다(EBOOK_YN) → 종이책만 남긴다(도서관 소장 조회가 의미 없다)
 * - 2007년 이전 책은 ISBN-10만 있다 → ISBN-13으로 바꿔 담는다(안 그러면 '따뜻한 흙' 같은 책이 통째로 검색에서 빠진다)
 * - 같은 ISBN이 겹쳐 오는 일은 거의 없지만 쪽을 이어 붙일 때 생길 수 있어 ISBN으로 합친다
 */
import type { Book } from '../types/book'

/** 서지정보 검색 결과 한 건 중 이 앱이 읽는 필드 */
export interface SeojiDoc {
  TITLE?: string
  AUTHOR?: string
  PUBLISHER?: string
  EA_ISBN?: string
  /** 출간(예정)일 YYYYMMDD */
  PUBLISH_PREDATE?: string
  /** 실제 출간일 YYYYMMDD. 있으면 이쪽이 정확하다 */
  REAL_PUBLISH_DATE?: string
  /** '2판'·'개정판' 같은 판 표시 */
  EDITION_STMT?: string
  /** 'Y'면 전자책 */
  EBOOK_YN?: string
  /** KDC 주류 한 자리를 담는 경우가 있다(대개 빈 값) */
  KDC?: string
}

/** 검색 결과: 책에서 '담은 시각'만 뺀 것 + 화면에서 판본을 구분하려는 판 표시. */
export type SearchResult = Omit<Book, 'addedAt' | 'updatedAt'> & {
  /** '2판', '개정판' 등. 서재에는 저장하지 않는다 */
  edition?: string
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed : undefined
}

/**
 * 저자 표기를 읽기 좋게: "지은이: 엄원태" → "엄원태", "저자 : 아포리아에듀" → "아포리아에듀",
 * "김현경 지음" → "김현경", "지은이: 유발 하라리 ;옮긴이: 조현욱" → "유발 하라리, 조현욱 옮김"
 */
export function authorsOf(raw: string | undefined): string | undefined {
  const parts = (raw ?? '')
    .split(';')
    .map((part) => {
      const m = part.match(/^\s*([^:：]{1,6}?)\s*[:：]\s*(.+)$/)
      if (!m) return clean(part.replace(/\s+(?:지음|공저|저|글)$/, ''))
      const [, role, names] = m
      const who = clean(names.replace(/\s*,\s*/g, ', '))
      if (!who) return undefined
      if (/옮긴이|번역/.test(role)) return `${who} 옮김`
      if (/그린이|그림/.test(role)) return `${who} 그림`
      if (/엮은이|편/.test(role)) return `${who} 엮음`
      return who
    })
    .filter((part): part is string => !!part)
  return parts.length ? parts.join(', ') : undefined
}

/** "20260831" → "2026" */
function yearOf(raw: string | undefined): string | undefined {
  const m = raw?.match(/^\d{4}/)
  return m ? m[0] : undefined
}

/** ISBN-10의 앞 9자리로 ISBN-13을 만든다(978 접두 + 새 검사 숫자). 검사 숫자 때문에 X가 있어도 앞 9자리만 쓴다. */
export function isbn10to13(isbn10: string): string | undefined {
  const digits = isbn10.replace(/[^\dXx]/g, '')
  if (digits.length !== 10 || !/^\d{9}/.test(digits)) return undefined
  const base = '978' + digits.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3)
  return base + String((10 - (sum % 10)) % 10)
}

/**
 * EA_ISBN에서 ISBN-13을 얻는다. 13자리가 있으면 그것, 2007년 이전 책처럼 10자리만 있으면 13자리로 바꾼다
 * (이 앱의 id·도서관 조회는 ISBN-13이 기준이다). 둘 다 없으면 undefined.
 */
export function isbn13Of(raw: string | undefined): string | undefined {
  const tokens = (raw ?? '').match(/\d{13}|\d{9}[\dXx]/g) ?? []
  const direct = tokens.find((t) => /^97[89]\d{10}$/.test(t))
  if (direct) return direct
  for (const token of tokens) {
    const converted = token.length === 10 ? isbn10to13(token) : undefined
    if (converted) return converted
  }
  return undefined
}

/**
 * 검색 결과 레코드들을 책 목록으로: 전자책·ISBN 없는 레코드는 빼고, 같은 ISBN은 하나로 합치며,
 * 받은 순서를 지킨다.
 */
export function toSearchResults(docs: SeojiDoc[]): SearchResult[] {
  const seen = new Set<string>()
  const results: SearchResult[] = []
  for (const doc of docs) {
    const isbn13 = isbn13Of(doc.EA_ISBN)
    const title = clean(doc.TITLE)
    if (!isbn13 || !title || doc.EBOOK_YN === 'Y' || seen.has(isbn13)) continue
    seen.add(isbn13)
    results.push({
      id: isbn13,
      title,
      author: authorsOf(doc.AUTHOR),
      publisher: clean(doc.PUBLISHER),
      pubDate: yearOf(doc.REAL_PUBLISH_DATE) ?? yearOf(doc.PUBLISH_PREDATE),
      isbn13,
      kdc: /^\d$/.test(doc.KDC ?? '') ? doc.KDC : undefined,
      edition: clean(doc.EDITION_STMT),
    })
  }
  return results
}

/** 검색 결과를 서재에 담는다: 지금 시각을 담은 시각으로 붙인다(최신순 목록의 맨 위로 간다). 판 표시는 떼어 낸다. */
export function toBook(result: SearchResult, now = Date.now()): Book {
  const book: SearchResult = { ...result }
  delete book.edition
  return { ...book, addedAt: now }
}
