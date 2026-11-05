import { createEffect, createMemo, onCleanup, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { POLL_DELAYS_MS } from '../lib/covers'
import {
  MAX_ISBNS_PER_REQUEST,
  chunks,
  fetchBookInfo,
  isPending,
  isbnsToAsk,
  type BookInfoEntry,
} from '../lib/bookInfo'

/** 이 세션에서 알게 된 책 정보. useCovers의 known 저장소와 같은 패턴(새로고침하면 다시 묻는다). */
const [known, setKnown] = createStore<Record<string, BookInfoEntry | undefined>>({})

/**
 * 처음 몇 번(POLL_DELAYS_MS) 뒤에도 확정 안 된 책이 남으면 이 간격으로 계속 묻는다. 서버의 YES24 백필·알라딘
 * 상세 보충은 몇 시간씩 걸려서, 짧은 폴링만으로는 화면을 연 동안 들어온 정보를 놓친다. 서버는 DB만 보지만
 * IP당 분당 60·시간당 600회 제한이 있어서(한 번에 50권씩) 너무 촘촘하게 묻지 않는다.
 */
export const LONG_POLL_MS = 5 * 60 * 1000

/**
 * '한국문학' 탭 후보들의 알라딘·YES24 정보를 서버에 묻는다. 장편/소설집을 확정해 주는 신호가 아직 없는 책은
 * 점점 늘어나는 간격으로, 그 뒤에는 LONG_POLL_MS마다 다시 묻는다(탭이 숨겨져 있으면 쉰다). 돌려주는 함수는
 * ISBN의 BookInfoEntry를 준다.
 */
export function useBookInfo(items: () => Array<{ isbn: string | undefined; pubDate?: string }>) {
  const key = createMemo(() =>
    items()
      .filter((item) => item.isbn)
      .map((item) => `${item.isbn}@${item.pubDate ?? ''}`)
      .join(','),
  )

  createEffect(() => {
    const initialWanted = items()
    let attempt = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    key() // 의존성으로 등록(목록이 바뀌면 이펙트가 새로 돈다)

    // 짧은 간격의 재시도는 아직 대기 중(pending)인 책만 묻는다 — 이미 'ok'인 책까지 몇 초마다 다 물으면
    // 서버의 분당 요청 제한에 걸린다. 'ok'인데 확정 신호가 없는 책은 긴 간격(LONG_POLL_MS)으로만 다시 묻는다.
    const scheduleNext = () => {
      if (cancelled) return
      if (attempt < POLL_DELAYS_MS.length && isbnsToAsk(initialWanted, known, isPending).length > 0) {
        timer = setTimeout(() => void run(true), POLL_DELAYS_MS[attempt++])
      } else if (isbnsToAsk(initialWanted, known).length > 0) {
        timer = setTimeout(() => void run(false), LONG_POLL_MS)
      }
    }

    const run = async (pendingOnly: boolean) => {
      // 탭이 안 보이는 동안은 묻지 않고 다음 차례만 잡는다.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return scheduleNext()
      const ask = pendingOnly ? isbnsToAsk(initialWanted, known, isPending) : isbnsToAsk(initialWanted, known)
      try {
        for (const chunk of chunks(ask, MAX_ISBNS_PER_REQUEST)) {
          const entries = await fetchBookInfo(chunk)
          if (cancelled) return
          setKnown(entries)
        }
      } catch {
        // 실패(요청 제한 포함)해도 그만두지 않고 긴 간격으로 넘어간다.
        attempt = POLL_DELAYS_MS.length
      }
      scheduleNext()
    }

    // 처음 한 번은 확정 안 된 책을 모두 묻는다.
    untrack(() => void run(false))
    onCleanup(() => {
      cancelled = true
      clearTimeout(timer)
    })
  })

  return (isbn: string | undefined): BookInfoEntry | undefined => (isbn ? known[isbn] : undefined)
}
