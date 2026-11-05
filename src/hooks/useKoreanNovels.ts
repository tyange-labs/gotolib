import { createSignal, onCleanup } from 'solid-js'
import { clearNovelCacheForYear, getAllNovelPeriods, putNovelPeriod } from '../lib/db'
import { LibraryApiError } from '../lib/libraryApi'
import { TARGET_PUBLISHERS } from '../lib/novelClassify'
import { fetchKoreanNovels } from '../lib/koreanNovelsApi'
import { fetchNovelPeriodRaw, yearWindow, collectionYears, toCandidates, type NovelSeojiDoc } from '../lib/novelsApi'
import type { KoreanNovel, NovelCandidate } from '../types/novel'

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
 * '한국문학' 탭 데이터. 연도 칩으로 고른 **한 해**만 다룬다.
 * - 목록: 서버가 YES24 "한국 장편소설"에서 모은 종이책(`fetchKoreanNovels`). 한 번 받은 해는 이 화면에 있는 동안 다시 받지 않는다.
 * - 전자책 여부: NL 서지정보 API의 전자책 레코드(17개 출판사 × 그해)에서 종이책 ISBN(RELATED_ISBN)을 모아 표시만 한다.
 *   이미 모은 적 있는 해는 이 기기의 IndexedDB 캐시를 쓰고 다시 긁지 않는다.
 */
export function useKoreanNovels() {
  const years = collectionYears().slice().reverse()
  const [year, setYearSignal] = createSignal(years[0])
  const [rows, setRows] = createSignal<Row[]>([])
  const [progress, setProgress] = createSignal<NovelsProgress>({ done: 0, total: 0 })
  const [error, setError] = createSignal<string | null>(null)

  const [lists, setLists] = createSignal<Record<string, KoreanNovel[]>>({})
  const [listError, setListError] = createSignal<string | null>(null)

  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })

  const loadList = async (targetYear: string, force: boolean) => {
    if (!force && lists()[targetYear]) return
    setListError(null)
    try {
      const novels = await fetchKoreanNovels(targetYear)
      if (cancelled) return
      setLists((prev) => ({ ...prev, [targetYear]: novels }))
    } catch (e) {
      if (cancelled || targetYear !== year()) return
      setListError(e instanceof Error ? e.message : '목록을 불러오지 못했어요.')
    }
  }

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
              ? `전자책 정보를 다 모으지 못했어요: ${e.message}`
              : '전자책 정보를 다 모으지 못했어요. 나중에 다시 열면 이어서 모아요.',
          )
        } finally {
          // try 안에서 token이 바뀐 걸 보고 return해도 finally는 돈다 — 연도를 전환해 멈춘(stale) 워커가
          // 그 뒤에도 공유 progress 신호를 계속 덮어쓰면 다른 해의 진행률·라벨이 섞여 보인다. 여기서도
          // 한 번 더 막는다.
          if (!cancelled && token === runToken) {
            doneCount += 1
            setProgress({ done: doneCount, total: jobs.length, label: `${publisher} ${period}` })
          }
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (!cancelled && token === runToken) setProgress((p) => ({ ...p, label: undefined }))
  }

  // 처음 열 때: 이미 들렀던 모든 해의 캐시를 네트워크 없이 통째로 불러온다.
  // 그다음 지금 고른 해(기본: 가장 최근 연도, year() 대신 초기값 years[0]을 바로 쓴다)만 부족분을 긁는다.
  const loadInitial = async () => {
    const cached = await getAllNovelPeriods()
    if (cancelled) return
    setRows(cached)
    void fetchYear(years[0], false)
  }
  // fetchYear·loadList가 내부에서 신호를 읽어서 eslint-plugin-solid가 이 마운트 때 단 한 번뿐인 호출도
  // "추적되는 범위 밖에서 신호를 읽는다"고 본다 — 의도한 일회성 초기화라 경고를 끈다.
  // eslint-disable-next-line solid/reactivity
  void loadList(years[0], false)
  // eslint-disable-next-line solid/reactivity
  void loadInitial()

  const setYear = (y: string) => {
    if (y === year()) return
    setYearSignal(y)
    void loadList(y, false)
    void fetchYear(y, false)
  }

  /** 그해 전자책이 있는 종이책 ISBN(NL 전자책 레코드의 RELATED_ISBN) */
  const ebookIsbns = () => {
    const set = new Set<string>()
    for (const candidate of toCandidateList(rows().filter((r) => r.period === year()))) {
      if (candidate.paperIsbn13) set.add(candidate.paperIsbn13)
    }
    return set
  }

  return {
    years,
    year,
    setYear,
    novels: () => lists()[year()] ?? [],
    /** 지금 고른 해의 목록을 받았는가 */
    ready: () => lists()[year()] !== undefined,
    listError,
    ebookIsbns,
    progress,
    error,
    refresh: () => {
      void loadList(year(), true)
      void fetchYear(year(), true)
    },
  }
}
