import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Library } from './libraryApi'
import type { Book } from '../types/book'

/** 와치리스트 항목 */
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
  /** 도서관 API 응답 캐시 (성공 응답만) */
  apiCache: {
    key: string
    value: { key: string; savedAt: number; data: unknown }
  }
}

let dbPromise: Promise<IDBPDatabase<GotolibDB>> | null = null

function getDB() {
  dbPromise ??= openDB<GotolibDB>('gotolib', 3, {
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
  const tx = db.transaction('books', 'readwrite')
  await Promise.all(books.map((book) => tx.store.put(book)))
  await tx.done
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('books', id)
}

export async function clearBooks(): Promise<void> {
  const db = await getDB()
  await db.clear('books')
}

// ── 자주 가는 도서관 ─────────────────────────────────
export async function getFavLibraries(): Promise<Library[]> {
  const db = await getDB()
  const rows = await db.getAll('favLibraries')
  return rows.sort((a, b) => a.addedAt - b.addedAt)
}

export async function addFavLibrary(library: Library): Promise<void> {
  const db = await getDB()
  await db.put('favLibraries', { ...library, addedAt: Date.now() })
}

export async function removeFavLibrary(libCode: string): Promise<void> {
  const db = await getDB()
  await db.delete('favLibraries', libCode)
}

// ── 도서 와치리스트 ──────────────────────────────────
export async function getWatchlist(): Promise<WatchItem[]> {
  const db = await getDB()
  const rows = await db.getAll('watchlist')
  return rows.sort((a, b) => a.addedAt - b.addedAt)
}

export async function addWatchItem(bookId: string): Promise<void> {
  const db = await getDB()
  await db.put('watchlist', { bookId, addedAt: Date.now() })
}

export async function removeWatchItem(bookId: string): Promise<void> {
  const db = await getDB()
  await db.delete('watchlist', bookId)
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
