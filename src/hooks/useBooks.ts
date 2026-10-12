import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { SAMPLE_BOOKS } from '../data/sampleBooks'
import {
  clearBooks,
  deleteBook,
  getAllBooks,
  getWatchlist,
  onDbBlocked,
  saveBooks,
  setOwned as storeOwned,
  setProgress as storeProgress,
} from '../lib/db'
import { emitDataApplied, onDataApplied } from '../lib/localEvents'
import { ParseError, parseAladinExport } from '../lib/parseAladin'
import { tourStep } from '../lib/tour'
import type { Book } from '../types/book'

interface ImportResult {
  imported: number
  /** 그중 서재·찜에 없던 새 책 수 */
  added: number
}

export function useBooks() {
  const [stored, setStored] = createSignal<Book[]>([])
  const [hasWatched, setHasWatched] = createSignal(false)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  // 내 책이 하나도 없다(서재도 찜 목록도 비었다)
  const isEmpty = () => stored().length === 0 && !hasWatched()
  // 샘플은 첫 실행 안내(튜토리얼)가 도는 동안에만 보여준다. 안내가 끝나면 사라지고 빈 서재 안내가 나온다.
  const books = createMemo(() =>
    isEmpty() && tourStep() !== null ? SAMPLE_BOOKS : stored(),
  )

  const load = () =>
    Promise.all([getAllBooks(), getWatchlist()])
      .then(([books, watched]) => {
        setError(null)
        setStored(books)
        setHasWatched(watched.length > 0)
      })
      .catch(() => setError('저장된 도서 목록을 불러오지 못했습니다.'))

  onMount(() => {
    void load().finally(() => setLoading(false))
    // 구버전을 연 다른 탭이 저장소를 쥐고 있으면 열기가 끝나지 않는다: 멈춘 채로 두지 않고 이유를 알린다.
    // (그 탭을 닫으면 열기가 이어지고 load가 끝나며 이 안내는 저절로 사라진다.)
    onCleanup(
      onDbBlocked(() => {
        setError('다른 탭에서 gotolib이 열려 있어 업데이트를 마치지 못했어요. 다른 gotolib 탭을 닫아 주세요.')
        setLoading(false)
      }),
    )
    // 다른 기기의 변경이 동기화로 들어오면 다시 읽는다.
    onCleanup(onDataApplied(() => void load()))
  })

  const importFile = async (file: File): Promise<ImportResult | null> => {
    setError(null)
    try {
      const parsed = parseAladinExport(await file.arrayBuffer())
      // 이미 서재나 찜에 있는 책은 '새로 추가'로 세지 않는다(같은 파일을 다시 불러와도 늘 '추가됐다'고 나오던 문제).
      const [existing, watched] = await Promise.all([getAllBooks(), getWatchlist()])
      const known = new Set([...existing, ...watched].map((book) => book.id))
      const added = parsed.filter((book) => !known.has(book.id)).length
      await saveBooks(parsed)
      await load()
      return { imported: parsed.length, added }
    } catch (e) {
      setError(
        e instanceof ParseError
          ? e.message
          : '파일을 읽는 중 오류가 발생했습니다.',
      )
      return null
    }
  }

  /** 검색 등으로 책 한 권을 서재에 담는다. */
  const addBook = async (book: Book) => {
    await saveBooks([book])
    await load()
  }

  const removeBook = async (id: string) => {
    await deleteBook(id)
    await load()
  }

  /**
   * 소장 표시를 바꾼다. 찜에 있던 책을 소장하면 찜에서 서재로 옮겨지므로, 서재와 찜 목록이 함께 다시 읽게 알린다.
   */
  const setOwned = async (id: string, owned: boolean) => {
    await storeOwned(id, owned)
    emitDataApplied()
  }

  /** 읽은 정도(0~100%). 슬라이더에서 손을 뗄 때 저장한다. */
  const setProgress = async (id: string, progress: number) => {
    await storeProgress(id, progress)
    emitDataApplied()
  }

  const clearAll = async () => {
    await clearBooks()
    await load()
  }

  return {
    books,
    loading,
    error,
    isEmpty,
    importFile,
    addBook,
    removeBook,
    setOwned,
    setProgress,
    clearAll,
  }
}
