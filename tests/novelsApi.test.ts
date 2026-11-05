import { afterEach, describe, expect, test } from 'bun:test'
import { fetchNovelPeriodRaw, toCandidates, yearWindow, yearsSince2020, type NovelSeojiDoc } from '../src/lib/novelsApi'
import { LibraryApiError } from '../src/lib/libraryApi'

const originalFetch = globalThis.fetch

function stubFetch(body: unknown) {
  globalThis.fetch = (() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)) as unknown as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchNovelPeriodRaw', () => {
  test('정상 응답(결과 0건 포함)은 빈 배열을 조용히 돌려준다', async () => {
    stubFetch({ TOTAL_COUNT: '0', PAGE_NO: '1', docs: [] })
    expect(await fetchNovelPeriodRaw('문학동네', '20200101', '20201231')).toEqual([])
  })
  test('업무 오류(RESULT=ERROR)는 던진다', async () => {
    stubFetch({ RESULT: 'ERROR', ERR_CODE: '012', ERR_MESSAGE: '필수 파라메터 입력 누락' })
    await expect(fetchNovelPeriodRaw('문학동네', '20200101', '20201231')).rejects.toBeInstanceOf(
      LibraryApiError,
    )
  })
  test('docs 없는 게이트웨이 오류(resultCode)도 빈 배열로 조용히 넘기지 않고 던진다 — 캐시에 거짓 0건이 영구 저장되는 걸 막는다', async () => {
    // 실제로 겪은 모양: 국립중앙도서관 서지정보 API의 일일 호출 한도를 넘기면 RESULT/ERR_CODE가 아니라
    // resultCode/resultMsg로 온다.
    stubFetch({ resultCode: '105', resultMsg: 'ERROR-API ERROR' })
    await expect(fetchNovelPeriodRaw('문학동네', '20200101', '20201231')).rejects.toBeInstanceOf(
      LibraryApiError,
    )
  })
})

describe('toCandidates', () => {
  const base: NovelSeojiDoc = {
    TITLE: '전자책_일곱개의 이름',
    AUTHOR: '차병직',
    PUBLISHER: '(주식회사)창비',
    EA_ISBN: '9791136473988',
    EA_ADD_CODE: '05810',
    RELATED_ISBN: '9791136473971',
    REAL_PUBLISH_DATE: '20260101',
    EBOOK_YN: 'Y',
    FORM: '전자책',
  }

  test('"전자책_"(오타 "전자채_" 포함) 접두는 제목에서 뗀다', () => {
    const [novel] = toCandidates([base], '창비')
    expect(novel.title).toBe('일곱개의 이름')

    const [typo] = toCandidates([{ ...base, TITLE: '전자채_심장, 유영' }], '창비')
    expect(typo.title).toBe('심장, 유영')
  })

  test('id는 종이책(RELATED_ISBN) ISBN을 쓰고, 없으면 전자책 ISBN으로 대신한다', () => {
    const [withPaper] = toCandidates([base], '창비')
    expect(withPaper.id).toBe('9791136473971')
    expect(withPaper.ebookIsbn13).toBe('9791136473988')

    const [noPaper] = toCandidates([{ ...base, RELATED_ISBN: undefined }], '창비')
    expect(noPaper.id).toBe('9791136473988')
  })
})

describe('yearsSince2020 / yearWindow', () => {
  test('2020년부터 올해까지, 달이 아니라 해 단위다', () => {
    const years = yearsSince2020()
    expect(years[0]).toBe('2020')
    expect(years.at(-1)).toBe(String(new Date().getFullYear()))
    expect(years.every((y) => /^\d{4}$/.test(y))).toBe(true)
  })
  test('yearWindow는 그 해 1월 1일부터 12월 31일까지', () => {
    expect(yearWindow('2024')).toEqual(['20240101', '20241231'])
  })
})
