import { describe, expect, test } from 'bun:test'
import { classifyNovel, classifyWithAladin } from '../src/lib/novelClassify'

describe('classifyNovel', () => {
  test('kdc3 810(한국문학 대분류, 하위 갈래 미기재)은 소설 아님으로 보지 않는다 — 실제로 소설에도 흔히 붙는다', () => {
    // 실제 버그 사례: 함윤이 "정전"(제31회 문학동네소설상 수상작), 박서련 "사랑의 힘" 모두
    // EA_ADD_CODE가 "05810"이라 kdc3가 "810"이었다. 장편 쪽수(250+)면 '장편'으로 판정돼야 한다.
    expect(classifyNovel({ title: '정전', kdc3: '810', authorCount: 1 }, 300)).toBe('장편')
    expect(classifyNovel({ title: '사랑의 힘', kdc3: '810', authorCount: 1 }, 300)).toBe('장편')
  })
  test('kdc3 813(한국소설)도 당연히 통과', () => {
    expect(classifyNovel({ title: '아무 제목', kdc3: '813', authorCount: 1 }, 300)).toBe('장편')
  })
  test('시·희곡·수필 등 구체적인 비소설 kdc3는 소설 아님', () => {
    for (const kdc3 of ['811', '812', '814', '815', '816', '817', '818', '819']) {
      expect(classifyNovel({ title: '아무 제목', kdc3, authorCount: 1 }, 300)).toBe('소설 아님')
    }
  })
  test('제목에 에세이·시집 등이 있으면 소설 아님', () => {
    expect(classifyNovel({ title: '어느 날의 에세이', kdc3: '810', authorCount: 1 }, 300)).toBe('소설 아님')
  })
  test('공저 3인 이상이면 소설 아님(앤솔로지)', () => {
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 3 }, 300)).toBe('소설 아님')
  })
  test('제목에 소설집·연작소설 등이 있으면 소설집·중편', () => {
    expect(classifyNovel({ title: '단편선', kdc3: '810', authorCount: 1 }, null)).toBe('소설집·중편')
  })
  test('쪽수 없으면 확인 필요, 200 미만이면 소설집·중편, 250 이상이면 장편', () => {
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 1 }, null)).toBe('확인 필요')
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 1 }, 150)).toBe('소설집·중편')
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 1 }, 220)).toBe('확인 필요')
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 1 }, 250)).toBe('장편')
  })
})

describe('classifyWithAladin', () => {
  const candidate = { title: '아무 제목', kdc3: '810', authorCount: 1 }

  test('알라딘 형식어가 있으면 쪽수 없이도 바로 확정한다', () => {
    expect(classifyWithAladin(candidate, null, { formHint: '장편소설' })).toBe('장편')
    expect(classifyWithAladin(candidate, null, { formHint: '경장편소설' })).toBe('장편')
    expect(classifyWithAladin(candidate, null, { formHint: '소설집' })).toBe('소설집·중편')
    expect(classifyWithAladin(candidate, null, { formHint: '연작소설' })).toBe('소설집·중편')
  })
  test('분류 경로가 있는데 "소설"이 없으면 소설 아님(알라딘 자체 분류를 믿는다)', () => {
    expect(
      classifyWithAladin(candidate, 300, { category: '국내도서 > 소설/시/희곡 > 한국시' }),
    ).toBe('소설 아님')
  })
  test('분류 경로에 "소설"이 있으면 그 신호로 소설 아님 처리하지 않는다', () => {
    expect(
      classifyWithAladin(candidate, 300, { category: '국내도서 > 소설/시/희곡 > 한국소설' }),
    ).not.toBe('소설 아님')
  })
  test('알라딘 쪽수가 있으면 NL 쪽수보다 우선한다', () => {
    expect(classifyWithAladin(candidate, 100, { pages: 300 })).toBe('장편')
  })
  test('알라딘 정보가 아직 없으면(undefined) NL 신호로만 판정한다', () => {
    expect(classifyWithAladin(candidate, 300, undefined)).toBe('장편')
  })
})
