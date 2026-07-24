import { useEffect, useMemo, useState } from 'react'

export interface Pagination<T> {
  page: number
  pageCount: number
  pageItems: T[]
  /** 현재 페이지의 1-based 시작·끝 인덱스 (요약 표시용) */
  rangeStart: number
  rangeEnd: number
  total: number
  setPage: (page: number) => void
}

export function usePagination<T>(items: T[], pageSize: number): Pagination<T> {
  const [page, setPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  // 항목 수가 줄어 현재 페이지가 범위를 벗어나면 마지막 페이지로 당긴다.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const current = Math.min(page, pageCount)

  const pageItems = useMemo(() => {
    const start = (current - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, current, pageSize])

  const rangeStart = items.length === 0 ? 0 : (current - 1) * pageSize + 1
  const rangeEnd = Math.min(current * pageSize, items.length)

  return {
    page: current,
    pageCount,
    pageItems,
    rangeStart,
    rangeEnd,
    total: items.length,
    setPage,
  }
}
