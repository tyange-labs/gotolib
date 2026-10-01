import { describe, expect, test } from 'bun:test'
import {
  WATCHLIST_LIMIT,
  canonical,
  emptyDoc,
  mergeDocs,
  normalizeDoc,
  parseDoc,
  type SyncDoc,
} from '../src/lib/syncDoc'
import type { Book } from '../src/types/book'

const book = (id: string, title = id): Book => ({ id, title, addedAt: 1 })
const doc = (patch: Partial<SyncDoc>): SyncDoc => ({ ...emptyDoc(), ...patch })
const live = <T>(at: number, value: T) => ({ at, value })
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
    const a = doc({ watchlist: { w: live(7, { bookId: 'w', addedAt: 7 }) } })
    const b = doc({ watchlist: { w: gone(7) } })
    expect(mergeDocs(a, b).watchlist.w.deleted).toBe(true)
    expect(mergeDocs(b, a).watchlist.w.deleted).toBe(true)
  })

  test('교환·결합·멱등: 어떤 순서로 합쳐도 결과가 같다', () => {
    const a = doc({
      books: { x: live(3, book('x', 'a')), y: gone(4) },
      watchlist: { w: live(2, { bookId: 'w', addedAt: 2 }) },
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
        live(100 + i, { bookId: `b${i}`, addedAt: 100 + i }),
      ]),
    )

  test('한도 이하면 그대로 둔다', () => {
    const d = doc({ watchlist: watch(WATCHLIST_LIMIT) })
    expect(normalizeDoc(d)).toBe(d)
  })

  test('한도를 넘으면 가장 오래된 것부터 삭제 표시로 바꾼다', () => {
    const out = normalizeDoc(doc({ watchlist: watch(WATCHLIST_LIMIT + 2) }))
    const liveKeys = Object.entries(out.watchlist)
      .filter(([, e]) => !e.deleted)
      .map(([k]) => k)
      .sort()
    expect(liveKeys).toEqual(['b2', 'b3', 'b4', 'b5', 'b6'])
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
    const again = doc({ watchlist: { b0: live(500, { bookId: 'b0', addedAt: 500 }) } })
    expect(mergeDocs(trimmed, again).watchlist.b0.deleted).toBeUndefined()
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
