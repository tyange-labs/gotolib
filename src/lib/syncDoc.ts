/**
 * 기기 간 동기화 문서와 합치기 규칙. 네트워크·IndexedDB를 모르는 순수 함수만 둔다.
 *
 * 항목마다 `at`(마지막으로 바뀐 시각, ms)을 두고 더 늦은 쪽이 이긴다(LWW). 삭제는 지우지 않고
 * `deleted` 표시(tombstone)로 남겨서 다른 기기가 지운 항목을 되살리지 못하게 한다.
 * 합치기는 교환·결합·멱등이라 어느 기기에서 어떤 순서로 합쳐도 같은 결과로 수렴한다.
 */
import type { Library } from '../types/library'
import type { Book } from '../types/book'

export const SYNC_VERSION = 1
/** 찜 목록 최대 개수. useWatchlist의 한도와 같아야 한다. */
export const WATCHLIST_LIMIT = 5
/**
 * 서버에 올리는 책 수 상한(가장 최근에 담은 순). 서버 문서 상한은 512KB이고 책은 권당 200~300바이트라
 * 1,000권이면 약 300KB다. 넘는 책은 이 기기에만 남는다(지운 것으로 취급하지 않는다).
 */
export const SYNC_MAX_BOOKS = 1000
/** 서버에 올리는 삭제 표시 상한(가장 최근 것부터). 지운 책이 쌓여 문서가 커지는 걸 막는다. */
export const SYNC_MAX_TOMBSTONES = 1500

export interface WatchEntryValue {
  bookId: string
  addedAt: number
}
export type FavLibraryValue = Library & { addedAt: number }

export interface SyncEntry<T> {
  /** 마지막으로 바뀐 시각. LWW의 시계. */
  at: number
  deleted?: true
  value?: T
}

export interface SyncDoc {
  v: typeof SYNC_VERSION
  books: Record<string, SyncEntry<Book>>
  watchlist: Record<string, SyncEntry<WatchEntryValue>>
  favLibraries: Record<string, SyncEntry<FavLibraryValue>>
}

export const emptyDoc = (): SyncDoc => ({
  v: SYNC_VERSION,
  books: {},
  watchlist: {},
  favLibraries: {},
})

/** 키 순서와 무관하게 같은 값이면 같은 문자열. 동률 판정과 '바뀐 게 없나' 비교에 쓴다. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  )
}

/** 두 항목 중 이긴 쪽. at이 크면 승, 같으면 삭제가 승, 그것도 같으면 값 비교로 결정(교환 법칙). */
function pick<T>(a: SyncEntry<T>, b: SyncEntry<T>): SyncEntry<T> {
  if (a.at !== b.at) return a.at > b.at ? a : b
  if (Boolean(a.deleted) !== Boolean(b.deleted)) return a.deleted ? a : b
  return canonical(a) >= canonical(b) ? a : b
}

function mergeRecords<T>(
  a: Record<string, SyncEntry<T>>,
  b: Record<string, SyncEntry<T>>,
): Record<string, SyncEntry<T>> {
  const out: Record<string, SyncEntry<T>> = {}
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const left = a[key]
    const right = b[key]
    out[key] = left && right ? pick(left, right) : (left ?? right)
  }
  return out
}

export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  return {
    v: SYNC_VERSION,
    books: mergeRecords(a.books, b.books),
    watchlist: mergeRecords(a.watchlist, b.watchlist),
    favLibraries: mergeRecords(a.favLibraries, b.favLibraries),
  }
}

/**
 * 합친 결과에 불변식을 맞춘다: 살아 있는 찜이 한도를 넘으면 오래된 것부터 삭제 표시로 바꾼다.
 * 삭제 표시의 시각을 `at + 1`로 정하는 건, 기기마다 'now'가 달라 결과가 갈리는 걸 막기 위해서다.
 * (그 사이 누군가 더 최근에 다시 찜하면 그쪽이 이긴다.)
 */
export function normalizeDoc(doc: SyncDoc): SyncDoc {
  const live = Object.entries(doc.watchlist)
    .filter(([, entry]) => !entry.deleted)
    // 새로운 것 먼저. 같은 시각이면 키로 가른다.
    .sort(([ka, a], [kb, b]) => b.at - a.at || (ka < kb ? -1 : 1))
  if (live.length <= WATCHLIST_LIMIT) return doc

  const watchlist = { ...doc.watchlist }
  for (const [key, entry] of live.slice(WATCHLIST_LIMIT)) {
    watchlist[key] = { at: entry.at + 1, deleted: true }
  }
  return { ...doc, watchlist }
}

/** 서버에서 받은 값을 믿지 않고 모양만 확인한다. 맞지 않으면 빈 문서로 취급한다. */
export function parseDoc(raw: unknown): SyncDoc {
  if (!raw || typeof raw !== 'object') return emptyDoc()
  const doc = raw as Partial<SyncDoc>
  if (doc.v !== SYNC_VERSION) return emptyDoc()
  const record = (value: unknown) =>
    value && typeof value === 'object' ? (value as Record<string, never>) : {}
  return {
    v: SYNC_VERSION,
    books: record(doc.books),
    watchlist: record(doc.watchlist),
    favLibraries: record(doc.favLibraries),
  }
}

/**
 * 서버에 올릴 문서로 줄인다: 책은 가장 최근에 담은 SYNC_MAX_BOOKS권까지, 삭제 표시는 가장 최근
 * SYNC_MAX_TOMBSTONES개까지. 줄이는 건 '올리는 것'뿐이다 — 이 기기의 데이터는 건드리지 않고,
 * 올리지 않은 책이 다른 기기에서 지워지는 일도 없다(삭제 표시를 만들지 않는다).
 */
export function limitDoc(doc: SyncDoc): { doc: SyncDoc; omittedBooks: number } {
  const liveBooks = Object.entries(doc.books)
    .filter(([, entry]) => !entry.deleted)
    // '담은 시각'(addedAt) 기준 최신순. 수정 시각(at)이 아니다 — 다시 가져와서 at이 전부 같아져도
    // 담은 순서는 유지돼야 한다.
    .sort(
      ([ka, a], [kb, b]) =>
        (b.value?.addedAt ?? 0) - (a.value?.addedAt ?? 0) || (ka < kb ? -1 : 1),
    )
  const dropBooks = new Set(liveBooks.slice(SYNC_MAX_BOOKS).map(([key]) => key))

  const tombstones: Array<[Domain, string, number]> = []
  for (const domain of ['books', 'watchlist', 'favLibraries'] as const) {
    for (const [key, entry] of Object.entries(doc[domain])) {
      if (entry.deleted) tombstones.push([domain, key, entry.at])
    }
  }
  tombstones.sort((a, b) => b[2] - a[2] || (a[1] < b[1] ? -1 : 1))
  const dropTombstones = new Set(
    tombstones.slice(SYNC_MAX_TOMBSTONES).map(([domain, key]) => `${domain}:${key}`),
  )

  if (dropBooks.size === 0 && dropTombstones.size === 0) {
    return { doc, omittedBooks: 0 }
  }

  const keep = <T>(domain: Domain, record: Record<string, SyncEntry<T>>) =>
    Object.fromEntries(
      Object.entries(record).filter(
        ([key]) =>
          !(domain === 'books' && dropBooks.has(key)) &&
          !dropTombstones.has(`${domain}:${key}`),
      ),
    )
  return {
    doc: {
      v: SYNC_VERSION,
      books: keep('books', doc.books),
      watchlist: keep('watchlist', doc.watchlist),
      favLibraries: keep('favLibraries', doc.favLibraries),
    },
    omittedBooks: dropBooks.size,
  }
}

type Domain = 'books' | 'watchlist' | 'favLibraries'
