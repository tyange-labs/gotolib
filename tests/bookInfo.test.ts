import { describe, expect, test } from 'bun:test'
import { isUnreleased } from '../src/lib/covers'
import { chunks, isbnsToAsk, type BookInfoEntry } from '../src/lib/bookInfo'

describe('isUnreleased', () => {
  const now = new Date('2026-11-05T00:00:00Z')
  test('미래 날짜면 true', () => {
    expect(isUnreleased('2026-11-06', now)).toBe(true)
  })
  test('과거·오늘·없음·파싱 안 되는 값은 false', () => {
    expect(isUnreleased('2026-11-04', now)).toBe(false)
    expect(isUnreleased(undefined, now)).toBe(false)
    expect(isUnreleased('', now)).toBe(false)
  })
})

describe('bookInfo.isbnsToAsk', () => {
  const ok: BookInfoEntry = { status: 'ok', category: '국내도서 > 소설/시/희곡 > 한국소설' }

  test('출간예정 책은 아예 묻지 않는다', () => {
    expect(isbnsToAsk([{ isbn: 'a', pubDate: '2099-01-01' }], {})).toEqual([])
  })
  test('ok는 다시 묻지 않고, pending·모르는 건 묻는다', () => {
    const known = { a: ok, b: { status: 'pending' } as BookInfoEntry }
    expect(isbnsToAsk([{ isbn: 'a' }, { isbn: 'b' }, { isbn: 'c' }], known)).toEqual(['b', 'c'])
  })
  test('ISBN 없는 항목·중복은 뺀다', () => {
    expect(isbnsToAsk([{ isbn: undefined }, { isbn: 'a' }, { isbn: 'a' }], {})).toEqual(['a'])
  })
  test('과거 pubDate는 그대로 묻는다', () => {
    expect(isbnsToAsk([{ isbn: 'a', pubDate: '2020-01-01' }], {})).toEqual(['a'])
  })
})

describe('bookInfo.chunks', () => {
  test('상한 단위로 나눈다', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
