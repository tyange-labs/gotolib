import { A } from '@solidjs/router'
import { Library as ShelfIcon, BookOpen, ChevronDown, ChevronUp, Heart } from 'lucide-solid'
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { useApp } from '../context/appContext'
import { useFavoriteHoldings } from '../hooks/useFavoriteHoldings'
import type { Library } from '../lib/libraryApi'
import { fadeOut } from '../lib/motion'
import { isReading } from '../lib/reading'
import { fetchAvailability } from '../lib/queries'
import { FavoriteHoldingsPanel } from './FavoriteHoldingsPanel'
import { Pagination } from './Pagination'
import { PushToggle } from './PushToggle'
import { Spinner } from './Spinner'
import type { Book } from '../types/book'

/** 찜 목록은 이만큼씩 나눠 보여준다: 펼칠 때 이 쪽의 책만 도서관에 조회하므로 요청 수도 이만큼으로 묶인다. */
const WATCH_PAGE_SIZE = 5

/**
 * 찜 목록의 한 줄. 두 종류가 한 목록에 섞여 있다: 도서관에서 빌려보고 싶은 책('watch')과 내 서재에서 읽는 중인
 * 책('reading'). 글자로 구분해 붙이지 않고 오른쪽 칸(대출 상태 / 읽은 %)과 아이콘으로만 구분한다.
 */
interface Entry {
  kind: 'watch' | 'reading'
  book: Book
  /** 최신순 정렬 기준(찜한 시각 / 마지막으로 읽은 정도를 바꾼 시각) */
  at: number
}

type BookStatus =
  | { state: 'loading' }
  | { state: 'available'; library: string }
  | { state: 'onLoan' }
  | { state: 'notHeld' }
  | { state: 'error' }

/**
 * 찜 목록. 찜한 책은 서재에서 빠져 여기에만 있다. 조회는 **펼쳤을 때만** 한다 — 찜 5권 × 자주 가는 도서관
 * 수만큼 요청이 나가므로, 서재에 들어왔다고 미리 보내지 않는다. 책을 누르면 도서관별 소장을 보고,
 * 하트를 누르면 찜을 풀어 서재로 돌려보낸다(흐려지며 사라질 뿐 날아가지 않는다).
 */
export function WatchlistSummary() {
  const { watchlist, favorites, books } = useApp()
  const [expanded, setExpanded] = createSignal(false)
  const [bump, setBump] = createSignal(false)
  const [statuses, setStatuses] = createSignal<Record<string, BookStatus>>({})

  // 빌려보고 싶은 책 + 읽는 중인 책. 가장 최근 것이 맨 앞(첫 쪽)에 오게 한다.
  const entries = createMemo<Entry[]>(() =>
    [
      ...watchlist.items().map((item): Entry => ({ kind: 'watch', book: item, at: item.watchedAt })),
      ...books()
        .filter(isReading)
        .map((book): Entry => ({ kind: 'reading', book, at: book.updatedAt ?? book.addedAt })),
    ].sort((a, b) => b.at - a.at),
  )
  const newestFirst = entries
  const [page, setPage] = createSignal(1)
  const pageCount = () => Math.max(1, Math.ceil(newestFirst().length / WATCH_PAGE_SIZE))
  const shown = createMemo(() =>
    newestFirst().slice((page() - 1) * WATCH_PAGE_SIZE, page() * WATCH_PAGE_SIZE),
  )
  // 찜을 풀어 쪽 수가 줄면 마지막 쪽으로 당긴다.
  createEffect(() => {
    if (page() > pageCount()) setPage(pageCount())
  })
  const favs = () => favorites.favorites()

  // 찜이 늘면 머리를 살짝 튕겨서 책이 여기로 들어왔음을 알린다.
  createEffect(
    on(
      () => entries().length,
      (count, prev) => {
        if (prev === undefined || count <= prev) return
        setBump(true)
        const timer = setTimeout(() => setBump(false), 500)
        onCleanup(() => clearTimeout(timer))
      },
    ),
  )

  // 조회 재실행 키 (찜한 도서 집합 + 자주 가는 도서관 집합이 바뀔 때만).
  // `on`으로 이 키와 펼침 여부만 추적한다. 그냥 두면 아래에서 읽는 statuses까지
  // 의존이 되어 응답이 올 때마다 조회가 다시 돈다.
  const lookupBooks = () => shown().filter((e) => e.kind === 'watch').map((e) => e.book)
  const key = () =>
    `${lookupBooks().map((b) => b.id).join(',')}|${favs().map((f) => f.libCode).join(',')}`

  // 접었다 펴거나 찜이 바뀌어 조회가 겹칠 수 있다. 가장 최근 조회의 결과만 반영한다.
  // (접을 때 조회를 취소하지 않는다: 이미 나간 요청은 캐시에 남아 다시 펼 때 쓰인다.)
  let run = 0

  createEffect(
    on([key, expanded], ([, open]) => {
      if (!open) return
      // eslint-disable-next-line solid/reactivity -- 이 효과가 돌 때의 쪽을 한 번 읽어 쓴다(쪽이 바뀌면 효과가 다시 돈다).
      const list = lookupBooks()
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

  return (
    <Show
      when={entries().length > 0}
      // 찜이 아직 없을 때도 '날아갈 곳'을 표시해 둔다(첫 찜이 들어갈 자리).
      fallback={<div class="watchlist-anchor" data-watch-target />}
    >
      <section class="watchlist" classList={{ 'watchlist--bump': bump() }}>
        <button
          class="watchlist__header"
          data-watch-target
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded()}
        >
          <span class="watchlist__title">
            <Heart size={12} fill="currentColor" aria-hidden />
            찜 목록 {entries().length}권
          </span>
          <span class="watchlist__chevron" aria-hidden>
            <Show when={expanded()} fallback={<ChevronDown size={14} />}>
              <ChevronUp size={14} />
            </Show>
          </span>
        </button>

        <Show when={expanded()}>
          <ul class="watchlist__list">
            <Show when={favs().length === 0}>
              <li class="watchlist__hint">
                <A href="/nearby">주변 도서관</A>에서 자주 가는 도서관을 먼저
                등록하면 대출 가능 여부를 볼 수 있어요.
              </li>
            </Show>
            <For each={shown()}>
              {(entry) => (
                <WatchRow
                  book={entry.book}
                  reading={entry.kind === 'reading'}
                  status={
                    entry.kind === 'watch' && favs().length > 0
                      ? statuses()[entry.book.id]
                      : undefined
                  }
                />
              )}
            </For>
          </ul>
          <Pagination
            page={page()}
            pageCount={pageCount()}
            onChange={setPage}
            label="찜 목록 페이지"
          />
          <PushToggle />
        </Show>
      </section>
    </Show>
  )
}

/**
 * 한 줄: 누르면 도서관별 소장을 본다. 빌려보고 싶은 책은 '샀어요'(소장으로 옮기기)와 하트(찜 풀기)가 있고,
 * 읽는 중인 책은 대출 상태 대신 읽은 %가 보인다.
 */
function WatchRow(props: { book: Book; status?: BookStatus; reading?: boolean }) {
  const { watchlist, setOwned } = useApp()
  const { holdings, favoritesCount, lookup, reset } = useFavoriteHoldings(
    () => props.book.isbn13,
  )
  const [open, setOpen] = createSignal(false)
  const [leaving, setLeaving] = createSignal(false)
  let row!: HTMLLIElement

  const toggle = () => {
    if (open()) {
      setOpen(false)
      reset()
    } else {
      setOpen(true)
      lookup()
    }
  }

  const unwatch = async () => {
    if (leaving()) return
    setLeaving(true)
    await fadeOut(row)
    await watchlist.unwatch(props.book.id)
  }

  // 사서 내 서재에 꽂았다: 빌릴 필요가 없으니 찜에서 빠지고 서재의 소장 책이 된다.
  const own = async () => {
    if (leaving()) return
    setLeaving(true)
    await fadeOut(row)
    await setOwned(props.book.id, true)
  }

  return (
    <li class="watchlist__item" ref={row}>
      <div class="watchlist__row">
        <button
          class="watchlist__book"
          onClick={toggle}
          disabled={!props.book.isbn13}
          aria-expanded={open()}
          title={props.book.isbn13 ? '눌러서 자주 가는 도서관 소장 확인' : 'ISBN이 없어 조회할 수 없어요'}
        >
          <span class="watchlist__book-title">{props.book.title}</span>
          <span class="watchlist__book-meta">
            {[props.book.author, props.book.pubDate?.slice(0, 4)].filter(Boolean).join(' · ')}
          </span>
        </button>
        {/* 상태가 없어도 칸은 비워 둬서(격자) 아이콘이 항상 같은 열에 선다 */}
        <Show
          when={!props.reading}
          fallback={<span class="badge">{props.book.progress}%</span>}
        >
          <Show when={props.status} fallback={<span />}>
            {(status) => <StatusLabel status={status()} />}
          </Show>
        </Show>
        <Show
          when={!props.reading}
          fallback={
            <span class="watchlist__mark" title="읽는 중" aria-label="읽는 중">
              <BookOpen size={14} aria-hidden />
            </span>
          }
        >
          <button
            class="icon-button"
            onClick={() => void own()}
            disabled={leaving()}
            aria-label={`${props.book.title} 샀어요(내 서재로)`}
            title="샀어요: 내 서재에 꽂힌 책으로 옮기기"
          >
            <ShelfIcon size={14} />
          </button>
        </Show>
        <Show when={!props.reading} fallback={<span />}>
          <button
            class="icon-button"
            onClick={() => void unwatch()}
            disabled={leaving()}
            aria-label={`${props.book.title} 찜 해제`}
            title="찜 풀기(서재로 돌아가요)"
          >
            <Heart size={14} fill="currentColor" />
          </button>
        </Show>
      </div>
      <Show when={open()}>
        <FavoriteHoldingsPanel
          holdings={holdings()}
          favoritesCount={favoritesCount()}
          isbn13={props.book.isbn13}
        />
      </Show>
    </li>
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
      {/* 조회 중에는 글자 대신 스피너만(스크린리더에는 '확인 중'으로 읽힌다) */}
      <Show when={state() !== 'loading'} fallback={<Spinner label="확인 중" />}>
        {STATUS_LABEL[state()]}
      </Show>
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
