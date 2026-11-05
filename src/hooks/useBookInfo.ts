import { createEffect, createMemo, onCleanup, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'
import { POLL_DELAYS_MS } from '../lib/covers'
import { MAX_ISBNS_PER_REQUEST, chunks, fetchBookInfo, isbnsToAsk, type BookInfoEntry } from '../lib/bookInfo'

/** 이 세션에서 알게 된 책 정보. useCovers의 known 저장소와 같은 패턴(새로고침하면 다시 묻는다). */
const [known, setKnown] = createStore<Record<string, BookInfoEntry | undefined>>({})

/**
 * '한국문학' 탭 후보들의 알라딘 분류·형식어·쪽수를 서버에 묻고, 아직 수집 중인 것만 점점 늘어나는
 * 간격으로 다시 묻는다(useCovers와 같은 폴링). 돌려주는 함수는 ISBN의 BookInfoEntry를 준다.
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

    const run = async () => {
      const ask = isbnsToAsk(initialWanted, known)
      if (ask.length === 0) return
      try {
        for (const chunk of chunks(ask, MAX_ISBNS_PER_REQUEST)) {
          const entries = await fetchBookInfo(chunk)
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

    untrack(() => void run())
    onCleanup(() => {
      cancelled = true
      clearTimeout(timer)
    })
  })

  return (isbn: string | undefined): BookInfoEntry | undefined => (isbn ? known[isbn] : undefined)
}
