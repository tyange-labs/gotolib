import { createEffect, createMemo, onCleanup, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import {
  MAX_ISBNS_PER_REQUEST,
  POLL_DELAYS_MS,
  chunks,
  fetchCovers,
  isbnsToAsk,
  type CoverEntry,
} from '../lib/covers'

/** 이 세션에서 알게 된 표지. 화면을 오가도 다시 묻지 않는다(저장하지는 않는다: 앱을 다시 열면 한 번 더 묻는다). */
const [known, setKnown] = createStore<Record<string, CoverEntry | undefined>>({})

/**
 * 지금 화면에 보이는 책들의 표지를 서버에 묻고, 아직 수집 중인 것만 점점 늘어나는 간격으로 다시 묻는다.
 * 화면이 바뀌면(페이지 넘김 등) 이전 화면의 폴링은 멈춘다. 실패하면 조용히 그만둔다(표지는 없어도 되는 부가 요소).
 * 돌려주는 함수는 ISBN의 표지 주소를 준다(없으면 undefined).
 */
export function useCovers(isbns: () => Array<string | undefined>) {
  // 같은 ISBN 목록이면 다시 돌지 않게 문자열 키로 비교한다.
  const key = createMemo(() => isbns().filter(Boolean).join(','))

  createEffect(() => {
    // 이 이펙트 실행(= 이 화면의 ISBN 목록)에 고정된 값이다. 목록이 바뀌면 이펙트가 새로 돈다.
    const initialWanted = key().split(',').filter(Boolean)
    let attempt = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      const ask = isbnsToAsk(initialWanted, known)
      if (ask.length === 0) return
      try {
        for (const chunk of chunks(ask, MAX_ISBNS_PER_REQUEST)) {
          const entries = await fetchCovers(chunk)
          if (cancelled) return
          setKnown(entries)
        }
      } catch {
        return
      }
      if (cancelled) return
      if (isbnsToAsk(initialWanted, known).length > 0 && attempt < POLL_DELAYS_MS.length) {
        timer = setTimeout(() => void run(), POLL_DELAYS_MS[attempt++])
      }
    }

    // 스토어를 읽는 일이 이 이펙트의 의존성이 되면 응답이 올 때마다 다시 돌아 폴링이 겹친다.
    untrack(() => void run())
    onCleanup(() => {
      cancelled = true
      clearTimeout(timer)
    })
  })

  return (isbn: string | undefined): string | undefined => {
    const entry = isbn ? known[isbn] : undefined
    return entry?.status === 'ok' ? entry.url : undefined
  }
}
