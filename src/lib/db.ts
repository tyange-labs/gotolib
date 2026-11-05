import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Book } from '../types/book'
import type { Library } from '../types/library'
import { emitLocalChange } from './localEvents'
import type { NovelSeojiDoc } from './novelsApi'
import { clampProgress } from './reading'
import { WATCHLIST_LIMIT } from './syncDoc'

/**
 * 찜한 책. 책 정보를 통째로 갖는다(서재의 책과 같은 모양 + 찜한 시각). 찜한 책은 `books`에서 빠지고 여기에만
 * 있다 — 같은 책이 두 저장소에 동시에 있지 않다. `addedAt`은 서재에 담았던 시각이라 찜을 풀면 원래 자리로 돌아간다.
 */
export type WatchItem = Book & { watchedAt: number }

interface GotolibDB extends DBSchema {
  books: {
    key: string
    value: Book
    indexes: { 'by-addedAt': number }
  }
  favLibraries: {
    key: string // libCode
    value: Library & { addedAt: number }
  }
  watchlist: {
    key: string // book id
    value: WatchItem
  }
  /**
   * 삭제 표시. 지운 항목을 다른 기기가 되살리지 못하게 '언제 지웠나'를 남긴다.
   * key는 `b:<bookId>` / `w:<bookId>` / `l:<libCode>`.
   */
  tombstones: {
    key: string
    value: { key: string; at: number }
  }
  /** 도서관 API 응답 캐시 (성공 응답만) */
  apiCache: {
    key: string
    value: { key: string; savedAt: number; data: unknown }
  }
  /**
   * '한국문학' 탭 수집 캐시. 출판사 × 해(key: `publisher|yyyy`)로 원본 서지 레코드를 쌓아 둔다.
   * 달 단위(구 novelMonths)는 17개 출판사 × 수십 달이라 요청이 너무 많아져 해 단위로 바꿨다(2026-11).
   * 걸러내는 기준(classifyNovel)이 바뀌어도 다시 긁지 않고 재계산만 하면 되게 원본을 둔다.
   * 개인 서재와 달리 동기화 대상이 아니라 삭제 표시(tombstone)가 없다.
   */
  novelPeriods: {
    key: string
    value: { key: string; publisher: string; period: string; fetchedAt: number; docs: NovelSeojiDoc[] }
  }
}

/** 삭제 표시 키 */
export const TOMB = {
  book: (id: string) => `b:${id}`,
  watch: (bookId: string) => `w:${bookId}`,
  lib: (libCode: string) => `l:${libCode}`,
}

let dbPromise: Promise<IDBPDatabase<GotolibDB>> | null = null

/**
 * 저장소 업그레이드가 막혔을 때의 알림. 구버전을 연 다른 탭이 이전 연결을 쥐고 있으면 브라우저는 새 버전의
 * 열기를 그 탭이 닫힐 때까지 무한정 기다린다(아무 오류도 없이). 화면이 '불러오는 중'에서 멈추지 않게 알린다.
 */
const blockedListeners = new Set<() => void>()
export const onDbBlocked = (listener: () => void) => {
  blockedListeners.add(listener)
  return () => {
    blockedListeners.delete(listener)
  }
}

export function getDB() {
  dbPromise ??= openDB<GotolibDB>('gotolib', 7, {
    blocked() {
      blockedListeners.forEach((listener) => listener())
    },
    // 더 새로운 버전이 업그레이드하려 하면 연결을 놓고 다시 불러온다(그래야 그쪽이 막히지 않는다).
    blocking() {
      void dbPromise?.then((db) => db.close())
      dbPromise = null
      location.reload()
    },
    // 브라우저가 연결을 일방적으로 끊은 경우(iOS는 백그라운드에서 자주 그런다): 캐시한 연결을 버려 다음에 새로 연다.
    terminated() {
      dbPromise = null
    },
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('books', { keyPath: 'id' })
        store.createIndex('by-addedAt', 'addedAt')
      }
      if (oldVersion < 2) {
        db.createObjectStore('favLibraries', { keyPath: 'libCode' })
        db.createObjectStore('watchlist', { keyPath: 'id' })
      }
      if (oldVersion < 3) {
        db.createObjectStore('apiCache', { keyPath: 'key' })
      }
      if (oldVersion < 4) {
        db.createObjectStore('tombstones', { keyPath: 'key' })
      }
      if (oldVersion < 6) {
        ;(db as unknown as { createObjectStore(name: string, opts: { keyPath: string }): void }).createObjectStore(
          'novelMonths',
          { keyPath: 'key' },
        )
      }
      if (oldVersion < 7) {
        // 달 단위 캐시(novelMonths)를 해 단위(novelPeriods)로 바꾼다 — 키 모양이 달라져서
        // 옮기지 않고 새로 긁는다(어차피 한국문학 탭을 다시 열면 다시 모은다). 스키마에서 이미 뺀
        // 이름이라 타입이 안 걸린다(실제 지우는 동작은 버전만 맞으면 그대로 된다).
        if (oldVersion >= 6) (db as unknown as { deleteObjectStore(name: string): void }).deleteObjectStore('novelMonths')
        db.createObjectStore('novelPeriods', { keyPath: 'key' })
      }
      if (oldVersion >= 2 && oldVersion < 5) {
        // 찜을 `{ bookId, addedAt }` 참조에서 책 통째 저장으로 옮긴다: 서재에서 꺼내 찜으로 보낸다.
        // 서재에 없는(샘플을 찜한) 항목은 버린다.
        const legacy = (await tx.objectStore('watchlist').getAll()) as unknown as Array<{
          bookId: string
          addedAt: number
        }>
        db.deleteObjectStore('watchlist')
        const watchlist = db.createObjectStore('watchlist', { keyPath: 'id' })
        const books = tx.objectStore('books')
        const now = Date.now()
        for (const item of legacy) {
          const book = await books.get(item.bookId)
          if (!book) continue
          await watchlist.put({ ...book, watchedAt: item.addedAt })
          await books.delete(item.bookId)
          if (oldVersion >= 4) {
            await tx.objectStore('tombstones').put({ key: TOMB.book(item.bookId), at: now })
          }
        }
      }
    },
  })
  return dbPromise
}

/**
 * iOS(특히 홈 화면 앱)는 백그라운드에 간 페이지의 IndexedDB 연결을 알리지도 않고 닫는다. 그 뒤 캐시한 연결로
 * 트랜잭션을 열면 'The database connection is closing.'이 나서 동기화가 멈춘다. 숨겨질 때 우리가 먼저 연결을
 * 닫아 두면(진행 중인 트랜잭션은 끝까지 간다) 다시 보일 때 새 연결로 열린다.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !dbPromise) return
    const closing = dbPromise
    dbPromise = null
    void closing.then((db) => db.close()).catch(() => {})
  })
}

// ── 도서 ──────────────────────────────────────────────
/** 보관함에 담은 최신순 */
export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB()
  return (await db.getAllFromIndex('books', 'by-addedAt')).reverse()
}

export async function saveBooks(books: Book[]): Promise<void> {
  const db = await getDB()
  const now = Date.now()
  const tx = db.transaction(['books', 'tombstones', 'watchlist'], 'readwrite')
  // 찜한 책은 서재에 또 넣지 않는다(한 책은 한 곳에만 있다).
  const watched = new Set(await tx.objectStore('watchlist').getAllKeys())
  // 다시 가져온 책은 '방금 바뀐 것'이라 이전의 삭제 표시를 이긴다. 다만 가져오는 파일에는 없는 소장·읽은 정도는
  // 이미 저장된 값을 지킨다(같은 파일을 다시 불러와도 내 기록이 지워지지 않게).
  await Promise.all(
    books
      .filter((book) => !watched.has(book.id))
      .map(async (book) => {
        const prev = await tx.objectStore('books').get(book.id)
        const value: Book = { ...book, updatedAt: now }
        if (prev?.owned && value.owned === undefined) value.owned = true
        if (prev?.progress && value.progress === undefined) value.progress = prev.progress
        await Promise.all([
          tx.objectStore('books').put(value),
          tx.objectStore('tombstones').delete(TOMB.book(book.id)),
        ])
      }),
  )
  await tx.done
  emitLocalChange()
}

/**
 * 소장 표시를 바꾼다. 찜(빌려보고 싶은 책)에 있던 책을 소장하면 찜에서 서재로 옮긴다 — 가졌으니 빌릴 필요가 없다.
 * 소장을 해제하면 읽은 정도도 지운다. 서재·찜 어디에도 없는 책이면 아무것도 하지 않는다.
 */
export async function setOwned(id: string, owned: boolean): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['books', 'watchlist', 'tombstones'], 'readwrite')
  const now = Date.now()
  const watchItem = await tx.objectStore('watchlist').get(id)
  let book: Book | undefined = await tx.objectStore('books').get(id)
  if (!book && watchItem && owned) {
    const moved: Partial<WatchItem> = { ...watchItem }
    delete moved.watchedAt
    book = moved as Book
  }
  if (!book) {
    await tx.done
    return
  }
  const next: Book = { ...book, updatedAt: now }
  if (owned) {
    next.owned = true
  } else {
    delete next.owned
    delete next.progress
  }
  const writes: Promise<unknown>[] = [
    tx.objectStore('books').put(next),
    tx.objectStore('tombstones').delete(TOMB.book(id)),
  ]
  if (watchItem && owned) {
    writes.push(
      tx.objectStore('watchlist').delete(id),
      tx.objectStore('tombstones').put({ key: TOMB.watch(id), at: now }),
    )
  }
  await Promise.all(writes)
  await tx.done
  emitLocalChange()
}

/** 읽은 정도(0~100%)를 저장한다. 소장한 책에만 적용된다. 0이면 필드를 지운다. */
export async function setProgress(id: string, progress: number): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('books', 'readwrite')
  const book = await tx.store.get(id)
  if (!book?.owned) {
    await tx.done
    return
  }
  const value = clampProgress(progress)
  const next: Book = { ...book, updatedAt: Date.now() }
  if (value === 0) delete next.progress
  else next.progress = value
  await tx.store.put(next)
  await tx.done
  emitLocalChange()
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['books', 'tombstones'], 'readwrite')
  await Promise.all([
    tx.objectStore('books').delete(id),
    tx.objectStore('tombstones').put({ key: TOMB.book(id), at: Date.now() }),
  ])
  await tx.done
  emitLocalChange()
}

export async function clearBooks(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['books', 'tombstones'], 'readwrite')
  const now = Date.now()
  const ids = await tx.objectStore('books').getAllKeys()
  await Promise.all([
    ...ids.map((id) =>
      tx.objectStore('tombstones').put({ key: TOMB.book(id), at: now }),
    ),
    tx.objectStore('books').clear(),
  ])
  await tx.done
  emitLocalChange()
}

// ── 자주 가는 도서관 ─────────────────────────────────
export async function getFavLibraries(): Promise<Library[]> {
  const db = await getDB()
  const rows = await db.getAll('favLibraries')
  return rows.sort((a, b) => a.addedAt - b.addedAt)
}

export async function addFavLibrary(library: Library): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['favLibraries', 'tombstones'], 'readwrite')
  await Promise.all([
    tx.objectStore('favLibraries').put({ ...library, addedAt: Date.now() }),
    tx.objectStore('tombstones').delete(TOMB.lib(library.libCode)),
  ])
  await tx.done
  emitLocalChange()
}

export async function removeFavLibrary(libCode: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['favLibraries', 'tombstones'], 'readwrite')
  await Promise.all([
    tx.objectStore('favLibraries').delete(libCode),
    tx.objectStore('tombstones').put({ key: TOMB.lib(libCode), at: Date.now() }),
  ])
  await tx.done
  emitLocalChange()
}

// ── 도서 찜 목록 ──────────────────────────────────
export async function getWatchlist(): Promise<WatchItem[]> {
  const db = await getDB()
  const rows = await db.getAll('watchlist')
  return rows.sort((a, b) => a.watchedAt - b.watchedAt)
}

/**
 * 책을 서재에서 찜으로 옮긴다(한 트랜잭션: 서재에서 지우고 찜에 넣는다). 한도가 차 있으면 false.
 * 서재에 없는 책이면 받은 값 그대로 찜에 넣는다.
 */
export async function watchBook(book: Book): Promise<boolean> {
  const db = await getDB()
  const tx = db.transaction(['books', 'watchlist', 'tombstones'], 'readwrite')
  const watchlist = tx.objectStore('watchlist')
  if ((await watchlist.count()) >= WATCHLIST_LIMIT && !(await watchlist.get(book.id))) {
    await tx.done
    return false
  }
  const now = Date.now()
  const stored = (await tx.objectStore('books').get(book.id)) ?? book
  const value: Book = { ...stored }
  delete value.updatedAt
  await Promise.all([
    watchlist.put({ ...value, watchedAt: now }),
    tx.objectStore('books').delete(book.id),
    tx.objectStore('tombstones').put({ key: TOMB.book(book.id), at: now }),
    tx.objectStore('tombstones').delete(TOMB.watch(book.id)),
  ])
  await tx.done
  emitLocalChange()
  return true
}

/** 찜을 풀어 책을 서재로 되돌린다(원래 담은 시각 그대로라 원래 자리로 간다). */
export async function unwatchBook(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['books', 'watchlist', 'tombstones'], 'readwrite')
  const item = await tx.objectStore('watchlist').get(id)
  const now = Date.now()
  const writes: Promise<unknown>[] = [
    tx.objectStore('watchlist').delete(id),
    tx.objectStore('tombstones').put({ key: TOMB.watch(id), at: now }),
  ]
  if (item) {
    const book: Partial<WatchItem> = { ...item }
    delete book.watchedAt
    writes.push(
      tx.objectStore('books').put({ ...(book as Book), updatedAt: now }),
      tx.objectStore('tombstones').delete(TOMB.book(id)),
    )
  }
  await Promise.all(writes)
  await tx.done
  emitLocalChange()
}

// ── '한국문학' 수집 캐시 ──────────────────────────────
export async function putNovelPeriod(
  publisher: string,
  period: string,
  docs: NovelSeojiDoc[],
): Promise<void> {
  const db = await getDB()
  await db.put('novelPeriods', {
    key: `${publisher}|${period}`,
    publisher,
    period,
    fetchedAt: Date.now(),
    docs,
  })
}

/** 캐시에 쌓인 해별 레코드 전체(걸러내기 전). 출판사별로 다시 거르려면 publisher가 필요해서 통째로 둔다. */
export async function getAllNovelPeriods(): Promise<
  Array<{ publisher: string; period: string; docs: NovelSeojiDoc[] }>
> {
  const db = await getDB()
  return db.getAll('novelPeriods')
}

/** 선택한 연도 칩을 새로고침할 때만 그 해(모든 출판사)만 지운다 — 다른 해 캐시는 그대로 둔다. */
export async function clearNovelCacheForYear(period: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('novelPeriods', 'readwrite')
  const rows = await tx.store.getAll()
  await Promise.all(
    rows.filter((row) => row.period === period).map((row) => tx.store.delete(row.key)),
  )
  await tx.done
}

// ── API 응답 캐시 ────────────────────────────────────
export async function getApiCache(
  key: string,
): Promise<{ savedAt: number; data: unknown } | undefined> {
  const db = await getDB()
  return db.get('apiCache', key)
}

export async function putApiCache(key: string, data: unknown): Promise<void> {
  const db = await getDB()
  await db.put('apiCache', { key, savedAt: Date.now(), data })
}

export async function removeApiCache(key: string): Promise<void> {
  const db = await getDB()
  await db.delete('apiCache', key)
}
