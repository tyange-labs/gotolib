import type { Book } from '../types/book'

/** 읽은 정도를 0~100 정수로 맞춘다. 숫자가 아니면 0. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** 읽는 중인 책: 소장했고 1~99% 읽었다. 이런 책은 찜 목록에 '빌려보고 싶은 책'과 함께 보인다. */
export function isReading(book: Book): boolean {
  return book.owned === true && (book.progress ?? 0) > 0 && (book.progress ?? 0) < 100
}
