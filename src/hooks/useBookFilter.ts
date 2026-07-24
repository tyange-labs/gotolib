import { useMemo, useState } from 'react'
import { kdcLabel } from '../lib/kdc'
import type { Book } from '../types/book'

export const ALL_CLASSES = '전체'

/** 비교용 정규화: 소문자 + 공백 제거 (검색어/대상 양쪽에 동일 적용) */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

export function useBookFilter(books: Book[]) {
  const [kdcClass, setKdcClass] = useState<string>(ALL_CLASSES)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    // 어절 단위로 나눈 뒤 각 어절을 정규화 → 모두 포함(AND)하는 책만 통과
    const terms = query.split(/\s+/).map(normalize).filter(Boolean)

    return books.filter((book) => {
      if (kdcClass !== ALL_CLASSES && kdcLabel(book) !== kdcClass) return false
      if (terms.length === 0) return true
      const haystack = normalize(
        `${book.title} ${book.author ?? ''} ${book.publisher ?? ''}`,
      )
      return terms.every((term) => haystack.includes(term))
    })
  }, [books, kdcClass, query])

  return { kdcClass, setKdcClass, query, setQuery, filtered }
}
