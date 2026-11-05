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
  test('제목에 "시인선"이 있으면 소설 아님(시집 시리즈 이름)', () => {
    expect(classifyNovel({ title: '문학동네시인선 200 아무 시집', kdc3: '810', authorCount: 1 }, 300)).toBe(
      '소설 아님',
    )
  })
  test('"시선"만으로는 제외하지 않는다 — 소설 제목에도 흔히 쓰이는 일반 단어라서', () => {
    expect(classifyNovel({ title: '타인의 시선', kdc3: '810', authorCount: 1 }, 300)).toBe('장편')
  })
  test('공저 3인 이상이면 소설 아님(앤솔로지)', () => {
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 3 }, 300)).toBe('소설 아님')
  })
  test('제목에 소설집·연작소설 등이 있으면 쪽수와 무관하게 소설집', () => {
    expect(classifyNovel({ title: '단편선', kdc3: '810', authorCount: 1 }, null)).toBe('소설집')
  })
  test('실제 버그 사례: kdc3·SERIES_TITLE 모두 비어 있는 문학동네 시인선 시집(쪽수만 짧음)은 소설집으로 단정하지 않는다', () => {
    // 수진 "종이 인형 목욕시키기" — NL 서지에 시집이라는 신호가 전혀 없고 쪽수만 짧다(시집은 보통 150쪽 안팎).
    // kdc3가 813으로 확정되지 않은 한 짧다는 이유만으로 소설집이라 단정하지 않고, 알라딘이 확인해 줄 때까지 기다린다.
    expect(classifyNovel({ title: '종이 인형 목욕시키기', kdc3: '810', authorCount: 1 }, 132)).toBe('확인 필요')
  })
  test('쪽수 200 미만이어도 kdc3가 813(한국소설 확정)이면 소설집', () => {
    expect(classifyNovel({ title: '아무 제목', kdc3: '813', authorCount: 1 }, 150)).toBe('소설집')
  })
  test('쪽수 없으면 확인 필요, 200~250 미만이면 확인 필요, 250 이상이면 장편', () => {
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 1 }, null)).toBe('확인 필요')
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 1 }, 220)).toBe('확인 필요')
    expect(classifyNovel({ title: '아무 제목', kdc3: '810', authorCount: 1 }, 250)).toBe('장편')
  })
})

describe('classifyWithAladin', () => {
  const candidate = { title: '아무 제목', kdc3: '810', authorCount: 1 }

  test('YES24 분류가 있으면 다른 신호보다 먼저 쓴다', () => {
    expect(classifyWithAladin(candidate, 100, { yes24Form: '장편', formHint: '소설집' })).toBe('장편')
    expect(classifyWithAladin(candidate, 400, { yes24Form: '단편', formHint: '장편소설' })).toBe('소설집')
    // 제목 키워드로 '소설 아님'이 나오는 책이어도 YES24가 소설 분류에 넣었으면 소설이다
    expect(classifyWithAladin({ ...candidate, title: '어느 산문집 같은 제목' }, null, { yes24Form: '장편' })).toBe('장편')
  })
  test('알라딘 형식어가 있으면 쪽수 없이도 바로 확정한다 — 장편·중편·단편집을 따로 구분하지 않고 소설집으로 묶는다', () => {
    expect(classifyWithAladin(candidate, null, { formHint: '장편소설' })).toBe('장편')
    expect(classifyWithAladin(candidate, null, { formHint: '경장편소설' })).toBe('장편')
    expect(classifyWithAladin(candidate, null, { formHint: '소설집' })).toBe('소설집')
    expect(classifyWithAladin(candidate, null, { formHint: '연작소설' })).toBe('소설집')
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
  test('실제 버그 사례: 옛날 책은 맨 끝에 장르가 아니라 "2000년대 이전" 같은 시기 구간이 붙는다 — 맨 끝 갈래만 보면 안 된다', () => {
    // 최인호 "몽유도원도": "전자책 > 소설/시/희곡 > 한국소설 > 2000년대 이전"의 맨 끝 "2000년대 이전"에는
    // "소설"이 없어서, 맨 끝 갈래만 보던 예전 로직은 이걸 소설 아님으로 잘못 걸렀다.
    expect(
      classifyWithAladin(candidate, 300, {
        category: '전자책 > 소설/시/희곡 > 한국소설 > 2000년대 이전',
      }),
    ).not.toBe('소설 아님')
  })
  test('분류가 여러 줄이면 한 줄이라도 소설이면 소설로 본다', () => {
    // 정전: 장르 줄 + "추천도서 > 국내 문학상" 줄
    expect(
      classifyWithAladin(candidate, 300, {
        categories: ['국내도서 > 추천도서 > 국내 문학상 > 김수영 문학상', '국내도서 > 소설/시/희곡 > 한국소설'],
      }),
    ).not.toBe('소설 아님')
    expect(
      classifyWithAladin(candidate, 300, {
        categories: ['국내도서 > 소설/시/희곡 > 시 > 한국시', '국내도서 > 추천도서 > 국내 문학상 > 김수영 문학상'],
      }),
    ).toBe('소설 아님')
  })
  test('categories가 있으면 예전 category 한 줄보다 먼저 본다', () => {
    expect(
      classifyWithAladin(candidate, 300, { categories: ['전자책 > 에세이 > 한국에세이'], category: '국내도서 > 소설/시/희곡 > 한국소설' }),
    ).toBe('소설 아님')
  })
  test('에세이처럼 "소설/시/희곡" 묶음이 아예 없는 분류도 정확히 걸러낸다', () => {
    expect(
      classifyWithAladin(candidate, 300, { category: '전자책 > 에세이 > 한국에세이' }),
    ).toBe('소설 아님')
  })
  test('알라딘 쪽수가 있으면 NL 쪽수보다 우선한다', () => {
    expect(classifyWithAladin(candidate, 100, { pages: 300 })).toBe('장편')
  })
  test('알라딘 정보가 아직 없으면(undefined) NL 신호로만 판정한다', () => {
    expect(classifyWithAladin(candidate, 300, undefined)).toBe('장편')
  })
})
