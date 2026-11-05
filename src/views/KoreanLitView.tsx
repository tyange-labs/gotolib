import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { A } from '@solidjs/router'
import { KOREAN_GENRES, genrePath, type KoreanGenre } from '../lib/koreanGenres'
import { useApp } from '../context/appContext'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { NovelRow } from '../components/NovelRow'
import type { NovelsProgress } from '../hooks/useKoreanNovels'
import { TARGET_PUBLISHERS, publisherMatches } from '../lib/novelClassify'
import type { KoreanNovel } from '../types/novel'

const PAGE_SIZE = 20
const ALL_PUBLISHERS = '전체 출판사'

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

interface Props {
  genre: KoreanGenre
  /** 서버가 최근 달 순으로 정렬해 준다 */
  novels: KoreanNovel[]
  /** 전자책이 있는 종이책 ISBN(NL 서지) */
  ebookIsbns: ReadonlySet<string>
  years: readonly string[]
  year: string
  onYearChange: (year: string) => void
  ready: boolean
  listError: string | null
  /** 전자책 정보 모으기 진행률 */
  progress: NovelsProgress
  ebookError: string | null
  onRefresh: () => void
}

/**
 * '한국문학' 탭: 서버가 YES24 분류(장르 칩: 장편·단편·시, `koreanGenres.ts`)에서 모은 17개 출판사 **종이책**을
 * 연도별로 보여준다(2000년~올해). 장르 판정은 YES24 분류 하나로 한다 — 청소년·장르소설·굿즈는 YES24가
 * 이 분류들에 넣지 않아서 자연히 빠진다. 전자책 여부는 NL 서지정보 API로 따로 채워 배지로만 보여준다.
 */
export function KoreanLitView(props: Props) {
  const { books } = useApp()
  const shelfIds = createMemo(() => new Set(books().map((book) => book.id)))

  const [query, setQuery] = createSignal('')
  const [publisher, setPublisher] = createSignal(ALL_PUBLISHERS)

  const filtered = createMemo(() => {
    // filter 콜백은 이 memo 본문 안에서 동기적으로 실행되므로 매번 다시 계산된다(useBookFilter와 같은 패턴).
    /* eslint-disable solid/reactivity */
    const term = normalize(query())
    const selectedPublisher = publisher()
    /* eslint-enable solid/reactivity */
    return props.novels
      .filter((novel) => selectedPublisher === ALL_PUBLISHERS || publisherMatches(novel.publisher, selectedPublisher))
      .filter((novel) => !term || normalize(`${novel.title} ${novel.author ?? ''}`).includes(term))
  })

  const [page, setPage] = createSignal(1)
  // 장르·연도를 바꾸면(처음 마운트될 때는 말고) 이전 쪽 번호가 그대로 남지 않게 1쪽으로 되돌린다.
  createEffect(
    on(
      () => [props.genre, props.year],
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
      counts.set(name, props.novels.filter((novel) => publisherMatches(novel.publisher, name)).length)
    }
    return counts
  })

  return (
    <div>
      <nav class="genre-chips" aria-label="장르">
        <For each={KOREAN_GENRES}>
          {(genre) => (
            // 라우터의 A가 주소가 정확히 같을 때 aria-current="page"를 단다 — 선택 표시는 그걸로 한다.
            <A href={genrePath(genre)} class="genre-chip" replace>
              {genre.label}
            </A>
          )}
        </For>
      </nav>

      <p class="message">
        17개 문학 출판사 책 중 YES24가 '{props.genre.yes24Category}'로 분류한 종이책이에요(연도별). 전자책도 나온 책에는
        '전자책'이라고 표시해요.{' '}
        <button class="text-button" onClick={() => props.onRefresh()}>
          새로고침
        </button>
      </p>

      <Show when={props.listError}>{(message) => <p class="message message--error">{message()}</p>}</Show>
      <Show when={props.ebookError}>{(message) => <p class="message">{message()}</p>}</Show>

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
          {props.year}년 전자책 정보 모으는 중… {props.progress.done}/{props.progress.total}
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
            {(novel) => (
              <NovelRow novel={novel} hasEbook={props.ebookIsbns.has(novel.id)} inShelf={shelfIds().has(novel.id)} />
            )}
          </For>
        </ul>
        <Pagination page={page()} pageCount={pageCount()} onChange={setPage} />
      </Show>
    </div>
  )
}
