import { IDBFactory } from 'fake-indexeddb'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'bun:test'
import { openDB } from 'idb'
import { WATCHLIST_LIMIT } from '../src/lib/syncDoc'
import type { Book } from '../src/types/book'

/** 조건이 참이 될 때까지 짧게 반복해서 확인한다(시간 초과면 그대로 돌아가고, 호출한 쪽의 expect가 실패를 알린다). */
async function waitFor(condition: () => boolean, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

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

  test('한도가 차면 더 찜하지 못하고 서재는 그대로다', async () => {
    const ids = Array.from({ length: WATCHLIST_LIMIT + 1 }, (_, i) => `k${i}`)
    await db.saveBooks(ids.map((id) => book(id)))
    for (const id of ids.slice(0, WATCHLIST_LIMIT)) expect(await db.watchBook(book(id))).toBe(true)
    const extra = ids[WATCHLIST_LIMIT]
    expect(await db.watchBook(book(extra))).toBe(false)
    expect((await db.getAllBooks()).map((b: Book) => b.id)).toEqual([extra])
    expect(await db.getWatchlist()).toHaveLength(WATCHLIST_LIMIT)
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
    // 막힘 알림이 올 때까지 기다린다. 고정 시간만 기다리면 느린 CI에서 알림이 오기 전에 검사해 실패한다.
    await waitFor(() => blocked > 0)
    expect(blocked).toBeGreaterThan(0)
    expect(opened).toBe(false)
    oldTab.close()
    await pending
    expect(opened).toBe(true)
  })
})

describe('소장과 읽은 정도', () => {
  let db: Awaited<ReturnType<typeof fresh>>
  beforeEach(async () => {
    db = await fresh()
  })

  test('소장 표시를 켜고 읽은 정도를 저장한다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.setOwned('a', true)
    await db.setProgress('a', 40)
    const [a] = await db.getAllBooks()
    expect(a.owned).toBe(true)
    expect(a.progress).toBe(40)
  })

  test('소장하지 않은 책에는 읽은 정도를 저장하지 않는다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.setProgress('a', 40)
    const [a] = await db.getAllBooks()
    expect(a.progress).toBeUndefined()
  })

  test('읽은 정도는 0~100 정수로 맞추고, 0이면 필드를 지운다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.setOwned('a', true)
    await db.setProgress('a', 250)
    expect((await db.getAllBooks())[0].progress).toBe(100)
    await db.setProgress('a', 33.6)
    expect((await db.getAllBooks())[0].progress).toBe(34)
    await db.setProgress('a', -5)
    expect('progress' in (await db.getAllBooks())[0]).toBe(false)
  })

  test('소장을 해제하면 읽은 정도도 지운다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.setOwned('a', true)
    await db.setProgress('a', 40)
    await db.setOwned('a', false)
    const [a] = await db.getAllBooks()
    expect(a.owned).toBeUndefined()
    expect(a.progress).toBeUndefined()
  })

  test('찜한(빌려보고 싶은) 책을 소장하면 찜에서 서재로 옮겨진다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.watchBook(book('a', 10))
    await db.setOwned('a', true)
    expect(await db.getWatchlist()).toEqual([])
    const books = await db.getAllBooks()
    expect(books.map((b: Book) => [b.id, b.owned, b.addedAt])).toEqual([['a', true, 10]])
    expect('watchedAt' in books[0]).toBe(false)
  })

  test('서재에도 찜에도 없는 책은 소장 표시해도 생기지 않는다', async () => {
    await db.setOwned('nope', true)
    expect(await db.getAllBooks()).toEqual([])
  })

  test('찜에 있는 책의 소장 해제는 아무것도 하지 않는다(찜은 소장하지 않은 책)', async () => {
    await db.saveBooks([book('a', 10)])
    await db.watchBook(book('a', 10))
    await db.setOwned('a', false)
    expect(await db.getAllBooks()).toEqual([])
    expect((await db.getWatchlist()).map((w: Book) => w.id)).toEqual(['a'])
  })

  test('같은 파일을 다시 가져와도 소장·읽은 정도가 지워지지 않는다', async () => {
    await db.saveBooks([book('a', 10)])
    await db.setOwned('a', true)
    await db.setProgress('a', 70)
    await db.saveBooks([book('a', 10)])
    const [a] = await db.getAllBooks()
    expect(a.owned).toBe(true)
    expect(a.progress).toBe(70)
  })
})
