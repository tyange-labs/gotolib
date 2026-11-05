import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { useApp } from '../context/appContext'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { NovelRow } from '../components/NovelRow'
import { useBookInfo } from '../hooks/useBookInfo'
import type { NovelsProgress } from '../hooks/useKoreanNovels'
import { TARGET_PUBLISHERS, publisherMatches } from '../lib/novelClassify'
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
  ready: boolean
  progress: NovelsProgress
  error: string | null
  onRefresh: () => void
}

/**
 * '한국문학' 탭: NL 서지로 모은 17개 출판사 전자책 후보 중 **YES24가 "한국 장편소설"로 분류한 책만** 연도별로
 * 보여준다(2000년~올해). 장편 판정은 YES24 분류 하나로 한다 — 청소년·장르소설·소설집·시집·굿즈는 YES24가 이
 * 분류에 넣지 않아서 자연히 빠진다.
 */
export function KoreanLitView(props: Props) {
  const { books } = useApp()
  const shelfIds = createMemo(() => new Set(books().map((book) => book.id)))

  const [query, setQuery] = createSignal('')
  const [publisher, setPublisher] = createSignal(ALL_PUBLISHERS)

  // 이 해의 후보 전체(지금 쪽의 20권만이 아니라)를 서버에 물어 YES24 분류를 받는다.
  const bookInfoOf = useBookInfo(() => props.novels.map((novel) => ({ isbn: novel.id, pubDate: novel.pubDate })))

  const yes24Novels = createMemo(() =>
    props.novels
      .filter((novel) => bookInfoOf(novel.id)?.yes24Form === '장편')
      .sort((a, b) => (b.pubDate ?? '').localeCompare(a.pubDate ?? '')),
  )

  const filtered = createMemo(() => {
    // filter 콜백은 이 memo 본문 안에서 동기적으로 실행되므로 매번 다시 계산된다(useBookFilter와 같은 패턴).
    /* eslint-disable solid/reactivity */
    const term = normalize(query())
    const selectedPublisher = publisher()
    /* eslint-enable solid/reactivity */
    return yes24Novels()
      .filter((novel) => selectedPublisher === ALL_PUBLISHERS || publisherMatches(novel.publisher, selectedPublisher))
      .filter((novel) => !term || normalize(`${novel.title} ${novel.author ?? ''}`).includes(term))
  })

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

  // 출판사 표기는 "(주)창비"·"(주식회사)창비"처럼 제각각이라 이름이 같은지가 아니라 publisherMatches로 센다.
  const publisherCounts = createMemo(() => {
    const counts = new Map<string, number>()
    for (const name of TARGET_PUBLISHERS) {
      counts.set(name, yes24Novels().filter((novel) => publisherMatches(novel.publisher, name)).length)
    }
    return counts
  })

  return (
    <div>
      <p class="message">
        17개 문학 출판사의 전자책 중 YES24가 '한국 장편소설'로 분류한 책이에요(연도별로 모아요). YES24 분류는 서버가
        옛 연도까지 차례로 모으는 중이라, 오래된 해는 아직 비어 있을 수 있어요.{' '}
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
            {(novel) => <NovelRow novel={novel} inShelf={shelfIds().has(novel.id)} />}
          </For>
        </ul>
        <Pagination page={page()} pageCount={pageCount()} onChange={setPage} />
      </Show>
    </div>
  )
}
