import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Book } from '../types/book'

interface GotolibDB extends DBSchema {
  books: {
    key: string
    value: Book
    indexes: { 'by-addedAt': number }
  }
}

let dbPromise: Promise<IDBPDatabase<GotolibDB>> | null = null

function getDB() {
  dbPromise ??= openDB<GotolibDB>('gotolib', 1, {
    upgrade(db) {
      const store = db.createObjectStore('books', { keyPath: 'id' })
      store.createIndex('by-addedAt', 'addedAt')
    },
  })
  return dbPromise
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB()
  return db.getAllFromIndex('books', 'by-addedAt')
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
