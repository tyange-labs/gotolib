import { Search, X } from 'lucide-solid'
import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import { toBook, type SearchResult } from '../lib/bookSearch'
import { LibraryApiError } from '../lib/libraryApi'
import { fetchBookSearch } from '../lib/queries'
import { Spinner } from './Spinner'
import type { Book } from '../types/book'

interface Props {
  /** 지금 서재의 책. 이미 담은 책은 '담김'으로 보여준다 */
  books: Book[]
  onAdd: (book: Book) => Promise<void>
  onClose: () => void
}

/** 국립중앙도서관으로 책을 찾아 서재에 담는다. 검색은 엔터(검색 버튼)를 눌렀을 때만 한다. */
export function BookSearch(props: Props) {
  // Solid의 ref는 변수에 직접 대입된다. 동적으로 들어온 요소는 autofocus가 먹지 않아 직접 포커스한다.
  let field!: HTMLInputElement
  onMount(() => field.focus())

  const [input, setInput] = createSignal('')
  // 실제로 검색한 키워드. 입력 중인 값(input)과 분리해야 '더 보기'가 같은 검색어로 이어진다.
  const [keyword, setKeyword] = createSignal('')
  const [results, setResults] = createSignal<SearchResult[]>([])
  const [total, setTotal] = createSignal(0)
  const [page, setPage] = createSignal(0)
  // 이번 쪽에서 받은 레코드 수. 같은 책의 중복 레코드가 합쳐져 화면 권수보다 많을 수 있어 '더 보기' 판단은 이걸로 한다.
  const [fetched, setFetched] = createSignal(0)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  // 이 화면에서 방금 담은 책(서재 갱신이 오기 전에도 바로 '담김'으로 보이게)
  const [added, setAdded] = createSignal<ReadonlySet<string>>(new Set())

  const shelfIds = createMemo(() => new Set(props.books.map((book) => book.id)))
  const has = (id: string) => shelfIds().has(id) || added().has(id)

  const load = async (word: string, pageNo: number) => {
    setBusy(true)
    setError(null)
    try {
      const result = await fetchBookSearch(word, pageNo)
      setTotal(result.total)
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

  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    const word = input().trim()
    // 키워드 없이 부르면 전체(수백만 건)가 나온다.
    if (!word || busy()) return
    setKeyword(word)
    setResults([])
    setTotal(0)
    setPage(0)
    void load(word, 1)
  }

  const add = async (result: SearchResult) => {
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

  const hasMore = () => page() > 0 && fetched() >= 20 && page() * 20 < total()

  return (
    <section class="book-search" aria-label="책 검색">
      <form class="book-search__form" onSubmit={submit}>
        <Search class="searchbar__icon" size={16} aria-hidden />
        <input
          ref={field}
          class="book-search__input"
          type="search"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          placeholder="제목이나 저자로 검색 (엔터)"
          aria-label="책 검색어"
        />
        <button class="text-button" type="submit" disabled={busy() || !input().trim()}>
          검색
        </button>
        <button
          class="icon-button"
          type="button"
          onClick={() => props.onClose()}
          aria-label="책 검색 닫기"
        >
          <X size={16} />
        </button>
      </form>

      <Show when={error()}>
        {(message) => <p class="message message--error">{message()}</p>}
      </Show>

      <Show when={keyword()}>
        <Show
          when={results().length > 0 || busy()}
          fallback={
            <Show when={!error()}>
              <p class="message">'{keyword()}'에 맞는 책이 없어요.</p>
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
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      <Show when={!result.isbn13}> · ISBN 없음 (소장 조회 불가)</Show>
                    </span>
                  </div>
                  <button
                    class="text-button"
                    classList={{ 'text-button--done': has(result.id) }}
                    onClick={() => void add(result)}
                  >
                    {has(result.id) ? '담김 · 다시 담기' : '추가'}
                  </button>
                </li>
              )}
            </For>
          </ul>

          <div class="search-footer">
            <span class="search-footer__count">
              <Show when={busy()} fallback={`국립중앙도서관 · ${results().length}권 표시`}>
                <span class="inline-loading">
                  <Spinner />
                  검색 중…
                </span>
              </Show>
            </span>
            <Show when={hasMore() && !busy()}>
              <button class="text-button" onClick={() => void load(keyword(), page() + 1)}>
                더 보기
              </button>
            </Show>
          </div>
        </Show>
      </Show>
    </section>
  )
}
