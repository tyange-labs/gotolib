import { useCallback, useEffect, useState } from 'react'
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

  useEffect(() => {
    getAllBooks()
      .then(setBooks)
      .catch(() => setError('저장된 도서 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const importFile = useCallback(async (file: File): Promise<ImportResult | null> => {
    setError(null)
    try {
      const parsed = parseAladinExport(await file.arrayBuffer())
      await saveBooks(parsed)
      setBooks(await getAllBooks())
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

  const removeBook = useCallback(async (id: string) => {
    await deleteBook(id)
    setBooks((prev) => prev.filter((book) => book.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    await clearBooks()
    setBooks([])
  }, [])

  return { books, loading, error, importFile, removeBook, clearAll }
}
