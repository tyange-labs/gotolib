import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { useApp } from '../context/appContext'
import { toBook, type SearchResult } from '../lib/bookSearch'
import { LibraryApiError } from '../lib/libraryApi'
import { fetchBookSearch } from '../lib/queries'
import { Spinner } from './Spinner'
import type { Book } from '../types/book'

interface Props {
  /** 검색어. 서재 검색창에서 엔터를 눌러 넘어온다. 바뀌면 처음부터 다시 검색한다 */
  keyword: string
  /** 지금 서재의 책. 이미 담은 책은 '담김'으로 보여준다 */
  books: Book[]
  onAdd: (book: Book) => Promise<void>
}

/** 국립중앙도서관으로 찾은 새 책 목록. 책 추가 모드의 검색창에서 엔터를 누르면 이 결과가 열린다. */
export function BookSearch(props: Props) {
  const [results, setResults] = createSignal<SearchResult[]>([])
  const [page, setPage] = createSignal(0)
  // 이번 쪽에서 받은 레코드 수. 같은 책의 중복 레코드가 합쳐져 화면 권수보다 많을 수 있어 '더 보기' 판단은 이걸로 한다.
  const [fetched, setFetched] = createSignal(0)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  // 이 화면에서 방금 담은 책(서재 갱신이 오기 전에도 바로 '담김'으로 보이게)
  const [added, setAdded] = createSignal<ReadonlySet<string>>(new Set())

  const { watchlist } = useApp()
  const shelfIds = createMemo(() => new Set(props.books.map((book) => book.id)))
  // 찜한 책은 서재에서 빠져 찜 목록에 있다. 둘 다 '이미 담은 책'이다.
  const has = (id: string) => shelfIds().has(id) || watchlist.has(id) || added().has(id)

  const load = async (word: string, pageNo: number) => {
    setBusy(true)
    setError(null)
    try {
      const result = await fetchBookSearch(word, pageNo)
      setPage(pageNo)
      setFetched(result.fetched)
      setResults((prev) => {
        if (pageNo === 1) return result.results
        // 쪽 경계에서 같은 책(ISBN)이 다시 나올 수 있다.
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...result.results.filter((item) => !seen.has(item.id))]
      })
    } catch (e) {
      setError(
        e instanceof LibraryApiError ? e.message : '검색하지 못했어요. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }

  // 검색어가 바뀔 때마다 처음부터 다시 찾는다. 키워드 없이 부르면 전체(수백만 건)가 나오므로 빈 값은 넘어오지 않는다.
  createEffect(
    on(
      () => props.keyword,
      (word) => {
        setResults([])
        setPage(0)
        void load(word, 1)
      },
    ),
  )

  const add = async (result: SearchResult) => {
    // 찜 목록에 있는 책은 다시 담지 않는다(서재와 찜 목록에 같은 책이 있으면 안 된다).
    if (watchlist.has(result.id)) return
    // 이미 서재에 있는 책이면 확인을 받는다. 같은 id로 다시 저장하면 기존 항목이 사라지고 새로 담은 시각(최신순 맨 앞)으로 바뀐다.
    if (
      has(result.id) &&
      !confirm(
        `'${result.title}'은(는) 이미 서재에 있어요.\n기존 항목을 지우고 지금 담은 책으로 다시 등록할까요? (최신순 맨 앞으로 이동해요)`,
      )
    ) {
      return
    }
    setAdded((prev) => new Set(prev).add(result.id))
    try {
      await props.onAdd(toBook(result))
    } catch {
      setAdded((prev) => {
        const next = new Set(prev)
        next.delete(result.id)
        return next
      })
      setError('책을 담지 못했어요.')
    }
  }

  const hasMore = () => page() > 0 && fetched() >= 20

  return (
    <section class="book-search" aria-label="새 책 검색 결과">
      <div class="book-search__head">
        <span class="book-search__title">
          ‘{props.keyword}’ 새 책 검색 <span class="book-search__source">국립중앙도서관</span>
        </span>
      </div>

      <Show when={error()}>
        {(message) => <p class="message message--error">{message()}</p>}
      </Show>

      <Show
        when={results().length > 0 || busy()}
        fallback={
          <Show when={!error()}>
            <p class="message">'{props.keyword}'에 맞는 책이 없어요.</p>
          </Show>
        }
      >
        <ul class="search-results">
          <For each={results()}>
            {(result) => (
              <li class="search-result">
                <div class="search-result__body">
                  <span class="search-result__title">{result.title}</span>
                  <span class="search-result__meta">
                    {[
                      result.author,
                      result.publisher,
                      result.pubDate?.slice(0, 4),
                      result.edition,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <button
                  class="text-button"
                  classList={{ 'text-button--done': has(result.id) }}
                  disabled={watchlist.has(result.id)}
                  onClick={() => void add(result)}
                >
                  {watchlist.has(result.id)
                    ? '찜 목록에 있음'
                    : has(result.id)
                      ? '담김 · 다시 담기'
                      : '추가'}
                </button>
              </li>
            )}
          </For>
        </ul>

        <div class="search-footer">
          <span class="search-footer__count">
            <Show when={busy()} fallback={`${results().length}권 표시`}>
              <span class="inline-loading">
                <Spinner />
                검색 중…
              </span>
            </Show>
          </span>
          <Show when={hasMore() && !busy()}>
            <button class="text-button" onClick={() => void load(props.keyword, page() + 1)}>
              더 보기
            </button>
          </Show>
        </div>
      </Show>
    </section>
  )
}
