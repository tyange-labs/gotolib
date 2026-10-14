import { describe, expect, test } from 'bun:test'
import { authorsOf, isbn10to13, pageCountOf, toBook, toSearchResults, type SeojiDoc } from '../src/lib/bookSearch'
import risky from './fixtures/seoji-risky.json'
import conifer from './fixtures/seoji-conifer.json'
import byAuthor from './fixtures/seoji-author.json'

// 실제 국립중앙도서관 서지정보 API 응답(키 없음)을 그대로 쓴다.
const docsOf = (fixture: { docs: unknown[] }) => fixture.docs as SeojiDoc[]

describe('authorsOf', () => {
  test('역할 접두를 벗긴다', () => {
    expect(authorsOf('지은이: 엄원태')).toBe('엄원태')
    expect(authorsOf('저자 : 아포리아에듀')).toBe('아포리아에듀')
    expect(authorsOf('집필인: 임종환,김은숙')).toBe('임종환, 김은숙')
  })
  test('뒤에 붙은 지음·저·공저를 뗀다', () => {
    expect(authorsOf('김현경 지음')).toBe('김현경')
    expect(authorsOf('김경욱 저')).toBe('김경욱')
    expect(authorsOf('김선희,김경욱,오지현,김영원 공저')).toBe('김선희,김경욱,오지현,김영원')
  })
  test('옮긴이·그린이를 구분한다', () => {
    expect(authorsOf('지은이: 유발 하라리 ;옮긴이: 조현욱')).toBe('유발 하라리, 조현욱 옮김')
    expect(authorsOf('지은이: 가 ;그린이: 나')).toBe('가, 나 그림')
  })
  test('비었으면 undefined', () => {
    expect(authorsOf('')).toBeUndefined()
    expect(authorsOf(undefined)).toBeUndefined()
  })
})

describe('toSearchResults', () => {
  test('통합 검색에 없던 2026년 2판(종이책)이 나오고, 전자책판은 빠진다', () => {
    const results = toSearchResults(docsOf(risky))
    const isbns = results
      .filter((r) => r.author === '김경욱' && r.title === '위험한 독서')
      .map((r) => r.isbn13)
    expect(isbns).toEqual(['9788954606752', '9791141603779']) // 2008, 2026 2판
    expect(results.map((r) => r.isbn13)).not.toContain('9791141691240') // 전자책 개정판
    expect(results.map((r) => r.isbn13)).not.toContain('9788954627870') // 전자책 2011
  })

  test('모든 결과가 13자리 ISBN을 id로 갖는다', () => {
    for (const r of toSearchResults(docsOf(risky))) {
      expect(r.id).toBe(r.isbn13!)
      expect(r.isbn13).toMatch(/^97[89]\d{10}$/)
    }
  })

  test('발행연도는 4자리, 실제 출간일이 예정일보다 우선', () => {
    const r = toSearchResults(docsOf(risky)).find((x) => x.isbn13 === '9791141603779')!
    expect(r.pubDate).toBe('2026')
    expect(r.edition).toBe('2판')
    const withReal = toSearchResults([
      { TITLE: 'a', EA_ISBN: '9788954606752', PUBLISH_PREDATE: '20250101', REAL_PUBLISH_DATE: '20260301' },
    ])
    expect(withReal[0].pubDate).toBe('2026')
  })

  test('전자책·ISBN 없는 레코드·제목 없는 레코드는 뺀다', () => {
    const results = toSearchResults([
      { TITLE: '전자', EA_ISBN: '9788954606752', EBOOK_YN: 'Y' },
      { TITLE: '번호없음' },
      { EA_ISBN: '9788954627870' },
      { TITLE: '종이', EA_ISBN: '9788954627870', EBOOK_YN: 'N' },
    ])
    expect(results.map((r) => r.title)).toEqual(['종이'])
  })

  test('같은 ISBN은 하나로, 받은 순서 유지', () => {
    const results = toSearchResults([
      { TITLE: 'B', EA_ISBN: '9788954627870' },
      { TITLE: 'A', EA_ISBN: '9788954606752' },
      { TITLE: 'B again', EA_ISBN: '9788954627870' },
    ])
    expect(results.map((r) => r.title)).toEqual(['B', 'A'])
  })

  test('침엽수림에서: 저자·출판사가 정리된다', () => {
    const r = toSearchResults(docsOf(conifer)).find((x) => x.isbn13 === '9788954697866')!
    expect(r.title).toBe('침엽수림에서')
    expect(r.author).toBe('엄원태')
    expect(r.publisher).toBeTruthy()
  })

  test('저자 검색 결과도 같은 모양으로 읽힌다', () => {
    const results = toSearchResults(docsOf(byAuthor))
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) expect(r.author).not.toMatch(/^(지은이|저자)\s*:/)
  })
})

describe('ISBN-10 레코드', () => {
  test('isbn10to13: 알려진 책의 13자리가 나온다', () => {
    expect(isbn10to13('8932014582')).toBe('9788932014586') // 따뜻한 흙
    expect(isbn10to13('8960210188')).toBe('9788960210189') // 위험한 독서(박현수)
    expect(isbn10to13('012345')).toBeUndefined()
  })

  test('2007년 이전 책(10자리만 있는 레코드)도 검색 결과에 나온다', () => {
    // 실제 응답: 따뜻한 흙(조은, 2003)은 EA_ISBN이 10자리뿐이다.
    const [result] = toSearchResults([
      {
        TITLE: '따뜻한 흙',
        AUTHOR: '조은 저',
        PUBLISHER: '(주)문학과 지성사',
        EA_ISBN: '8932014582',
        PUBLISH_PREDATE: '20031117',
        EBOOK_YN: 'N',
      },
    ])
    expect(result).toMatchObject({
      id: '9788932014586',
      isbn13: '9788932014586',
      title: '따뜻한 흙',
      author: '조은',
      pubDate: '2003',
    })
  })

  test('같은 책의 10자리·13자리 레코드는 하나로 합친다', () => {
    const results = toSearchResults([
      { TITLE: 'a', EA_ISBN: '8932014582' },
      { TITLE: 'a', EA_ISBN: '9788932014586' },
    ])
    expect(results).toHaveLength(1)
  })
})

describe('toBook', () => {
  test('판 표시는 서재에 저장하지 않고 담은 시각을 붙인다', () => {
    const [result] = toSearchResults([{ TITLE: 'a', EA_ISBN: '9788954606752', EDITION_STMT: '개정판' }])
    const book = toBook(result, 123)
    expect(book.addedAt).toBe(123)
    expect('edition' in book).toBe(false)
    expect(book.id).toBe('9788954606752')
  })
})

describe('pageCountOf', () => {
  test('표기가 제각각이어도 쪽수를 뽑는다', () => {
    expect(pageCountOf('564 p.')).toBe(564)
    expect(pageCountOf('564')).toBe(564)
    expect(pageCountOf('xii, 564 p.')).toBe(564)
  })

  test('숫자가 없거나 0이면 없는 것', () => {
    expect(pageCountOf(undefined)).toBeUndefined()
    expect(pageCountOf('')).toBeUndefined()
    expect(pageCountOf('p.')).toBeUndefined()
    expect(pageCountOf('0 p.')).toBeUndefined()
  })
})
