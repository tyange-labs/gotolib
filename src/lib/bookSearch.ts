/**
 * 국립중앙도서관 Open API(도서 검색) 응답 → 이 앱의 책 데이터. 순수 함수만 둔다.
 *
 * 왜 국립중앙도서관인가: 도서관 정보나루 검색은 '도서관이 소장한 책'만 찾아서 아직 소장하지 않은 신간이나
 * 절판본은 검색조차 안 됐다. 국립중앙도서관은 납본으로 출간된 책 대부분을 갖고 있다.
 *
 * 응답은 서지 레코드 단위라 정리할 게 많다(실제 응답으로 확인):
 * - 같은 책(ISBN)이 서로 다른 모양의 레코드로 여러 번 나온다 → ISBN으로 합치고 가장 깔끔한 레코드를 쓴다
 * - 제목에 강조용 HTML 태그와 ' : 부제'가 붙고, 저자는 '김경욱[1971-]'·'지은이: 엄원태'처럼 제각각이다
 * - 출판사 칸이 '파주 : 문학동네, 2008' 꼴인 레코드가 있다
 * - 2007년 이전 책은 ISBN-10만 있다 → 이 앱이 쓰는 ISBN-13으로 바꾼다
 * - 아주 오래된 책은 ISBN이 없다 → 제목+저자 해시 id로 담을 수 있게 한다(도서관 찾기는 불가)
 */
import type { Book } from '../types/book'
import { fallbackId } from './bookId'

/** 국립중앙도서관 검색 결과 한 건 중 이 앱이 읽는 필드 */
export interface NlDoc {
  titleInfo?: string
  authorInfo?: string
  pubInfo?: string
  pubYearInfo?: string
  isbn?: string
  /** KDC 주류 한 자리 */
  kdcCode1s?: string
  /** 정식 서지 레코드에만 채워진다('인쇄자료(책자형)'). 가장 깔끔한 레코드를 고르는 단서로 쓴다 */
  mediaName?: string
}

/** 검색 결과: 책에서 '담은 시각'만 뺀 것. 추가하는 순간 시각이 붙는다. */
export type SearchResult = Omit<Book, 'addedAt' | 'updatedAt'>

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed : undefined
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/** 강조용 `<span class="searching_txt">…</span>`를 걷어내고 HTML 엔티티를 되돌린다. */
function plain(html: string | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e)
}

/** "침엽수림에서 : 엄원태 시집" → "침엽수림에서". 영문 병기(' = …')도 뗀다. */
function titleOf(info: string | undefined): string | undefined {
  return clean(plain(info).split(/\s+[:=]\s+/)[0])
}

/**
 * 저자 표기를 읽기 좋게:
 * "지은이: 엄원태" → "엄원태", "김경욱[1971-]" → "김경욱", "지은이: 유발 하라리 ;옮긴이: 조현욱" →
 * "유발 하라리, 조현욱 옮김", "권여선 권여선[1965-]" → "권여선"
 */
function authorsOf(raw: string | undefined): string | undefined {
  let text = plain(raw)
    .replace(/\[[^\]]*\]/g, '') // 생몰년 표기 [1971-]
    .replace(/\s*;\s*/g, ', ')
    .replace(/지은이\s*:\s*/g, '')
    .replace(/옮긴이\s*:\s*([^,]+)/g, '$1 옮김')
    .replace(/그린이\s*:\s*([^,]+)/g, '$1 그림')
  text = clean(text) ?? ''
  // 같은 이름이 두 번 이어 붙은 경우("권여선 권여선")
  const doubled = text.match(/^(.+?)\s+\1$/)
  if (doubled) text = doubled[1]
  return text || undefined
}

/**
 * 출판사: "파주 : 문학동네, 2008" → "문학동네". 쉼표 뒤에 연도가 붙은 '발행지 : 출판사, 연도' 꼴만 벗긴다
 * ('웅진지식하우스 : 웅진씽크빅'처럼 발행처 이름 자체에 ':'이 있는 경우는 그대로 둔다).
 */
function publisherOf(raw: string | undefined): string | undefined {
  const text = clean(plain(raw))
  if (!text) return undefined
  const m = text.match(/^[^:,]+ : (.+?),\s*\d{4}/)
  return clean(m ? m[1] : text)
}

/** "20070410"이나 "2008" → "2008" */
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

/** isbn 칸에서 ISBN-13을 얻는다. 13자리가 있으면 그것, 없으면 ISBN-10을 변환. 없으면 undefined. */
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

interface Candidate {
  /** 같은 책인지 가르는 키: ISBN-13, 없으면 정규화한 제목+연도 */
  key: string
  score: number
  result: SearchResult
}

function candidateOf(doc: NlDoc): Candidate | null {
  const title = titleOf(doc.titleInfo)
  if (!title) return null

  const isbn13 = isbn13Of(doc.isbn)
  const author = authorsOf(doc.authorInfo)
  const publisher = publisherOf(doc.pubInfo)
  const pubDate = yearOf(doc.pubYearInfo)
  const kdc = /^\d$/.test(doc.kdcCode1s ?? '') ? doc.kdcCode1s : undefined

  // 정식 서지 레코드(mediaName 있음) > 저자·출판사 표기가 깔끔한 레코드 순으로 고른다.
  const score =
    (clean(doc.mediaName) ? 2 : 0) +
    (/[[:]/.test(doc.authorInfo ?? '') ? 0 : 1) +
    (/ : /.test(doc.pubInfo ?? '') ? 0 : 1)

  const key = isbn13 ?? `t:${title.replace(/\s+/g, '')}|${pubDate ?? ''}`
  return {
    key,
    score,
    result: {
      id: isbn13 ?? fallbackId(title, author),
      title,
      author,
      publisher,
      pubDate,
      isbn13,
      kdc,
    },
  }
}

/**
 * 검색 결과 레코드들을 책 목록으로: 같은 책은 하나로 합치고(가장 깔끔한 레코드), 처음 나온 순서를 지킨다.
 * ISBN이 없어도 제목이 있으면 담을 수 있게 둔다(오래된 책).
 */
export function toSearchResults(docs: NlDoc[]): SearchResult[] {
  const best = new Map<string, Candidate>()
  for (const doc of docs) {
    const candidate = candidateOf(doc)
    if (!candidate) continue
    const current = best.get(candidate.key)
    // 점수가 더 높을 때만 바꾼다(같으면 먼저 나온 것). Map은 처음 넣은 키의 순서를 유지한다.
    if (!current || candidate.score > current.score) best.set(candidate.key, candidate)
  }
  return [...best.values()].map((c) => c.result)
}

/** 검색 결과를 서재에 담는다: 지금 시각을 담은 시각으로 붙인다(최신순 목록의 맨 위로 간다). */
export function toBook(result: SearchResult, now = Date.now()): Book {
  return { ...result, addedAt: now }
}
