import { IDBFactory } from 'fake-indexeddb'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'bun:test'
import { openDB } from 'idb'
import type { Book } from '../src/types/book'

/** 테스트마다 비어 있는 IndexedDB로 바꾼다. */
const resetIndexedDB = () => {
  Object.assign(globalThis, { indexedDB: new IDBFactory() })
}

// db.ts는 모듈 상태(열린 DB)를 가지므로, 테스트마다 새로 불러온다.
async function fresh() {
  resetIndexedDB()
  return await import(`../src/lib/db?${Math.random()}`)
}

const book = (id: string, addedAt = 1): Book => ({ id, title: `책 ${id}`, addedAt })

describe('찜과 서재는 겹치지 않는다', () => {
  let db: Awaited<ReturnType<typeof fresh>>
  beforeEach(async () => {
    db = await fresh()
  })

  test('찜하면 서재에서 빠지고 찜에만 있다(서재의 담은 시각 유지)', async () => {
    await db.saveBooks([book('a', 10), book('b', 20)])
    expect(await db.watchBook(book('a', 10))).toBe(true)
    expect((await db.getAllBooks()).map((b: Book) => b.id)).toEqual(['b'])
    const watched = await db.getWatchlist()
    expect(watched.map((w: Book) => w.id)).toEqual(['a'])
    expect(watched[0].addedAt).toBe(10)
    expect(watched[0].watchedAt).toBeGreaterThan(0)
  })

  test('찜을 풀면 원래 담은 시각 그대로 서재로 돌아온다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.watchBook(book('a', 10))
    await db.unwatchBook('a')
    expect(await db.getWatchlist()).toEqual([])
    const books = await db.getAllBooks()
    expect(books.map((b: Book) => [b.id, b.addedAt])).toEqual([['a', 10]])
  })

  test('찜한 책을 가져오기·검색으로 다시 담아도 서재에 생기지 않는다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.watchBook(book('a', 10))
    await db.saveBooks([book('a', 99), book('c', 5)])
    expect((await db.getAllBooks()).map((b: Book) => b.id)).toEqual(['c'])
    expect((await db.getWatchlist()).map((w: Book) => w.id)).toEqual(['a'])
  })

  test('한도(5권)가 차면 더 찜하지 못하고 서재는 그대로다', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    await db.saveBooks(ids.map((id) => book(id)))
    for (const id of ids.slice(0, 5)) expect(await db.watchBook(book(id))).toBe(true)
    expect(await db.watchBook(book('f'))).toBe(false)
    expect((await db.getAllBooks()).map((b: Book) => b.id)).toEqual(['f'])
    expect(await db.getWatchlist()).toHaveLength(5)
  })

  test('서재에 없는 책도 찜할 수 있고, 풀면 서재로 돌아온다', async () => {
    const outside = { id: '9788932027265', title: '사람, 장소, 환대', addedAt: 7 }
    expect(await db.watchBook(outside)).toBe(true)
    expect(await db.getAllBooks()).toEqual([])
    await db.unwatchBook(outside.id)
    expect(await db.getWatchlist()).toEqual([])
    expect((await db.getAllBooks()).map((b: Book) => [b.id, b.addedAt])).toEqual([[outside.id, 7]])
  })

  test('옮길 때 삭제 표시가 남아 동기화가 옛 위치를 되살리지 못한다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.watchBook(book('a', 10))
    const raw = await openDB('gotolib')
    const tombs = await raw.getAll('tombstones')
    expect(tombs.map((t: { key: string }) => t.key)).toContain('b:a')
    await db.unwatchBook('a')
    const after = (await raw.getAll('tombstones')).map((t: { key: string }) => t.key)
    expect(after).toContain('w:a')
    expect(after).not.toContain('b:a')
  })
})

describe('데이터베이스 v4 → v5 이전', () => {
  test('찜 참조가 책 통째 저장으로 바뀌고 서재에서 빠진다', async () => {
    resetIndexedDB()
    // 옛 모양(v4)을 직접 만든다.
    const old = await openDB('gotolib', 4, {
      upgrade(d) {
        d.createObjectStore('books', { keyPath: 'id' }).createIndex('by-addedAt', 'addedAt')
        d.createObjectStore('favLibraries', { keyPath: 'libCode' })
        d.createObjectStore('watchlist', { keyPath: 'bookId' })
        d.createObjectStore('apiCache', { keyPath: 'key' })
        d.createObjectStore('tombstones', { keyPath: 'key' })
      },
    })
    await old.put('books', { id: 'a', title: '찜한 책', addedAt: 10 })
    await old.put('books', { id: 'b', title: '그냥 책', addedAt: 20 })
    await old.put('watchlist', { bookId: 'a', addedAt: 50 })
    await old.put('watchlist', { bookId: 'ghost', addedAt: 60 }) // 서재에 없는 항목
    old.close()

    const db = await import(`../src/lib/db?${Math.random()}`)
    expect((await db.getAllBooks()).map((b: Book) => b.id)).toEqual(['b'])
    const watched = await db.getWatchlist()
    expect(watched).toHaveLength(1)
    expect(watched[0]).toMatchObject({ id: 'a', title: '찜한 책', addedAt: 10, watchedAt: 50 })
    const raw = await openDB('gotolib')
    expect((await raw.getAll('tombstones')).map((t: { key: string }) => t.key)).toContain('b:a')
  })
})

describe('다른 탭이 구버전 연결을 쥐고 있을 때', () => {
  test('막힘을 알리고, 그 연결이 닫히면 열기가 이어진다', async () => {
    resetIndexedDB()
    // 구버전 탭: v4를 열고 versionchange에 응답하지 않는다(닫지 않는다).
    const oldTab = await openDB('gotolib', 4, {
      upgrade(d) {
        d.createObjectStore('books', { keyPath: 'id' }).createIndex('by-addedAt', 'addedAt')
        d.createObjectStore('favLibraries', { keyPath: 'libCode' })
        d.createObjectStore('watchlist', { keyPath: 'bookId' })
        d.createObjectStore('apiCache', { keyPath: 'key' })
        d.createObjectStore('tombstones', { keyPath: 'key' })
      },
    })
    const db = await import(`../src/lib/db?${Math.random()}`)
    let blocked = 0
    db.onDbBlocked(() => blocked++)
    let opened = false
    const pending = db.getAllBooks().then(() => {
      opened = true
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(blocked).toBeGreaterThan(0)
    expect(opened).toBe(false)
    oldTab.close()
    await pending
    expect(opened).toBe(true)
  })
})
