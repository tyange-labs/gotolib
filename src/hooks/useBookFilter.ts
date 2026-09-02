import { createMemo, createSignal } from 'solid-js'
import { kdcLabel } from '../lib/kdc'
import type { Book } from '../types/book'

export const ALL_CLASSES = '전체'

/** 비교용 정규화: 소문자 + 공백 제거 (검색어/대상 양쪽에 동일 적용) */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

export function useBookFilter(books: () => Book[]) {
  const [kdcClass, setKdcClass] = createSignal<string>(ALL_CLASSES)
  const [query, setQuery] = createSignal('')

  const filtered = createMemo(() => {
    // 어절 단위로 나눈 뒤 각 어절을 정규화 → 모두 포함(AND)하는 책만 통과.
    // solid/reactivity 오탐: filter 콜백은 이 memo 본문 안에서 동기적으로
    // 실행되므로 terms/selected는 memo가 다시 돌 때마다 새로 계산된다.
    /* eslint-disable solid/reactivity */
    const terms = query().split(/\s+/).map(normalize).filter(Boolean)
    const selected = kdcClass()
    /* eslint-enable solid/reactivity */

    return books().filter((book) => {
      if (selected !== ALL_CLASSES && kdcLabel(book) !== selected) return false
      if (terms.length === 0) return true
      const haystack = normalize(
        `${book.title} ${book.author ?? ''} ${book.publisher ?? ''}`,
      )
      return terms.every((term) => haystack.includes(term))
    })
  })

  return { kdcClass, setKdcClass, query, setQuery, filtered }
}
