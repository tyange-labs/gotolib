import { describe, expect, test } from 'bun:test'
import { toBook, toSearchResult, type SearchDoc } from '../src/lib/bookSearch'

// 아래 doc들은 정보나루 srchBooks의 실제 응답에서 가져왔다(2026-10).
const sapiens: SearchDoc = {
  bookname: '사피엔스 :유인원에서 사이보그까지, 인간 역사의 대담하고 위대한 질문 ',
  authors: '지은이: 유발 하라리 ;옮긴이: 조현욱',
  publisher: '김영사',
  publication_year: '2015',
  isbn13: '9788934972464',
  class_no: '909',
  vol: '',
}
const multiVolume: SearchDoc = {
  bookname: '정재승의 인간 탐구 보고서',
  authors: '글: 정재은,특대호 원고: 오경은',
  publisher: '아울북(북이십일 아울북)',
  publication_year: '2019',
  isbn13: '9788950983086',
  class_no: '511',
  vol: '2',
}

describe('toSearchResult', () => {
  test('제목에서 부제와 공백을 떼고, 저자의 역할 표기를 읽기 좋게 바꾼다', () => {
    expect(toSearchResult(sapiens)).toEqual({
      id: '9788934972464',
      title: '사피엔스',
      author: '유발 하라리, 조현욱 옮김',
      publisher: '김영사',
      pubDate: '2015',
      isbn13: '9788934972464',
      kdc: '9',
    })
  })

  test('권차가 있으면 제목 뒤에 붙여 같은 제목의 여러 권을 구분한다', () => {
    expect(toSearchResult(multiVolume)?.title).toBe('정재승의 인간 탐구 보고서 2')
    expect(toSearchResult({ ...multiVolume, vol: '3', isbn13: '9788950983093' })?.title).toBe(
      '정재승의 인간 탐구 보고서 3',
    )
  })

  test('KDC 분류번호의 첫 자리를 주류로 쓴다(알라딘 부가기호에서 뽑은 값과 같은 체계)', () => {
    expect(toSearchResult({ ...sapiens, class_no: '813.6' })?.kdc).toBe('8')
    expect(toSearchResult({ ...sapiens, class_no: '189.2' })?.kdc).toBe('1')
    expect(toSearchResult({ ...sapiens, class_no: '' })?.kdc).toBeUndefined()
    expect(toSearchResult({ ...sapiens, class_no: undefined })?.kdc).toBeUndefined()
  })

  test('ISBN13이 없거나 올바르지 않은 결과는 건너뛴다(id가 ISBN이라 담을 수 없다)', () => {
    expect(toSearchResult({ ...sapiens, isbn13: '' })).toBeNull()
    expect(toSearchResult({ ...sapiens, isbn13: undefined })).toBeNull()
    expect(toSearchResult({ ...sapiens, isbn13: '1234567890123' })).toBeNull()
    expect(toSearchResult({ ...sapiens, isbn13: '978-8934972464' })?.id).toBe('9788934972464')
  })

  test('제목이 비어 있으면 건너뛴다', () => {
    expect(toSearchResult({ ...sapiens, bookname: '  ' })).toBeNull()
    expect(toSearchResult({ ...sapiens, bookname: ':부제만' })).toBeNull()
  })

  test('비어 있는 저자·출판사·연도는 undefined로 둔다', () => {
    const r = toSearchResult({ ...sapiens, authors: ' ', publisher: '', publication_year: undefined })
    expect(r?.author).toBeUndefined()
    expect(r?.publisher).toBeUndefined()
    expect(r?.pubDate).toBeUndefined()
  })
})

describe('toBook', () => {
  test('검색 결과에 담은 시각을 붙인다(서재의 최신순 맨 위로 간다)', () => {
    const result = toSearchResult(sapiens)!
    const book = toBook(result, 1_790_000_000_000)
    expect(book.addedAt).toBe(1_790_000_000_000)
    expect(book.id).toBe(result.id)
    expect(book.updatedAt).toBeUndefined() // 저장할 때 saveBooks가 붙인다
  })
})
