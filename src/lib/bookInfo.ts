/**
 * 알라딘 책 정보: 서버(tyange-cms-api)가 ISBN으로 모아 둔 걸 받아 온다. 표지(covers.ts)와 같은
 * 큐·같은 행을 보는 조회다 — '한국문학' 탭의 장편/소설집 판정을 NL 서지 추정보다 믿을 만하게 보강한다.
 * 제목·사람·출판사 같은 상세는 종이책에만 있다(서버가 전자책 상세는 쌓지 않는다).
 */
import { api } from './auth'
import { isUnreleased } from './covers'

export interface BookPerson {
  name: string
  /** 페이지 표기 그대로: "지은이", "옮긴이", "글" … */
  role?: string
}

export interface BookInfoEntry {
  status: 'ok' | 'pending'
  /** 분류 경로들. 한 책이 여러 분류에 걸릴 수 있다 */
  categories?: string[]
  /** 예전 서버 응답의 분류 한 줄(categories가 없을 때만 본다) */
  category?: string
  formHint?: string
  pages?: number
  title?: string
  subtitle?: string
  people?: BookPerson[]
  publisher?: string
  pubDate?: string
  originalTitle?: string
  hasEbook?: boolean
  size?: string
  weight?: string
  extraInfo?: string[]
  /** YES24 분류("한국 장편소설"/"한국 단편소설")에서 찾은 형식. status가 pending이어도 올 수 있다 */
  yes24Form?: '장편' | '단편'
}

interface BookInfoResponse {
  info: Record<string, BookInfoEntry>
}

export const MAX_ISBNS_PER_REQUEST = 50

/** 아직 결론(ok)이 안 난 ISBN만. 출간예정 책은 covers.ts와 같은 이유로 애초에 묻지 않는다 */
export function isbnsToAsk(
  isbns: ReadonlyArray<{ isbn: string | undefined; pubDate?: string }>,
  known: Readonly<Record<string, BookInfoEntry | undefined>>,
): string[] {
  const seen = new Set<string>()
  const ask: string[] = []
  for (const { isbn, pubDate } of isbns) {
    if (!isbn || seen.has(isbn) || isUnreleased(pubDate)) continue
    seen.add(isbn)
    if (known[isbn]?.status !== 'ok') ask.push(isbn)
  }
  return ask
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 로그인 없이 쓰는 조회. 서버가 DB만 보고 바로 답한다(알라딘은 부르지 않는다). */
export async function fetchBookInfo(isbns: string[]): Promise<Record<string, BookInfoEntry>> {
  const response = await api<BookInfoResponse>(`/gotolib/book-info?isbn=${isbns.join(',')}`, { auth: false })
  return response.info
}
