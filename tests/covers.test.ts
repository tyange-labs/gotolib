import { describe, expect, test } from 'bun:test'
import { chunks, isbnsToAsk, toEntry, type CoverEntry } from '../src/lib/covers'

const ok: CoverEntry = { status: 'ok', url: '/x.jpg' }

describe('isbnsToAsk', () => {
  test('중복·빈 값·ISBN 없는 책은 뺀다', () => {
    expect(isbnsToAsk(['a', 'a', undefined, '', 'b'], {})).toEqual(['a', 'b'])
  })
  test('ok와 missing은 다시 묻지 않고, pending은 다시 묻는다', () => {
    const known = { a: ok, b: { status: 'missing' } as CoverEntry, c: { status: 'pending' } as CoverEntry }
    expect(isbnsToAsk(['a', 'b', 'c', 'd'], known)).toEqual(['c', 'd'])
  })
  test('모두 결론이 났으면 비어 있다', () => {
    expect(isbnsToAsk(['a'], { a: ok })).toEqual([])
  })
})

describe('chunks', () => {
  test('상한 단위로 나눈다', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunks([], 3)).toEqual([])
  })
})

describe('toEntry', () => {
  test('ok는 앱에서 부르는 주소(/api/cms 접두)로 바꾼다', () => {
    expect(toEntry({ status: 'ok', url: '/gotolib/cover-images/1.jpg' })).toEqual({
      status: 'ok',
      url: '/api/cms/gotolib/cover-images/1.jpg',
    })
  })
  test('url 없는 ok·모르는 상태·응답에 없는 ISBN은 pending', () => {
    expect(toEntry({ status: 'ok' })).toEqual({ status: 'pending' })
    expect(toEntry({ status: 'weird' })).toEqual({ status: 'pending' })
    expect(toEntry(undefined)).toEqual({ status: 'pending' })
  })
  test('missing은 missing', () => {
    expect(toEntry({ status: 'missing' })).toEqual({ status: 'missing' })
  })
})
