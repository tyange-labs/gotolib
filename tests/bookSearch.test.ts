import { describe, expect, test } from 'bun:test'
import {
  isbn10to13,
  isbn13Of,
  toBook,
  toSearchResults,
  type NlDoc,
} from '../src/lib/bookSearch'
import conifer from './fixtures/nl-conifer.json'
import places from './fixtures/nl-places.json'
import risky from './fixtures/nl-risky.json'
import tight from './fixtures/nl-tight.json'

// fixtures는 국립중앙도서관 Open API 실제 응답(2026-10, category=도서)에서 가져왔다.
const docs = (fixture: { result: unknown[] }) => fixture.result as NlDoc[]

describe('isbn', () => {
  test('ISBN-10을 ISBN-13으로 바꾼다(검증된 쌍)', () => {
    expect(isbn10to13('8960210188')).toBe('9788960210189') // 박현수 시집
    expect(isbn10to13('898557728X')).toBe('9788985577281') // 권여선, 끝이 X인 ISBN-10
    expect(isbn10to13('012345')).toBeUndefined()
  })

  test('ISBN-13이 있으면 그대로, 없으면 ISBN-10을 변환, 둘 다 없으면 undefined', () => {
    expect(isbn13Of('9788954697866')).toBe('9788954697866')
    expect(isbn13Of('8960210188')).toBe('9788960210189')
    expect(isbn13Of('9788954697866 8954697860')).toBe('9788954697866')
    expect(isbn13Of('')).toBeUndefined()
    expect(isbn13Of(undefined)).toBeUndefined()
    expect(isbn13Of('1234567890123')).toBeUndefined() // 978/979로 시작하지 않는 13자리
  })
})

describe('toSearchResults: 실제 응답', () => {
  test('같은 ISBN의 여러 레코드를 하나로 합치고, 깔끔한 레코드를 쓴다(위험한 독서)', () => {
    const results = toSearchResults(docs(risky))
    const kim = results.filter((r) => r.isbn13 === '9788954606752')
    expect(kim).toHaveLength(1) // 김경욱 소설: 응답에는 2건
    expect(kim[0]).toMatchObject({
      title: '위험한 독서',
      author: '김경욱',
      publisher: '문학동네', // '파주 : 문학동네, 2008'이 아니라 깔끔한 레코드의 값
      pubDate: '2008',
      kdc: '8',
    })

    const park = results.filter((r) => r.isbn13 === '9788960210189')
    expect(park).toHaveLength(1) // 박현수 시집: 응답에는 4건, ISBN-10을 13으로 변환
    expect(park[0]).toMatchObject({ title: '위험한 독서', author: '박현수', publisher: '천년의시작' })

    // 판본이 다른 같은 제목은 발행연도로 구분된다(서로 다른 책)
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length)
  })

  test('제목의 강조 태그·부제를 떼고, 저자 표기를 정리한다(침엽수림에서)', () => {
    const [first] = toSearchResults(docs(conifer))
    expect(first).toMatchObject({
      id: '9788954697866',
      title: '침엽수림에서',
      author: '엄원태', // '지은이: 엄원태'
      publisher: '문학동네',
      pubDate: '2023',
      kdc: '8',
    })
    expect(first.title).not.toMatch(/[<>]/)
  })

  test('ISBN이 없는 오래된 책도 담을 수 있게 남기고, 같은 책은 하나로 합친다', () => {
    const old = toSearchResults(docs(conifer)).filter((r) => r.pubDate === '1991')
    expect(old).toHaveLength(1) // 엄원태 詩集(1991): 응답에는 2건(저자 표기가 다름)
    expect(old[0].isbn13).toBeUndefined()
    expect(old[0].id.startsWith('local-')).toBe(true)
    expect(old[0].title).toBe('(엄원태 詩集)침엽수림에서')
  })

  test('판본이 여러 개인 책은 각각의 발행연도로 남는다(푸르른 틈새 2007·2024)', () => {
    const results = toSearchResults(docs(tight))
    const years = results.filter((r) => r.title === '푸르른 틈새').map((r) => r.pubDate)
    expect(years.sort()).toEqual(['2007', '2024'])
  })

  test('사람, 장소, 환대: 판본 3개가 서로 다른 ISBN으로 구분된다', () => {
    const results = toSearchResults(docs(places))
    expect(results.map((r) => r.pubDate).sort()).toEqual(['2015', '2025', '2026'])
    expect(results.every((r) => r.author === '김현경 지음' || r.author === '김현경')).toBe(true)
  })
})

describe('toSearchResults: 표기 정리', () => {
  const base: NlDoc = { titleInfo: '제목', isbn: '9788954697866', mediaName: '인쇄자료(책자형)' }

  test('저자: 생몰년·역할 접두·중복 이름', () => {
    const author = (authorInfo: string) => toSearchResults([{ ...base, authorInfo }])[0].author
    expect(author('김경욱[1971-]')).toBe('김경욱')
    expect(author('지은이: 유발 하라리 ;옮긴이: 조현욱')).toBe('유발 하라리, 조현욱 옮김')
    expect(author('권여선 권여선[1965-]')).toBe('권여선')
    expect(author('슈테판 볼만 지음;조이한,김정근 옮김')).toBe('슈테판 볼만 지음, 조이한,김정근 옮김')
    expect(author('')).toBeUndefined()
  })

  test('출판사: 발행지 꼴만 벗기고 발행처 이름의 콜론은 둔다', () => {
    const publisher = (pubInfo: string) => toSearchResults([{ ...base, pubInfo }])[0].publisher
    expect(publisher('파주 : 문학동네, 2008')).toBe('문학동네')
    expect(publisher('서울 : 천년의시작, 20070410 (')).toBe('천년의시작')
    expect(publisher('웅진지식하우스 : 웅진씽크빅')).toBe('웅진지식하우스 : 웅진씽크빅')
    expect(publisher('문학동네')).toBe('문학동네')
  })

  test('발행연도는 앞 4자리, 제목의 HTML 엔티티는 되돌린다', () => {
    expect(toSearchResults([{ ...base, pubYearInfo: '20070410' }])[0].pubDate).toBe('2007')
    expect(toSearchResults([{ ...base, pubYearInfo: '' }])[0].pubDate).toBeUndefined()
    expect(
      toSearchResults([{ ...base, titleInfo: '<span class="searching_txt">A &amp; B</span> : 부제' }])[0].title,
    ).toBe('A & B')
  })

  test('제목이 없으면 건너뛰고, 처음 나온 순서를 지킨다', () => {
    const out = toSearchResults([
      { ...base, titleInfo: '', isbn: '9788954697866' },
      { ...base, titleInfo: '둘째', isbn: '9788932027265' },
      { ...base, titleInfo: '첫째', isbn: '9788934956051' },
    ])
    expect(out.map((r) => r.title)).toEqual(['둘째', '첫째'])
  })
})

describe('toBook', () => {
  test('검색 결과에 담은 시각을 붙인다(서재의 최신순 맨 위로 간다)', () => {
    const result = toSearchResults(docs(conifer))[0]
    const book = toBook(result, 1_790_000_000_000)
    expect(book.addedAt).toBe(1_790_000_000_000)
    expect(book.id).toBe(result.id)
    expect(book.updatedAt).toBeUndefined() // 저장할 때 saveBooks가 붙인다
  })
})
