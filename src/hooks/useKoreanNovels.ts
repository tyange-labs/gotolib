import { createMemo, createSignal, onCleanup } from 'solid-js'
import { clearNovelCacheForYear, getAllNovelPeriods, putNovelPeriod } from '../lib/db'
import { LibraryApiError } from '../lib/libraryApi'
import { TARGET_PUBLISHERS } from '../lib/novelClassify'
import { fetchNovelPeriodRaw, yearWindow, yearsSince2020, toCandidates, type NovelSeojiDoc } from '../lib/novelsApi'
import type { NovelCandidate } from '../types/novel'

export interface NovelsProgress {
  done: number
  total: number
  /** 지금 긁고 있는 "출판사 2026" 같은 표시. 다 끝났으면 undefined */
  label?: string
}

const CONCURRENCY = 3

/** publisher|yyyy → 캐시 행에서 바로 쓸 수 있게 publisher를 들고 다닌다 */
type Row = { publisher: string; period: string; docs: NovelSeojiDoc[] }

function toCandidateList(rows: readonly Row[]): NovelCandidate[] {
  const seen = new Map<string, NovelCandidate>()
  for (const row of rows) {
    for (const candidate of toCandidates(row.docs, row.publisher)) {
      // 같은 책이 여러 출판사 질의(형태소 검색 오검출)에 걸릴 일은 거의 없지만, 걸리면 먼저 온 것을 지킨다.
      if (!seen.has(candidate.id)) seen.set(candidate.id, candidate)
    }
  }
  return [...seen.values()]
}

/**
 * '한국문학' 탭 데이터: 연도 칩으로 고른 **한 해**(17개 출판사)만 모은다. 2020~올해를 한꺼번에 긁으면
 * 요청이 너무 많아져서(일일 호출 한도를 쉽게 넘긴다) 연도를 고를 때마다 그 해만 받아 오게 바꿨다.
 * 이미 모은 적 있는 해는(이 기기의 IndexedDB 캐시에) 다시 긁지 않고 바로 보여준다 — 이전에 들렀던
 * 해들의 캐시는 탭을 열 때 한 번에 불러와서(네트워크 없이) 칩에 권수를 보여줄 수 있게 한다.
 */
export function useKoreanNovels() {
  const years = yearsSince2020().slice().reverse()
  const [year, setYearSignal] = createSignal(years[0])
  const [rows, setRows] = createSignal<Row[]>([])
  const [progress, setProgress] = createSignal<NovelsProgress>({ done: 0, total: 0 })
  const [error, setError] = createSignal<string | null>(null)
  const [ready, setReady] = createSignal(false)

  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })

  // 연도를 바꾸면 이전 해를 긁던 워커는 멈춰야 한다(cancelled 하나로는 이 훅 자체가 사라질 때만 막아서,
  // 토큰으로 "지금 고른 해"가 바뀌었는지도 따로 본다).
  let runToken = 0

  const fetchYear = async (targetYear: string, forceRefetch: boolean) => {
    const token = ++runToken
    setError(null)
    if (forceRefetch) {
      await clearNovelCacheForYear(targetYear)
      if (cancelled || token !== runToken) return
      setRows((prev) => prev.filter((r) => r.period !== targetYear))
    }

    // fetchYear를 부른 시점의 캐시 스냅샷 — 이 함수가 도는 동안 rows가 바뀌어도(워커가 채워 넣어도)
    // 다시 읽지 않는다(한 번 정한 작업 목록을 그대로 돈다).
    const initialCachedPublishers = new Set(
      rows()
        .filter((r) => r.period === targetYear)
        .map((r) => r.publisher),
    )
    const jobs = TARGET_PUBLISHERS.filter((publisher) => !initialCachedPublishers.has(publisher)).map((publisher) => ({
      publisher,
      period: targetYear,
    }))
    if (jobs.length === 0) {
      setProgress({ done: 0, total: 0 })
      return
    }
    setProgress({ done: 0, total: jobs.length, label: '시작하는 중…' })

    let nextIndex = 0
    let doneCount = 0
    const worker = async () => {
      for (;;) {
        if (cancelled || token !== runToken) return
        const index = nextIndex++
        if (index >= jobs.length) return
        const { publisher, period } = jobs[index]
        try {
          const [start, end] = yearWindow(period)
          const docs = await fetchNovelPeriodRaw(publisher, start, end)
          if (cancelled || token !== runToken) return
          await putNovelPeriod(publisher, period, docs)
          if (cancelled || token !== runToken) return
          setRows((prev) => [...prev, { publisher, period, docs }])
        } catch (e) {
          if (cancelled || token !== runToken) return
          setError(
            e instanceof LibraryApiError
              ? e.message
              : '수집 중 일부 구간을 가져오지 못했어요. 나중에 다시 열면 이어서 모아요.',
          )
        } finally {
          doneCount += 1
          setProgress({ done: doneCount, total: jobs.length, label: `${publisher} ${period}` })
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (!cancelled && token === runToken) setProgress((p) => ({ ...p, label: undefined }))
  }

  // 처음 열 때: 이미 들렀던 모든 해의 캐시를 네트워크 없이 통째로 불러온다(칩에 권수를 보여주려고).
  // 그다음 지금 고른 해(기본: 가장 최근 연도, year() 대신 초기값 years[0]을 바로 쓴다)만 부족분을 긁는다.
  const loadInitial = async () => {
    const cached = await getAllNovelPeriods()
    if (cancelled) return
    setRows(cached)
    setReady(true)
    void fetchYear(years[0], false)
  }
  // fetchYear가 내부에서 rows()를 읽어서 eslint-plugin-solid가 이 마운트 때 단 한 번뿐인 호출도
  // "추적되는 범위 밖에서 신호를 읽는다"고 본다 — 의도한 일회성 초기화라 경고를 끈다.
  // eslint-disable-next-line solid/reactivity
  void loadInitial()

  const setYear = (y: string) => {
    if (y === year()) return
    setYearSignal(y)
    void fetchYear(y, false)
  }

  /** 칩에 보여줄 해별 권수. 아직 한 번도 안 긁은 해는 뺀다(0권으로 보이면 혼동되니까). */
  const yearCounts = createMemo(() => {
    const byYear = new Map<string, Row[]>()
    for (const row of rows()) byYear.set(row.period, [...(byYear.get(row.period) ?? []), row])
    const counts = new Map<string, number>()
    for (const [y, yearRows] of byYear) counts.set(y, toCandidateList(yearRows).length)
    return counts
  })

  return {
    years,
    year,
    setYear,
    yearCounts,
    candidates: () => toCandidateList(rows().filter((r) => r.period === year())),
    ready,
    progress,
    error,
    fetching: () => {
      const p = progress()
      return p.total > 0 && p.done < p.total
    },
    refresh: () => void fetchYear(year(), true),
  }
}
