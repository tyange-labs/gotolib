import { afterEach, describe, expect, test } from 'bun:test'
import { fetchNovelPeriodRaw, yearWindow, yearsSince2020 } from '../src/lib/novelsApi'
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
