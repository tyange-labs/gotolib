import { useCallback, useEffect, useState } from 'react'
import { SAMPLE_BOOKS } from '../data/sampleBooks'
import { clearBooks, deleteBook, getAllBooks, saveBooks } from '../lib/db'
import { ParseError, parseAladinExport } from '../lib/parseAladin'
import type { Book } from '../types/book'

interface ImportResult {
  imported: number
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 저장된 도서가 없어 데모 샘플을 보여주는 중인지 (포트폴리오용, 비영속)
  const [isSample, setIsSample] = useState(false)

  useEffect(() => {
    getAllBooks()
      .then((stored) => {
        if (stored.length === 0) {
          setBooks(SAMPLE_BOOKS)
          setIsSample(true)
        } else {
          setBooks(stored)
        }
      })
      .catch(() => setError('저장된 도서 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const importFile = useCallback(async (file: File): Promise<ImportResult | null> => {
    setError(null)
    try {
      const parsed = parseAladinExport(await file.arrayBuffer())
      await saveBooks(parsed)
      setBooks(await getAllBooks())
      setIsSample(false)
      return { imported: parsed.length }
    } catch (e) {
      setError(
        e instanceof ParseError
          ? e.message
          : '파일을 읽는 중 오류가 발생했습니다.',
      )
      return null
    }
  }, [])

  const removeBook = useCallback(
    async (id: string) => {
      if (!isSample) await deleteBook(id)
      setBooks((prev) => prev.filter((book) => book.id !== id))
    },
    [isSample],
  )

  const clearAll = useCallback(async () => {
    await clearBooks()
    // 모두 지우면 다시 데모 샘플로 되돌아간다
    setBooks(SAMPLE_BOOKS)
    setIsSample(true)
  }, [])

  return { books, loading, error, isSample, importFile, removeBook, clearAll }
}
