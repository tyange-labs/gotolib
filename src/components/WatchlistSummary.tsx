import { A } from '@solidjs/router'
import { ChevronDown, ChevronUp, Heart } from 'lucide-solid'
import { For, Show, createEffect, createSignal, on, onCleanup } from 'solid-js'
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

/** 찜한 책들을 앱 진입 시 자주 가는 도서관에서 대출 가능 여부 조회. 항목을 누르면 목록의 그 책으로 간다 */
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
  // `on`으로 이 키 하나만 추적한다. 그냥 두면 아래에서 읽는 statuses까지
  // 의존이 되어 응답이 올 때마다 조회가 다시 돈다.
  const key = () =>
    `${watchlist.ids().join(',')}|${favs().map((f) => f.libCode).join(',')}`

  createEffect(
    on(key, () => {
      const list = watched()
      const libs = favs()
      if (list.length === 0 || libs.length === 0) return

      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })

      setStatuses(
        Object.fromEntries(list.map((b) => [b.id, { state: 'loading' }])),
      )
      list.forEach(async (book) => {
        const status = await bestStatus(book, libs)
        if (!cancelled) setStatuses((prev) => ({ ...prev, [book.id]: status }))
      })
    }),
  )

  const availableCount = () =>
    Object.values(statuses()).filter((s) => s.state === 'available').length

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
            <span class="watchlist__count">대출 가능 {availableCount()}권</span>
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
