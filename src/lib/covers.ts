/**
 * 책 표지: 서버(tyange-cms-api)가 ISBN으로 알라딘에서 찾아 줄여 둔 썸네일을 받아 온다.
 * 표지는 앱 데이터가 아니라 서버가 ISBN으로 주는 파생 정보라서 `Book`·IndexedDB·동기화 문서에는 넣지 않는다.
 */
import { api, apiUrl } from './auth'

export type CoverEntry =
  | { status: 'ok'; url: string }
  | { status: 'pending' }
  | { status: 'missing' }

interface CoversResponse {
  covers: Record<string, { status: string; url?: string }>
}

/** 서버가 한 번에 받는 ISBN 상한(MAX_ISBNS_PER_REQUEST)과 맞춘다. */
export const MAX_ISBNS_PER_REQUEST = 50

/** 아직 수집 중인 표지를 다시 물어보는 간격(점점 늘린다). 다 쓰면 그 화면에서는 더 묻지 않는다. */
export const POLL_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000]

/** 서버 응답을 앱이 쓰는 모양으로: 알 수 없는 상태는 '아직'으로 본다. */
export function toEntry(raw: { status: string; url?: string } | undefined): CoverEntry {
  if (raw?.status === 'ok' && raw.url) return { status: 'ok', url: apiUrl(raw.url) }
  if (raw?.status === 'missing') return { status: 'missing' }
  return { status: 'pending' }
}

/**
 * 지금 서버에 물어야 할 ISBN: 중복을 없애고, 이미 결론(ok·missing)이 난 것은 뺀다.
 * ISBN이 없는 책(undefined·빈 값)은 처음부터 뺀다.
 */
export function isbnsToAsk(
  isbns: ReadonlyArray<string | undefined>,
  known: Readonly<Record<string, CoverEntry | undefined>>,
): string[] {
  const seen = new Set<string>()
  const ask: string[] = []
  for (const isbn of isbns) {
    if (!isbn || seen.has(isbn)) continue
    seen.add(isbn)
    const state = known[isbn]?.status
    if (state !== 'ok' && state !== 'missing') ask.push(isbn)
  }
  return ask
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 로그인 없이 쓰는 조회. 서버가 DB만 보고 바로 답한다. */
export async function fetchCovers(isbns: string[]): Promise<Record<string, CoverEntry>> {
  const response = await api<CoversResponse>(`/gotolib/covers?isbn=${isbns.join(',')}`, { auth: false })
  const result: Record<string, CoverEntry> = {}
  for (const isbn of isbns) result[isbn] = toEntry(response.covers[isbn])
  return result
}
