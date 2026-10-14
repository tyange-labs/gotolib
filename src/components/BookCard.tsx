import { createQuery } from '@tanstack/solid-query'
import { DropdownMenu } from '@kobalte/core/dropdown-menu'
import { BookOpen, Check, Library, Heart, X } from 'lucide-solid'
import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { useApp } from '../context/appContext'
import { useFavoriteHoldings } from '../hooks/useFavoriteHoldings'
import { WATCHLIST_LIMIT } from '../hooks/useWatchlist'
import { confirmDialog } from '../lib/confirm'
import { flyToWatchlist } from '../lib/motion'
import { pageCountQuery } from '../lib/queries'
import type { Book } from '../types/book'
import { BookCover } from './BookCover'
import { FavoriteHoldingsPanel } from './FavoriteHoldingsPanel'

interface Props {
  book: Book
  /** 서버가 줄여 둔 표지 썸네일 주소(아직 없으면 책 아이콘 칸) */
  coverUrl?: string
  onRemove: (id: string) => void
}

/** 판본이 다른 같은 제목을 구분하려고 발행연도를 보여준다. 알라딘은 '2016-01-15'·'20160115' 꼴이라 앞 4자리만. */
function publishedYear(book: Book): string | undefined {
  return book.pubDate?.match(/^\d{4}/)?.[0]
}

type ReadState = 'todo' | 'reading' | 'done'
const READ_LABEL: Record<ReadState, string> = {
  todo: '안 읽음',
  reading: '읽는 중',
  done: '완독',
}
const READ_PROGRESS: Record<ReadState, number> = {
  todo: 0,
  reading: 1,
  done: 100,
}

// props를 구조분해하면 그 자리에서 값이 읽히고 굳는다. props.book으로 접근한다.
export function BookCard(props: Props) {
  const { watchlist, setOwned, setProgress } = useApp()
  const { holdings, favoritesCount, lookup, reset } = useFavoriteHoldings(() => props.book.isbn13)
  const [open, setOpen] = createSignal(false)
  // 쪽수는 카드가 보일 때 서지정보에서 가져온다(한 번 알면 기기에 남는다). 못 가져오면 그냥 안 보인다.
  const pageCount = createQuery(() => ({
    ...pageCountQuery(props.book.isbn13 ?? ''),
    enabled: !!props.book.isbn13,
  }))
  // 삭제는 되돌릴 수 없어서(다시 가져오기 전까지) 한 번 더 확인한다. 아무것도 안 하면 저절로 닫힌다.
  const [confirming, setConfirming] = createSignal(false)
  createEffect(() => {
    if (!confirming()) return
    const timer = setTimeout(() => setConfirming(false), 5000)
    onCleanup(() => clearTimeout(timer))
  })

  // 찜한 책은 서재에서 빠지므로(찜 목록으로 옮겨진다) 이 카드는 항상 찜하지 않은 책이다.
  const watchDisabled = () => watchlist.isFull()
  const [flying, setFlying] = createSignal(false)

  let item!: HTMLLIElement

  /** 찜 목록으로 날아가며 사라진 뒤 저장소에서 옮긴다. 못 옮기면(한도) 카드를 되돌린다. */
  const watch = async () => {
    if (flying() || watchDisabled()) return
    setFlying(true)
    const { restore } = await flyToWatchlist(item)
    if (!(await watchlist.watch(props.book))) {
      restore()
      setFlying(false)
    }
  }

  const readState = (): ReadState => {
    const saved = props.book.progress ?? 0
    return saved <= 0 ? 'todo' : saved >= 100 ? 'done' : 'reading'
  }

  const toggleOwned = async () => {
    if (props.book.owned && (props.book.progress ?? 0) > 0) {
      const ok = await confirmDialog({
        title: '소장을 해제할까요?',
        description: '읽은 정도 기록이 함께 지워져요.',
        confirmLabel: '해제',
        danger: true,
      })
      if (!ok) return
    }
    await setOwned(props.book.id, !props.book.owned)
  }

  const commitProgress = async (value: number) => {
    await setProgress(props.book.id, value)
  }

  const toggleLookup = () => {
    if (open()) {
      setOpen(false)
      reset()
    } else {
      setOpen(true)
      lookup()
    }
  }

  return (
    <li class="book-card" ref={item}>
      <div class="book-card__row">
        <span class="book-card__cover">
          <BookCover src={props.coverUrl} />
          <Show when={props.book.owned && readState() !== 'todo'}>
            <span
              class="book-card__badge"
              data-state={readState()}
              role="img"
              aria-label={READ_LABEL[readState()]}
            >
              {readState() === 'done' ? (
                <Check size={11} strokeWidth={3} />
              ) : (
                <BookOpen size={11} strokeWidth={2.5} />
              )}
            </span>
          </Show>
        </span>
        <button
          class="book-card__body"
          onClick={toggleLookup}
          disabled={!props.book.isbn13}
          aria-expanded={open()}
          title={
            props.book.isbn13 ? '눌러서 자주 가는 도서관 소장 확인' : 'ISBN이 없어 조회할 수 없어요'
          }
        >
          <span class="book-card__title">{props.book.title}</span>
          <span class="book-card__meta" aria-busy={pageCount.isPending && !!props.book.isbn13}>
            {[
              props.book.author,
              props.book.publisher,
              publishedYear(props.book),
              pageCount.data ? `${pageCount.data}쪽` : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
            <Show when={props.book.isbn13 && pageCount.isPending}>
              <span
                class="skeleton book-card__pages-skeleton"
                role="status"
                aria-label="쪽수 불러오는 중"
              />
            </Show>
          </span>
        </button>
        <div class="book-card__tools">
          <Show
            when={!confirming()}
            fallback={
              <div class="book-card__confirm" role="alert">
                <span>삭제할까요?</span>
                <button
                  class="text-button text-button--danger"
                  onClick={() => props.onRemove(props.book.id)}
                >
                  삭제
                </button>
                <button class="text-button" onClick={() => setConfirming(false)}>
                  취소
                </button>
              </div>
            }
          >
            <Show
              when={props.book.owned}
              fallback={
                <button
                  class="icon-button"
                  onClick={() => void toggleOwned()}
                  aria-pressed={false}
                  aria-label="내 서재에 있는 책"
                  title="내 서재에 꽂힌 책으로 표시"
                >
                  <Library size={16} />
                </button>
              }
            >
              <DropdownMenu placement="bottom-end" gutter={4}>
                <DropdownMenu.Trigger
                  class="icon-button"
                  aria-label={`${props.book.title} 읽기 상태 바꾸기 (지금: ${READ_LABEL[readState()]})`}
                  title="읽기 상태"
                >
                  <Library size={16} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content class="state-menu">
                    <DropdownMenu.RadioGroup
                      value={readState()}
                      onChange={(value) => void commitProgress(READ_PROGRESS[value as ReadState])}
                    >
                      <For each={['todo', 'reading', 'done'] as const}>
                        {(state) => (
                          <DropdownMenu.RadioItem class="state-menu__item" value={state}>
                            <span class="state-menu__check">
                              <DropdownMenu.ItemIndicator>
                                <Check size={12} strokeWidth={3} />
                              </DropdownMenu.ItemIndicator>
                            </span>
                            {READ_LABEL[state]}
                          </DropdownMenu.RadioItem>
                        )}
                      </For>
                    </DropdownMenu.RadioGroup>
                    <DropdownMenu.Separator class="state-menu__sep" />
                    <DropdownMenu.Item
                      class="state-menu__item state-menu__item--quiet"
                      onSelect={() => void toggleOwned()}
                    >
                      <span class="state-menu__check" />
                      소장 해제
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
            </Show>
            {/* 가진 책은 빌릴 필요가 없어서 찜(빌려보고 싶은 책) 버튼을 감춘다 */}
            <Show when={!props.book.owned}>
              <button
                class="icon-button"
                onClick={() => void watch()}
                disabled={watchDisabled() || flying()}
                aria-label="찜 목록에 추가"
                title={
                  watchDisabled()
                    ? `찜 목록은 최대 ${WATCHLIST_LIMIT}권이에요`
                    : '찜 목록으로 옮기기'
                }
              >
                <Heart size={16} fill={flying() ? 'currentColor' : 'none'} />
              </button>
            </Show>
            <button
              class="icon-button"
              onClick={() => setConfirming(true)}
              aria-label={`${props.book.title} 삭제`}
            >
              <X size={16} />
            </button>
          </Show>
        </div>
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
