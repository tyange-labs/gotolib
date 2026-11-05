import { createSignal, onCleanup } from 'solid-js'
import { clearNovelCache, getAllNovelPeriods, putNovelPeriod } from '../lib/db'
import { LibraryApiError } from '../lib/libraryApi'
import { TARGET_PUBLISHERS } from '../lib/novelClassify'
import {
  fetchNovelPeriodRaw,
  yearWindow,
  yearsSince2020,
  toCandidates,
  type NovelSeojiDoc,
} from '../lib/novelsApi'
import type { NovelCandidate } from '../types/novel'

export interface NovelsProgress {
  done: number
  total: number
  /** 지금 긁고 있는 "출판사 2026-07" 같은 표시. 다 끝났으면 undefined */
  label?: string
}

const CONCURRENCY = 3

/** publisher|yyyy → 캐시 행에서 바로 쓸 수 있게 publisher를 들고 다닌다 */
type Row = { publisher: string; period: string; docs: NovelSeojiDoc[] }

function toCandidateList(rows: Row[]): NovelCandidate[] {
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
 * '한국문학' 탭 데이터: IndexedDB 캐시를 먼저 보여주고, 빠진 출판사×해 구간을 백그라운드에서 채운다.
 * 탭을 처음 열면 시간이 좀 걸릴 수 있지만(17개 출판사 × 7년), 한 번 모은 해는 다음부터 다시 긁지 않는다.
 */
export function useKoreanNovels() {
  const [rows, setRows] = createSignal<Row[]>([])
  const [progress, setProgress] = createSignal<NovelsProgress>({ done: 0, total: 0 })
  const [error, setError] = createSignal<string | null>(null)
  const [ready, setReady] = createSignal(false)

  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })

  const run = async (forceRefetch: boolean) => {
    setError(null)
    let cached: Row[] = []
    if (forceRefetch) {
      await clearNovelCache()
      setRows([])
    } else {
      cached = await getAllNovelPeriods()
      if (cancelled) return
      setRows(cached)
    }
    setReady(true)

    const periods = yearsSince2020()
    const cachedKeys = new Set(cached.map((r) => `${r.publisher}|${r.period}`))
    const jobs = TARGET_PUBLISHERS.flatMap((publisher) =>
      periods
        .filter((period) => !cachedKeys.has(`${publisher}|${period}`))
        .map((period) => ({ publisher, period })),
    )
    if (jobs.length === 0) {
      setProgress({ done: 0, total: 0 })
      return
    }
    setProgress({ done: 0, total: jobs.length, label: '시작하는 중…' })

    let nextIndex = 0
    let doneCount = 0
    const worker = async () => {
      for (;;) {
        if (cancelled) return
        const index = nextIndex++
        if (index >= jobs.length) return
        const { publisher, period } = jobs[index]
        try {
          const [start, end] = yearWindow(period)
          const docs = await fetchNovelPeriodRaw(publisher, start, end)
          if (cancelled) return
          await putNovelPeriod(publisher, period, docs)
          if (cancelled) return
          setRows((prev) => [...prev, { publisher, period, docs }])
        } catch (e) {
          if (cancelled) return
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
    if (!cancelled) setProgress((p) => ({ ...p, label: undefined }))
  }

  void run(false)

  return {
    candidates: () => toCandidateList(rows()),
    ready,
    progress,
    error,
    fetching: () => {
      const p = progress()
      return p.total > 0 && p.done < p.total
    },
    refresh: () => void run(true),
  }
}
