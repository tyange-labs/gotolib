import { describe, expect, test } from 'bun:test'
import {
  SYNC_MAX_BOOKS,
  SYNC_MAX_TOMBSTONES,
  WATCHLIST_LIMIT,
  canonical,
  emptyDoc,
  limitDoc,
  mergeDocs,
  normalizeDoc,
  parseDoc,
  type SyncDoc,
  type WatchEntryValue,
} from '../src/lib/syncDoc'
import type { Book } from '../src/types/book'

const book = (id: string, title = id): Book => ({ id, title, addedAt: 1 })
const doc = (patch: Partial<SyncDoc>): SyncDoc => ({ ...emptyDoc(), ...patch })
const live = <T>(at: number, value: T) => ({ at, value })
const watched = (id: string, at = 1): WatchEntryValue => ({ ...book(id), watchedAt: at })
const gone = (at: number) => ({ at, deleted: true as const })

describe('mergeDocs', () => {
  test('합집합: 양쪽에만 있는 항목이 모두 남는다', () => {
    const a = doc({ books: { x: live(1, book('x')) } })
    const b = doc({ books: { y: live(1, book('y')) } })
    expect(Object.keys(mergeDocs(a, b).books).sort()).toEqual(['x', 'y'])
  })

  test('같은 항목은 더 늦게 바뀐 쪽이 이긴다', () => {
    const a = doc({ books: { x: live(5, book('x', 'old')) } })
    const b = doc({ books: { x: live(9, book('x', 'new')) } })
    expect(mergeDocs(a, b).books.x.value?.title).toBe('new')
    expect(mergeDocs(b, a).books.x.value?.title).toBe('new')
  })

  test('나중에 한 삭제는 먼저 있던 항목을 이기고, 되살린 건 삭제를 이긴다', () => {
    const present = doc({ books: { x: live(5, book('x')) } })
    const removed = doc({ books: { x: gone(9) } })
    expect(mergeDocs(present, removed).books.x.deleted).toBe(true)

    const restored = doc({ books: { x: live(12, book('x')) } })
    expect(mergeDocs(removed, restored).books.x.deleted).toBeUndefined()
  })

  test('시각이 같으면 삭제가 이긴다(순서와 무관)', () => {
    const a = doc({ watchlist: { w: live(7, watched('w', 7)) } })
    const b = doc({ watchlist: { w: gone(7) } })
    expect(mergeDocs(a, b).watchlist.w.deleted).toBe(true)
    expect(mergeDocs(b, a).watchlist.w.deleted).toBe(true)
  })

  test('교환·결합·멱등: 어떤 순서로 합쳐도 결과가 같다', () => {
    const a = doc({
      books: { x: live(3, book('x', 'a')), y: gone(4) },
      watchlist: { w: live(2, watched('w', 2)) },
    })
    const b = doc({
      books: { x: live(3, book('x', 'b')), y: live(2, book('y')) },
      watchlist: { w: gone(5) },
    })
    const c = doc({ books: { z: live(1, book('z')) } })

    const ab = mergeDocs(a, b)
    expect(canonical(ab)).toBe(canonical(mergeDocs(b, a)))
    expect(canonical(mergeDocs(ab, c))).toBe(canonical(mergeDocs(a, mergeDocs(b, c))))
    expect(canonical(mergeDocs(ab, ab))).toBe(canonical(ab))
  })

  test('시각이 같고 값이 다른 동률도 양쪽에서 같은 쪽을 고른다', () => {
    const a = doc({ books: { x: live(3, book('x', 'a')) } })
    const b = doc({ books: { x: live(3, book('x', 'b')) } })
    expect(canonical(mergeDocs(a, b))).toBe(canonical(mergeDocs(b, a)))
  })
})

describe('normalizeDoc', () => {
  const watch = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        `b${i}`,
        live(100 + i, watched(`b${i}`, 100 + i)),
      ]),
    )

  test('한도 이하면 그대로 둔다', () => {
    const d = doc({ watchlist: watch(WATCHLIST_LIMIT) })
    expect(normalizeDoc(d)).toBe(d)
  })

  test('한도를 넘으면 가장 오래된 것부터 찜을 풀어 서재로 돌려보낸다(책을 잃지 않는다)', () => {
    const out = normalizeDoc(doc({ watchlist: watch(WATCHLIST_LIMIT + 2) }))
    expect(out.books.b0?.value?.title).toBe('b0')
    expect(out.books.b0?.deleted).toBeUndefined()
    expect(out.books.b0).not.toHaveProperty('value.watchedAt')
    expect(out.books.b2).toBeUndefined()
    const liveKeys = Object.entries(out.watchlist)
      .filter(([, e]) => !e.deleted)
      .map(([k]) => k)
      .sort()
    // 가장 최근에 찜한 WATCHLIST_LIMIT개(b2부터)가 남는다.
    expect(liveKeys).toEqual(
      Array.from({ length: WATCHLIST_LIMIT }, (_, i) => `b${i + 2}`).sort(),
    )
    expect(out.watchlist.b0).toEqual({ at: 101, deleted: true })
    expect(out.watchlist.b1).toEqual({ at: 102, deleted: true })
  })

  test('두 기기가 각자 정규화해도 같은 결과로 수렴한다', () => {
    const a = doc({ watchlist: watch(WATCHLIST_LIMIT + 3) })
    const b = doc({ watchlist: watch(WATCHLIST_LIMIT + 1) })
    const one = normalizeDoc(mergeDocs(a, b))
    const two = normalizeDoc(mergeDocs(normalizeDoc(b), normalizeDoc(a)))
    expect(canonical(one)).toBe(canonical(two))
  })

  test('정규화로 지워진 항목을 나중에 다시 찜하면 되살아난다', () => {
    const trimmed = normalizeDoc(doc({ watchlist: watch(WATCHLIST_LIMIT + 1) }))
    const again = doc({ watchlist: { b0: live(500, watched('b0', 500)) } })
    expect(mergeDocs(trimmed, again).watchlist.b0.deleted).toBeUndefined()
  })
})

describe('한 책은 서재와 찜 중 한 곳에만', () => {
  test('둘 다 살아 있으면 더 늦게 바뀐 쪽이 이긴다', () => {
    const watchWins = normalizeDoc(
      doc({ books: { x: live(5, book('x')) }, watchlist: { x: live(9, watched('x', 9)) } }),
    )
    expect(watchWins.books.x.deleted).toBe(true)
    expect(watchWins.watchlist.x.deleted).toBeUndefined()

    const shelfWins = normalizeDoc(
      doc({ books: { x: live(12, book('x')) }, watchlist: { x: live(9, watched('x', 9)) } }),
    )
    expect(shelfWins.books.x.deleted).toBeUndefined()
    expect(shelfWins.watchlist.x.deleted).toBe(true)
  })

  test('같은 시각이면 찜이 이긴다', () => {
    const out = normalizeDoc(
      doc({ books: { x: live(9, book('x')) }, watchlist: { x: live(9, watched('x', 9)) } }),
    )
    expect(out.watchlist.x.deleted).toBeUndefined()
    expect(out.books.x.deleted).toBe(true)
  })

  test('기기마다 따로 정규화해도 같은 결과로 수렴한다', () => {
    const a = doc({ books: { x: live(5, book('x')) } })
    const b = doc({ watchlist: { x: live(9, watched('x', 9)) } })
    expect(canonical(normalizeDoc(mergeDocs(a, b)))).toBe(
      canonical(normalizeDoc(mergeDocs(b, a))),
    )
  })

  test('옮긴 직후(서재 삭제 표시 + 찜 항목)는 그대로 둔다', () => {
    const d = doc({ books: { x: gone(9) }, watchlist: { x: live(9, watched('x', 9)) } })
    expect(normalizeDoc(d)).toBe(d)
  })

  test('찜을 풀어 서재로 돌아간 책은 옛 찜 항목을 이긴다', () => {
    const before = doc({ books: { x: gone(9) }, watchlist: { x: live(9, watched('x', 9)) } })
    const after = doc({ books: { x: live(15, book('x')) }, watchlist: { x: gone(15) } })
    const out = normalizeDoc(mergeDocs(before, after))
    expect(out.books.x.deleted).toBeUndefined()
    expect(out.watchlist.x.deleted).toBe(true)
  })
})

describe('버전 1 문서 이전', () => {
  test('찜 참조를 찜 항목으로 옮기고 서재에서는 뺀다', () => {
    const v1 = {
      v: 1,
      books: { x: live(3, book('x', '찜한 책')), y: live(4, book('y')) },
      watchlist: { x: live(8, { bookId: 'x', addedAt: 8 }) },
      favLibraries: {},
    }
    const out = parseDoc(v1)
    expect(out.v).toBe(2)
    expect(out.watchlist.x.value?.title).toBe('찜한 책')
    expect(out.watchlist.x.value?.watchedAt).toBe(8)
    expect(out.books.x.deleted).toBe(true)
    expect(out.books.y.value?.title).toBe('y')
  })

  test('서재에 없는 책(샘플)을 찜한 항목과 삭제된 찜은 버린다', () => {
    const out = parseDoc({
      v: 1,
      books: {},
      watchlist: {
        ghost: live(5, { bookId: 'ghost', addedAt: 5 }),
        old: gone(6),
      },
      favLibraries: {},
    })
    expect(out.watchlist.ghost).toEqual({ at: 5, deleted: true })
    expect(out.watchlist.old).toEqual({ at: 6, deleted: true })
  })

  test('옮긴 결과는 어떤 기기에서 읽어도 같고, 이미 옮긴 문서와 합쳐도 같다', () => {
    const v1 = {
      v: 1,
      books: { x: live(3, book('x')) },
      watchlist: { x: live(8, { bookId: 'x', addedAt: 8 }) },
      favLibraries: {},
    }
    const once = parseDoc(v1)
    expect(canonical(parseDoc(JSON.parse(JSON.stringify(v1))))).toBe(canonical(once))
    expect(canonical(mergeDocs(once, once))).toBe(canonical(once))
  })
})

describe('parseDoc', () => {
  test('모르는 모양이나 다른 버전은 빈 문서가 된다', () => {
    expect(parseDoc(null)).toEqual(emptyDoc())
    expect(parseDoc('x')).toEqual(emptyDoc())
    expect(parseDoc({ v: 99, books: { x: live(1, book('x')) } })).toEqual(emptyDoc())
  })

  test('맞는 문서는 그대로 읽는다', () => {
    const d = doc({ books: { x: live(1, book('x')) } })
    expect(parseDoc(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })
})

describe('limitDoc', () => {
  const manyBooks = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => {
        // i가 클수록 최근에 담은 책. at(수정 시각)은 전부 같게 해서 담은 순서(addedAt)만 단서가 되게 한다.
        const id = `k${String(i).padStart(5, '0')}`
        return [id, live(5, { ...book(id), addedAt: 1000 + i })]
      }),
    )

  test('한도 이하면 문서를 그대로 돌려준다', () => {
    const d = doc({ books: manyBooks(SYNC_MAX_BOOKS) })
    const out = limitDoc(d)
    expect(out.doc).toBe(d)
    expect(out.omittedBooks).toBe(0)
  })

  test('한도를 넘으면 가장 최근에 담은 책만 남기고 몇 권 빠졌는지 알려준다', () => {
    const out = limitDoc(doc({ books: manyBooks(SYNC_MAX_BOOKS + 120) }))
    expect(Object.keys(out.doc.books)).toHaveLength(SYNC_MAX_BOOKS)
    expect(out.omittedBooks).toBe(120)
    // 가장 오래된 120권(k00000~k00119)이 빠지고 가장 최근 책은 남는다.
    expect(out.doc.books.k00000).toBeUndefined()
    expect(out.doc.books.k00119).toBeUndefined()
    expect(out.doc.books.k00120).toBeDefined()
    expect(out.doc.books[`k${String(SYNC_MAX_BOOKS + 119).padStart(5, '0')}`]).toBeDefined()
  })

  test('올리지 않은 책은 지운 게 아니다: 삭제 표시를 만들지 않고, 로컬과 합쳐도 그대로 남는다', () => {
    const local = doc({ books: manyBooks(SYNC_MAX_BOOKS + 50) })
    const pushed = limitDoc(local).doc
    expect(Object.values(pushed.books).some((e) => e.deleted)).toBe(false)
    // 서버에 올라간 문서를 다시 받아 합쳐도 이 기기의 책은 그대로다.
    const merged = mergeDocs(local, pushed)
    expect(Object.keys(merged.books)).toHaveLength(SYNC_MAX_BOOKS + 50)
    // 그리고 다시 줄이면 같은 문서가 나온다(안정적이라 매번 다시 올리지 않는다).
    expect(canonical(limitDoc(merged).doc)).toBe(canonical(pushed))
  })

  test('삭제 표시는 가장 최근 것부터 상한까지만 남긴다', () => {
    const tombs = Object.fromEntries(
      Array.from({ length: SYNC_MAX_TOMBSTONES + 30 }, (_, i) => [`t${i}`, gone(100 + i)]),
    )
    const out = limitDoc(doc({ books: tombs })).doc
    const keys = Object.keys(out.books)
    expect(keys).toHaveLength(SYNC_MAX_TOMBSTONES)
    expect(out.books.t0).toBeUndefined() // 가장 오래된 삭제 표시가 빠진다
    expect(out.books[`t${SYNC_MAX_TOMBSTONES + 29}`]).toBeDefined()
  })

  test('찜·자주 가는 도서관은 책 상한의 영향을 받지 않는다', () => {
    const d = doc({
      books: manyBooks(SYNC_MAX_BOOKS + 10),
      watchlist: { w: live(9, watched('w', 9)) },
    })
    expect(limitDoc(d).doc.watchlist.w).toBeDefined()
  })
})
