import { createSignal, onCleanup, onMount } from 'solid-js'
import { SAMPLE_BOOKS } from '../data/sampleBooks'
import { clearBooks, deleteBook, getAllBooks, getWatchlist, onDbBlocked, saveBooks } from '../lib/db'
import { onDataApplied } from '../lib/localEvents'
import { ParseError, parseAladinExport } from '../lib/parseAladin'
import type { Book } from '../types/book'

interface ImportResult {
  imported: number
}

export function useBooks() {
  const [books, setBooks] = createSignal<Book[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  // 저장된 도서가 없어 데모 샘플을 보여주는 중인지 (포트폴리오용, 비영속)
  const [isSample, setIsSample] = createSignal(false)

  const load = () =>
    Promise.all([getAllBooks(), getWatchlist()])
      .then(([stored, watched]) => {
        setError(null)
        const sampleIds = new Set(SAMPLE_BOOKS.map((book) => book.id))
        // 서재가 비어 있고 찜한 책도 샘플뿐이면 아직 내 책이 없는 것 → 샘플을 보여준다(찜한 샘플은 찜 목록에 있으니 뺀다).
        // 찜한 책이 샘플이 아니라면 내 책이 전부 찜 목록으로 간 것이라 샘플을 되살리지 않는다.
        if (stored.length === 0 && watched.every((item) => sampleIds.has(item.id))) {
          const watchedIds = new Set(watched.map((item) => item.id))
          setBooks(SAMPLE_BOOKS.filter((book) => !watchedIds.has(book.id)))
          setIsSample(true)
        } else {
          setBooks(stored)
          setIsSample(false)
        }
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
      await saveBooks(parsed)
      await load()
      return { imported: parsed.length }
    } catch (e) {
      setError(
        e instanceof ParseError
          ? e.message
          : '파일을 읽는 중 오류가 발생했습니다.',
      )
      return null
    }
  }

  /** 검색 등으로 책 한 권을 서재에 담는다. 샘플을 보던 중이면 내 목록으로 바뀐다. */
  const addBook = async (book: Book) => {
    await saveBooks([book])
    await load()
  }

  const removeBook = async (id: string) => {
    if (!isSample()) await deleteBook(id)
    setBooks((prev) => prev.filter((book) => book.id !== id))
  }

  const clearAll = async () => {
    await clearBooks()
    // 찜한 책이 없으면 다시 데모 샘플로 되돌아간다
    await load()
  }

  return {
    books,
    loading,
    error,
    isSample,
    importFile,
    addBook,
    removeBook,
    clearAll,
  }
}
