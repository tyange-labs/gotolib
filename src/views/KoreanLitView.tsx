import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { useApp } from '../context/appContext'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { NovelRow } from '../components/NovelRow'
import { useBookInfo } from '../hooks/useBookInfo'
import type { NovelsProgress } from '../hooks/useKoreanNovels'
import { TARGET_PUBLISHERS, classifyWithAladin } from '../lib/novelClassify'
import type { NovelCandidate } from '../types/novel'

const PAGE_SIZE = 20
const ALL_PUBLISHERS = '전체 출판사'

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

interface Props {
  novels: NovelCandidate[]
  years: readonly string[]
  year: string
  onYearChange: (year: string) => void
  /** 해별 권수(한 번이라도 캐시된 해만). 칩에 보여준다 */
  yearCounts: ReadonlyMap<string, number>
  ready: boolean
  progress: NovelsProgress
  error: string | null
  onRefresh: () => void
}

/** '한국문학' 탭: 전자책으로 나온 한국 장편소설을 연도별로 모아 보여준다(2000년~올해) */
export function KoreanLitView(props: Props) {
  const { books } = useApp()
  const shelfIds = createMemo(() => new Set(books().map((book) => book.id)))

  const [query, setQuery] = createSignal('')
  const [publisher, setPublisher] = createSignal(ALL_PUBLISHERS)

  const searched = createMemo(() => {
    // filter 콜백은 이 memo 본문 안에서 동기적으로 실행되므로 매번 다시 계산된다(useBookFilter와 같은 패턴).
    /* eslint-disable solid/reactivity */
    const term = normalize(query())
    const selectedPublisher = publisher()
    /* eslint-enable solid/reactivity */
    return props.novels
      .filter((novel) => selectedPublisher === ALL_PUBLISHERS || novel.publisher === selectedPublisher)
      .filter((novel) => !term || normalize(`${novel.title} ${novel.author ?? ''}`).includes(term))
      .sort((a, b) => (b.pubDate ?? '').localeCompare(a.pubDate ?? ''))
  })

  // 검색·출판사로 좁힌 후보 전체(지금 쪼으로 보이는 20개가 아니라)의 알라딘 정보를 물어서,
  // '소설 아님'으로 확정된 건 목록에서 아예 뺀다 — "한국문학 & 소설만 추릴 것".
  const aladinOf = useBookInfo(() => searched().map((novel) => ({ isbn: novel.id, pubDate: novel.pubDate })))

  const filtered = createMemo(() =>
    searched().filter((novel) => classifyWithAladin(novel, null, aladinOf(novel.id)) !== '소설 아님'),
  )

  const [page, setPage] = createSignal(1)
  // 연도를 바꾸면(처음 마운트될 때는 말고) 이전 쪽 번호가 그대로 남지 않게 1쪽으로 되돌린다.
  createEffect(
    on(
      () => props.year,
      () => setPage(1),
      { defer: true },
    ),
  )
  const pageCount = () => Math.max(1, Math.ceil(filtered().length / PAGE_SIZE))
  const pageItems = createMemo(() => {
    const start = (Math.min(page(), pageCount()) - 1) * PAGE_SIZE
    return filtered().slice(start, start + PAGE_SIZE)
  })

  const publisherCounts = createMemo(() => {
    const counts = new Map<string, number>()
    for (const novel of props.novels) counts.set(novel.publisher, (counts.get(novel.publisher) ?? 0) + 1)
    return counts
  })

  return (
    <div>
      <p class="message">
        국립중앙도서관 서지정보로 모은 17개 문학 출판사의 전자책 중 한국 장편소설 후보예요(연도별로 모아요).
        아직 알라딘·쪽수로 확인이 안 된 책은 '확인 필요'로 표시돼요.{' '}
        <button class="text-button" onClick={() => props.onRefresh()}>
          새로고침
        </button>
      </p>

      <Show when={props.error}>{(message) => <p class="message message--error">{message()}</p>}</Show>

      <div class="year-chips">
        <div class="seg" role="group" aria-label="연도">
          <For each={props.years}>
            {(y) => (
              <button class="seg__item" aria-pressed={y === props.year} onClick={() => props.onYearChange(y)}>
                {y}
                <Show when={props.yearCounts.get(y) != null}>{` (${props.yearCounts.get(y)})`}</Show>
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={props.progress.total > 0 && props.progress.done < props.progress.total}>
        <p class="message">
          {props.year}년 모으는 중… {props.progress.done}/{props.progress.total}
          <Show when={props.progress.label}>{(label) => ` (${label()})`}</Show>
        </p>
      </Show>

      <div class="toolbar">
        <SearchBar value={query()} onChange={setQuery} placeholder="제목·저자로 찾기" />
        <div class="filter">
          <select
            class="filter__select"
            aria-label="출판사"
            value={publisher()}
            onChange={(e) => setPublisher(e.currentTarget.value)}
          >
            <option value={ALL_PUBLISHERS}>전체 출판사</option>
            <For each={TARGET_PUBLISHERS}>
              {(name) => (
                <option value={name}>
                  {name} ({publisherCounts().get(name) ?? 0})
                </option>
              )}
            </For>
          </select>
        </div>
      </div>

      <Show
        when={filtered().length > 0}
        fallback={
          <p class="message">
            {props.ready ? '조건에 맞는 책이 없어요.' : '불러오는 중…'}
          </p>
        }
      >
        <div class="list-header">
          <span class="list-header__count">{filtered().length}권</span>
        </div>
        <ul class="search-results">
          <For each={pageItems()}>
            {(novel) => <NovelRow novel={novel} inShelf={shelfIds().has(novel.id)} aladin={aladinOf(novel.id)} />}
          </For>
        </ul>
        <Pagination page={page()} pageCount={pageCount()} onChange={setPage} />
      </Show>
    </div>
  )
}
