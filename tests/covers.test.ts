import { describe, expect, test } from 'bun:test'
import { chunks, isbnsToAsk, isUnreleased, toEntry, type CoverEntry } from '../src/lib/covers'
import { cleanAuthor, toKoreanNovel, yes24ProductUrl } from '../src/lib/koreanNovelsApi'

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

describe('koreanNovelsApi', () => {
  test('YES24 저자 표기 끝의 " 저"만 뗀다', () => {
    expect(cleanAuthor('양귀자 저')).toBe('양귀자')
    expect(cleanAuthor('A, B 저/C 역')).toBe('A, B 저/C 역')
    expect(cleanAuthor(' 저')).toBeUndefined()
    expect(cleanAuthor(undefined)).toBeUndefined()
  })
  test('서버 응답을 탭의 책 모양으로 바꾼다', () => {
    expect(
      toKoreanNovel({
        isbn13: '9791167903952',
        goodsNo: 199832661,
        title: '꼭두, 듣다',
        author: '이주혜 저',
        publisher: '현대문학',
        pubMonth: '2026-11',
      }),
    ).toEqual({
      id: '9791167903952',
      goodsNo: 199832661,
      title: '꼭두, 듣다',
      subtitle: undefined,
      author: '이주혜',
      publisher: '현대문학',
      pubMonth: '2026-11',
    })
  })
  test('YES24 상품 링크', () => {
    expect(yes24ProductUrl(199832661)).toBe('https://www.yes24.com/product/goods/199832661')
  })
})

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
