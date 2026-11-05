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

/**
 * 더 물어볼 필요가 없는 답인가: 장편/소설집을 확정해 주는 신호(YES24 분류나 알라딘 형식어)까지 왔을 때만.
 * `status: 'ok'`여도 그 신호가 없으면 서버가 아직 모으는 중일 수 있다(YES24 백필, 알라딘 상세 보충) —
 * 그래서 계속 물어서, 새로고침 없이도 나중에 들어온 정보가 반영되게 한다.
 */
export function isSettled(entry: BookInfoEntry | undefined): boolean {
  return entry?.status === 'ok' && (entry.yes24Form != null || entry.formHint != null)
}

/** 서버가 아직 한 번도 결론을 못 낸(수집 대기 중인) 답 */
export const isPending = (entry: BookInfoEntry | undefined): boolean => entry?.status !== 'ok'

/**
 * 다시 물어볼 ISBN(중복·ISBN 없음은 뺀다). 기본은 확정되지 않은 것 전부, `needsAsking`으로 좁힐 수 있다.
 * 출간예정 책은 covers.ts와 같은 이유로 애초에 묻지 않는다.
 */
export function isbnsToAsk(
  isbns: ReadonlyArray<{ isbn: string | undefined; pubDate?: string }>,
  known: Readonly<Record<string, BookInfoEntry | undefined>>,
  needsAsking: (entry: BookInfoEntry | undefined) => boolean = (entry) => !isSettled(entry),
): string[] {
  const seen = new Set<string>()
  const ask: string[] = []
  for (const { isbn, pubDate } of isbns) {
    if (!isbn || seen.has(isbn) || isUnreleased(pubDate)) continue
    seen.add(isbn)
    if (needsAsking(known[isbn])) ask.push(isbn)
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
