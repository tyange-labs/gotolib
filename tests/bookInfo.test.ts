import { describe, expect, test } from 'bun:test'
import { isUnreleased } from '../src/lib/covers'
import { chunks, isPending, isSettled, isbnsToAsk, type BookInfoEntry } from '../src/lib/bookInfo'

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
  const settled: BookInfoEntry = { status: 'ok', yes24Form: '장편' }
  const okWithoutForm: BookInfoEntry = { status: 'ok', category: '국내도서 > 소설/시/희곡 > 한국소설', pages: 240 }

  const isbns = (asks: { isbn: string }[]) => asks.map((a) => a.isbn)

  test('출간 전 책도 묻되, 수집 큐에 넣지 않게 표시한다', () => {
    // 실제 사례: 잠수교에 누가 있다 — 출간 전이라 묻지도 않았는데 서버엔 YES24 "장편"이 있었다.
    expect(isbnsToAsk([{ isbn: 'a', pubDate: '2099-01-01' }, { isbn: 'b', pubDate: '2020-01-01' }], {})).toEqual([
      { isbn: 'a', unreleased: true },
      { isbn: 'b', unreleased: false },
    ])
  })
  test('YES24 분류가 온 답은 다시 묻지 않고, pending·모르는 것·YES24 분류 없는 ok는 다시 묻는다', () => {
    // 실제 사례: 거미는 토요일 새벽 — 처음엔 예전 알라딘 값(분류·240쪽)만 있다가 나중에 YES24 "장편"이 들어왔다.
    const known = { a: settled, b: { status: 'pending' } as BookInfoEntry, d: okWithoutForm }
    expect(isbns(isbnsToAsk([{ isbn: 'a' }, { isbn: 'b' }, { isbn: 'c' }, { isbn: 'd' }], known))).toEqual(['b', 'c', 'd'])
  })
  test('짧은 재시도용으로는 pending·모르는 것만 고를 수 있다', () => {
    const known = { a: settled, b: { status: 'pending' } as BookInfoEntry, d: okWithoutForm }
    expect(isbns(isbnsToAsk([{ isbn: 'a' }, { isbn: 'b' }, { isbn: 'c' }, { isbn: 'd' }], known, isPending))).toEqual([
      'b',
      'c',
    ])
  })
  test('YES24 분류가 있어야 확정이다(알라딘 형식어만으로는 아니다)', () => {
    expect(isSettled({ status: 'pending', yes24Form: '장편' })).toBe(true)
    expect(isSettled({ status: 'ok', formHint: '장편소설' })).toBe(false)
    expect(isSettled(okWithoutForm)).toBe(false)
    expect(isSettled(undefined)).toBe(false)
  })
  test('ISBN 없는 항목·중복은 뺀다', () => {
    expect(isbns(isbnsToAsk([{ isbn: undefined }, { isbn: 'a' }, { isbn: 'a' }], {}))).toEqual(['a'])
  })
})

describe('bookInfo.chunks', () => {
  test('상한 단위로 나눈다', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
