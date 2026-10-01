import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Book } from '../types/book'
import type { Library } from '../types/library'
import { emitLocalChange } from './localEvents'

/** 찜 목록 항목 */
export interface WatchItem {
  bookId: string
  addedAt: number
}

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
    key: string // bookId
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
  dbPromise ??= openDB<GotolibDB>('gotolib', 4, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('books', { keyPath: 'id' })
        store.createIndex('by-addedAt', 'addedAt')
      }
      if (oldVersion < 2) {
        db.createObjectStore('favLibraries', { keyPath: 'libCode' })
        db.createObjectStore('watchlist', { keyPath: 'bookId' })
      }
      if (oldVersion < 3) {
        db.createObjectStore('apiCache', { keyPath: 'key' })
      }
      if (oldVersion < 4) {
        db.createObjectStore('tombstones', { keyPath: 'key' })
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
  const tx = db.transaction(['books', 'tombstones'], 'readwrite')
  // 다시 가져온 책은 '방금 바뀐 것'이라 이전의 삭제 표시를 이긴다.
  await Promise.all(
    books.flatMap((book) => [
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
  return rows.sort((a, b) => a.addedAt - b.addedAt)
}

export async function addWatchItem(bookId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['watchlist', 'tombstones'], 'readwrite')
  await Promise.all([
    tx.objectStore('watchlist').put({ bookId, addedAt: Date.now() }),
    tx.objectStore('tombstones').delete(TOMB.watch(bookId)),
  ])
  await tx.done
  emitLocalChange()
}

export async function removeWatchItem(bookId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['watchlist', 'tombstones'], 'readwrite')
  await Promise.all([
    tx.objectStore('watchlist').delete(bookId),
    tx.objectStore('tombstones').put({ key: TOMB.watch(bookId), at: Date.now() }),
  ])
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
