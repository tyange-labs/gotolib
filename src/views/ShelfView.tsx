import { Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { BookSearch } from '../components/BookSearch'
import { BookList } from '../components/BookList'
import { GenreTabs } from '../components/GenreTabs'
import { ImportDropzone } from '../components/ImportDropzone'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { WatchlistSummary } from '../components/WatchlistSummary'
import { useBookFilter } from '../hooks/useBookFilter'
import { usePagination } from '../hooks/usePagination'
import { buildClassTabs } from '../lib/kdc'
import { tourStep } from '../lib/tour'
import type { Book } from '../types/book'

const PAGE_SIZE = 20

/** '내 서재': 입력으로 서재를 거른다. '책 추가': 엔터로 국립중앙도서관에서 새 책을 찾는다. */
type Mode = 'shelf' | 'add'

interface Props {
  books: Book[]
  onRemove: (id: string) => void
  onClearAll: () => void
  onImport: (file: File) => void
  onAdd: (book: Book) => Promise<void>
}

export function ShelfView(props: Props) {
  const { kdcClass, setKdcClass, query, setQuery, filtered } = useBookFilter(
    () => props.books,
  )
  const classTabs = createMemo(() => buildClassTabs(props.books))
  let top: HTMLDivElement | undefined
  let searchField: HTMLInputElement | undefined

  const { page, pageCount, pageItems, rangeStart, rangeEnd, total, setPage } =
    usePagination(filtered, PAGE_SIZE)

  // 분류·검색이 바뀌면 첫 페이지로 되돌린다.
  // `on`이 없으면 setPage가 읽는 것까지 추적돼 매 페이지 이동마다 1로 되돌아간다.
  createEffect(on([kdcClass, query], () => setPage(1), { defer: true }))

  // 입력창은 하나지만 모드마다 하는 일이 하나뿐이다(palim의 격자·흐름처럼). 서재 필터 글자와 새 책 검색어는 따로 둔다.
  // eslint-disable-next-line solid/reactivity -- 처음 그릴 때의 값만 필요하다(이후는 사용자가 고른다).
  const [mode, setMode] = createSignal<Mode>(props.books.length === 0 ? 'add' : 'shelf')
  const [findInput, setFindInput] = createSignal('')
  // 엔터로 확정한 검색어. 입력 중인 값(findInput)과 나눠야 결과가 입력을 따라 계속 다시 검색되지 않는다.
  const [finding, setFinding] = createSignal<string | null>(null)

  // 책이 다 없어지면(첫 실행 안내가 끝나 샘플이 사라질 때, 비우기 등) 책 추가로 이끈다.
  createEffect(
    on(
      () => props.books.length === 0,
      (empty) => {
        if (empty) setMode('add')
      },
      { defer: true },
    ),
  )
  // 첫 실행 안내가 도는 동안은 샘플 책이 보이는 서재 화면이어야 한다.
  createEffect(
    on(
      () => tourStep() !== null,
      (running) => {
        if (running) setMode('shelf')
      },
    ),
  )

  const switchMode = (next: Mode) => {
    setMode(next)
    // 사용자가 눌러서 바꾼 것이니 바로 입력할 수 있게 한다(책 추가 모드에서만).
    if (next === 'add') queueMicrotask(() => searchField?.focus())
  }

  const find = (word: string) => {
    const trimmed = word.trim()
    if (trimmed) setFinding(trimmed)
  }

  const goToPage = (next: number) => {
    setPage(next)
    top?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <WatchlistSummary />

      <div class="mode-switch">
        <div class="seg" role="group" aria-label="검색 모드">
          <button
            class="seg__item"
            aria-pressed={mode() === 'shelf'}
            onClick={() => switchMode('shelf')}
          >
            내 서재
          </button>
          <button
            class="seg__item"
            aria-pressed={mode() === 'add'}
            onClick={() => switchMode('add')}
          >
            책 추가
          </button>
        </div>
      </div>

      <div class="toolbar">
        <Show
          when={mode() === 'add'}
          fallback={
            <SearchBar
              value={query()}
              onChange={setQuery}
              inputRef={(element) => (searchField = element)}
              placeholder="서재에서 제목·저자·출판사 찾기"
            />
          }
        >
          <SearchBar
            value={findInput()}
            onChange={setFindInput}
            onSubmit={() => find(findInput())}
            submitLabel="찾기"
            inputRef={(element) => (searchField = element)}
            placeholder="제목·저자·ISBN으로 새 책 찾기"
          />
        </Show>
        {/* 분류 탭은 서재를 거를 때만 쓴다 */}
        <Show when={mode() === 'shelf' && props.books.length > 0}>
          <GenreTabs
            tabs={classTabs()}
            total={props.books.length}
            selected={kdcClass()}
            onSelect={setKdcClass}
          />
        </Show>
      </div>

      <Show
        when={mode() === 'shelf'}
        fallback={
          <>
            <Show
              when={finding()}
              fallback={
                <p class="message">
                  {props.books.length === 0
                    ? '아직 담은 책이 없어요. 제목·저자·ISBN을 입력하고 엔터를 눌러 첫 책을 찾아 담아 보세요.'
                    : '제목·저자·ISBN을 입력하고 엔터를 누르면 국립중앙도서관에서 새 책을 찾아요.'}
                </p>
              }
            >
              {(word) => (
                <BookSearch keyword={word()} books={props.books} onAdd={props.onAdd} />
              )}
            </Show>
            <p class="import-hint">
              PC라면 알라딘 보관함 파일을 한꺼번에 가져올 수도 있어요. <ImportDropzone onFile={props.onImport} />
            </p>
          </>
        }
      >
        <Show
          when={props.books.length > 0}
          fallback={
            <p class="message">
              서재가 비어 있어요.{' '}
              <button class="text-button text-button--strong" onClick={() => switchMode('add')}>
                책 추가
              </button>
              에서 찾아 담아 보세요.
            </p>
          }
        >
          <div class="list-header" ref={top}>
            <span class="list-header__count">
              {total() > 0 ? `${total()}권 중 ${rangeStart()}–${rangeEnd()}` : '0권'}
            </span>
            <div class="list-header__actions">
              <button
                class="text-button"
                onClick={() => {
                  if (confirm('저장된 도서 목록을 모두 삭제할까요?')) props.onClearAll()
                }}
              >
                비우기
              </button>
            </div>
          </div>

          <Show
            when={total() > 0}
            fallback={
              <p class="message">
                {query().trim() ? (
                  <>
                    서재에 맞는 책이 없어요.{' '}
                    <button
                      class="text-button text-button--strong"
                      onClick={() => {
                        setFindInput(query().trim())
                        switchMode('add')
                        find(query())
                      }}
                    >
                      ‘{query().trim()}’ 새 책 찾기
                    </button>
                  </>
                ) : (
                  '조건에 맞는 책이 없어요.'
                )}
              </p>
            }
          >
            <BookList books={pageItems()} onRemove={props.onRemove} />
            <Pagination page={page()} pageCount={pageCount()} onChange={goToPage} />
          </Show>
        </Show>
      </Show>
    </div>
  )
}
