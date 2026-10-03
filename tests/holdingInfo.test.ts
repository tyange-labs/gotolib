import { describe, expect, test } from 'bun:test'
import { callSignOf, toHoldingInfo, type ItemDoc } from '../src/lib/holdingInfo'
import hit from './fixtures/itemsrch-hit.json'
import miss from './fixtures/itemsrch-miss.json'

// 실제 정보나루 itemSrch 응답(키 없음): 가락몰도서관은 소장, 고덕평생학습관은 이 기간에 조회되지 않음.
const firstDoc = (fixture: { response: { docs?: Array<{ doc: ItemDoc }> } | object }) =>
  (fixture.response as { docs?: Array<{ doc: ItemDoc }> }).docs?.[0]?.doc

describe('toHoldingInfo', () => {
  test('분류번호·도서기호·자료실을 읽고 별치기호 자리표시는 뺀다', () => {
    const info = toHoldingInfo(firstDoc(hit))!
    expect(info.classNo).toBe('813.7')
    expect(info.className).toBe('문학 > 한국문학 > 소설')
    expect(info.copies).toHaveLength(1)
    expect(info.copies[0]).toMatchObject({ bookCode: '김14ㅇ', location: '가락몰 일반자료실' })
    expect(info.copies[0].shelfMark).toBeUndefined() // '적용안함'
  })

  test('조회되지 않은 책은 null', () => {
    expect(toHoldingInfo(firstDoc(miss))).toBeNull()
    expect(toHoldingInfo(undefined)).toBeNull()
  })

  test('분류가 비면 구분자만 남은 이름을 버린다', () => {
    const info = toHoldingInfo({
      class_no: '',
      class_nm: ' >  > ',
      callNumbers: [{ callNumber: { book_code: '가1', shelf_loc_name: '어린이실' } }],
    })!
    expect(info.classNo).toBeUndefined()
    expect(info.className).toBeUndefined()
    expect(info.copies[0].location).toBe('어린이실')
  })

  test('분류도 도서기호도 자료실도 없으면 null', () => {
    expect(toHoldingInfo({ class_no: '', callNumbers: [{ callNumber: {} }] })).toBeNull()
  })

  test('복본이 여러 개면 모두 읽는다', () => {
    const info = toHoldingInfo({
      class_no: '813.6',
      callNumbers: [
        { callNumber: { book_code: '이1', copy_code: '1', shelf_loc_name: 'A실' } },
        { callNumber: { book_code: '이1', copy_code: '2', shelf_loc_name: 'B실' } },
      ],
    })!
    expect(info.copies.map((c) => c.location)).toEqual(['A실', 'B실'])
  })
})

describe('callSignOf', () => {
  test('분류번호 + 도서기호', () => {
    const info = toHoldingInfo(firstDoc(hit))!
    expect(callSignOf(info.classNo, info.copies[0])).toBe('813.7 김14ㅇ')
  })
  test('별치기호·권차·복본을 순서대로 붙인다', () => {
    expect(
      callSignOf('813.6', { shelfMark: '신착일반', bookCode: '이15ㅇ', volume: '2', copy: '3' }),
    ).toBe('신착일반 813.6 이15ㅇ v.2 c.3')
  })
  test('분류번호가 없어도 있는 것만 붙인다', () => {
    expect(callSignOf(undefined, { bookCode: '이15ㅇ' })).toBe('이15ㅇ')
  })
})
