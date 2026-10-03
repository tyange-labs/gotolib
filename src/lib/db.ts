import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Book } from '../types/book'
import type { Library } from '../types/library'
import { SAMPLE_BOOKS } from '../data/sampleBooks'
import { emitLocalChange } from './localEvents'
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
}

/** 삭제 표시 키 */
export const TOMB = {
  book: (id: string) => `b:${id}`,
  watch: (bookId: string) => `w:${bookId}`,
  lib: (libCode: string) => `l:${libCode}`,
}

let dbPromise: Promise<IDBPDatabase<GotolibDB>> | null = null

export function getDB() {
  dbPromise ??= openDB<GotolibDB>('gotolib', 5, {
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
  // 다시 가져온 책은 '방금 바뀐 것'이라 이전의 삭제 표시를 이긴다.
  await Promise.all(
    books.filter((book) => !watched.has(book.id)).flatMap((book) => [
      tx.objectStore('books').put({ ...book, updatedAt: now }),
      tx.objectStore('tombstones').delete(TOMB.book(book.id)),
    ]),
  )
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
 * 서재에 없는 책(샘플)이면 받은 값 그대로 찜에 넣는다.
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

/**
 * 찜을 풀어 책을 서재로 되돌린다(원래 담은 시각 그대로라 원래 자리로 간다). 서재가 비어 있고 샘플 책이면
 * 서재에 넣지 않는다 — 샘플은 서재가 비어 있는 동안 저절로 다시 보인다.
 */
export async function unwatchBook(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['books', 'watchlist', 'tombstones'], 'readwrite')
  const item = await tx.objectStore('watchlist').get(id)
  const now = Date.now()
  const writes: Promise<unknown>[] = [
    tx.objectStore('watchlist').delete(id),
    tx.objectStore('tombstones').put({ key: TOMB.watch(id), at: now }),
  ]
  const isSample =
    SAMPLE_BOOKS.some((book) => book.id === id) && (await tx.objectStore('books').count()) === 0
  if (item && !isSample) {
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
