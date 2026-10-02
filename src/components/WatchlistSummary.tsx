import { A } from '@solidjs/router'
import { ChevronDown, ChevronUp, Heart } from 'lucide-solid'
import { For, Show, createEffect, createSignal, on } from 'solid-js'
import { useApp } from '../context/appContext'
import type { Library } from '../lib/libraryApi'
import { fetchAvailability } from '../lib/queries'
import type { Book } from '../types/book'

type BookStatus =
  | { state: 'loading' }
  | { state: 'available'; library: string }
  | { state: 'onLoan' }
  | { state: 'notHeld' }
  | { state: 'error' }

/**
 * 찜한 책들의 대출 가능 여부(자주 가는 도서관 기준). 조회는 **펼쳤을 때만** 한다 — 찜 5권 × 자주 가는
 * 도서관 수만큼 요청이 나가므로, 서재에 들어왔다고 미리 보내지 않는다. 항목을 누르면 목록의 그 책으로 간다.
 */
export function WatchlistSummary(props: { onSelect?: (bookId: string) => void }) {
  const { books, watchlist, favorites } = useApp()
  const [expanded, setExpanded] = createSignal(false)
  const [statuses, setStatuses] = createSignal<Record<string, BookStatus>>({})

  const watched = () =>
    watchlist
      .ids()
      .map((id) => books().find((b) => b.id === id))
      .filter((b): b is Book => Boolean(b))

  const favs = () => favorites.favorites()

  // 조회 재실행 키 (찜한 도서 집합 + 자주 가는 도서관 집합이 바뀔 때만).
  // `on`으로 이 키와 펼침 여부만 추적한다. 그냥 두면 아래에서 읽는 statuses까지
  // 의존이 되어 응답이 올 때마다 조회가 다시 돈다.
  const key = () =>
    `${watchlist.ids().join(',')}|${favs().map((f) => f.libCode).join(',')}`

  // 접었다 펴거나 찜이 바뀌어 조회가 겹칠 수 있다. 가장 최근 조회의 결과만 반영한다.
  // (접을 때 조회를 취소하지 않는다: 이미 나간 요청은 캐시에 남아 다시 펼 때 쓰인다.)
  let run = 0

  createEffect(
    on([key, expanded], ([, open]) => {
      if (!open) return
      const list = watched()
      const libs = favs()
      if (list.length === 0 || libs.length === 0) return

      const mine = ++run
      // 이미 알고 있는 책의 상태는 그대로 두고(다시 펼 때 깜빡이지 않게), 새 책만 '확인 중'으로.
      setStatuses((prev) =>
        Object.fromEntries(
          list.map((b) => [b.id, prev[b.id] ?? { state: 'loading' as const }]),
        ),
      )
      list.forEach(async (book) => {
        const status = await bestStatus(book, libs)
        if (mine === run) setStatuses((prev) => ({ ...prev, [book.id]: status }))
      })
    }),
  )

  // 헤더 요약: 한 번도 조회하지 않았으면 안내, 조회 중이면 '확인 중', 끝났으면 개수.
  const summary = () => {
    const all = Object.values(statuses())
    if (all.length === 0) return '펼쳐서 대출 상태 확인'
    if (all.some((s) => s.state === 'loading')) return '확인 중…'
    return `대출 가능 ${all.filter((s) => s.state === 'available').length}권`
  }

  return (
    <Show when={watched().length > 0}>
      <section class="watchlist">
        <button
          class="watchlist__header"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded()}
        >
          <span class="watchlist__title">
            <Heart size={12} fill="currentColor" aria-hidden />
            찜 목록 {watched().length}권
          </span>
          <Show
            when={favs().length > 0}
            fallback={
              <span class="watchlist__hint">자주 가는 도서관 등록 필요</span>
            }
          >
            <span class="watchlist__count">{summary()}</span>
          </Show>
          <span class="watchlist__chevron" aria-hidden>
            <Show when={expanded()} fallback={<ChevronDown size={14} />}>
              <ChevronUp size={14} />
            </Show>
          </span>
        </button>

        <Show when={expanded()}>
          <ul class="watchlist__list">
            <Show when={favs().length === 0}>
              <li class="watchlist__item">
                <A href="/nearby">주변 도서관</A>에서 자주 가는 도서관을 먼저
                등록하세요.
              </li>
            </Show>
            <Show when={favs().length > 0}>
              <For each={watched()}>
                {(book) => (
                  <li class="watchlist__item">
                    <button
                      class="watchlist__book"
                      onClick={() => props.onSelect?.(book.id)}
                    >
                      {book.title}
                    </button>
                    <StatusLabel status={statuses()[book.id]} />
                  </li>
                )}
              </For>
            </Show>
          </ul>
        </Show>
      </section>
    </Show>
  )
}

const STATUS_LABEL: Record<BookStatus['state'], string> = {
  loading: '확인 중',
  available: '대출 가능',
  onLoan: '대출 중',
  notHeld: '미소장',
  error: '확인 실패',
}

function StatusLabel(props: { status?: BookStatus }) {
  const state = () => props.status?.state ?? 'loading'
  const tone = () =>
    state() === 'available' ? 'ok' : state() === 'onLoan' ? 'warn' : 'muted'
  const title = () =>
    props.status?.state === 'available' ? props.status.library : undefined

  return (
    <span class={`badge badge--${tone()}`} title={title()}>
      {STATUS_LABEL[state()]}
    </span>
  )
}
/** 자주 가는 도서관들 중 가장 좋은 상태(대출가능 > 대출중 > 미소장)를 고른다 */
async function bestStatus(book: Book, favs: Library[]): Promise<BookStatus> {
  if (!book.isbn13) return { state: 'notHeld' }
  try {
    const results = await Promise.all(
      favs.map(async (lib) => ({
        lib,
        ...(await fetchAvailability(book.isbn13!, lib.libCode)),
      })),
    )
    const available = results.find((r) => r.hasBook && r.loanAvailable)
    if (available) return { state: 'available', library: available.lib.libName }
    if (results.some((r) => r.hasBook)) return { state: 'onLoan' }
    return { state: 'notHeld' }
  } catch {
    return { state: 'error' }
  }
}
