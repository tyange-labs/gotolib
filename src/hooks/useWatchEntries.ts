import { createMemo } from 'solid-js'
import { useApp } from '../context/appContext'
import { isReading } from '../lib/reading'
import type { Book } from '../types/book'

/**
 * 찜 목록의 한 줄. 두 종류가 한 목록에 섞여 있다: 도서관에서 빌려보고 싶은 책('watch')과 내 서재에서 읽는 중인
 * 책('reading'). 글자로 구분해 붙이지 않고 오른쪽 칸(대출 상태 / 읽은 %)과 아이콘으로만 구분한다.
 */
export interface WatchEntry {
  kind: 'watch' | 'reading'
  book: Book
  /** 최신순 정렬 기준(찜한 시각 / 마지막으로 읽은 정도를 바꾼 시각) */
  at: number
}

/** 빌려보고 싶은 책 + 읽는 중인 책, 가장 최근 것이 맨 앞. 탭의 개수와 찜 목록 화면이 함께 쓴다. */
export function useWatchEntries() {
  const { watchlist, books } = useApp()
  return createMemo<WatchEntry[]>(() =>
    [
      ...watchlist
        .items()
        .map((item): WatchEntry => ({ kind: 'watch', book: item, at: item.watchedAt })),
      ...books()
        .filter(isReading)
        .map((book): WatchEntry => ({ kind: 'reading', book, at: book.updatedAt ?? book.addedAt })),
    ].sort((a, b) => b.at - a.at),
  )
}
