import type { Book } from '../types/book'

export const UNCLASSIFIED = '미분류'

/** KDC(한국십진분류법) 주류 — 도서관 서가 분류 그대로 */
export const KDC_MAIN: Record<string, string> = {
  '0': '총류',
  '1': '철학',
  '2': '종교',
  '3': '사회과학',
  '4': '자연과학',
  '5': '기술과학',
  '6': '예술',
  '7': '언어',
  '8': '문학',
  '9': '역사',
}

/** 책의 KDC 주류 라벨. 부가기호가 없어 도출 불가하면 '미분류'. */
export function kdcLabel(book: Book): string {
  return (book.kdc && KDC_MAIN[book.kdc]) ?? UNCLASSIFIED
}

export interface ClassTab {
  label: string
  count: number
}

/**
 * 책 목록의 KDC 주류별 카운트. 도서관 관례대로 주류 번호(0→9) 순으로 정렬하고
 * '미분류'는 맨 뒤에 둔다. 해당 주류가 0권이면 탭에서 제외.
 */
export function buildClassTabs(books: Book[]): ClassTab[] {
  const counts = new Map<string, number>()
  for (const book of books) {
    const key = book.kdc && KDC_MAIN[book.kdc] ? book.kdc : 'x'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const tabs: ClassTab[] = []
  for (let i = 0; i <= 9; i++) {
    const digit = String(i)
    const count = counts.get(digit)
    if (count) tabs.push({ label: KDC_MAIN[digit], count })
  }
  const unclassified = counts.get('x')
  if (unclassified) tabs.push({ label: UNCLASSIFIED, count: unclassified })
  return tabs
}
