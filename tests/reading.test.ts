import { describe, expect, test } from 'bun:test'
import { clampProgress, isReading } from '../src/lib/reading'
import type { Book } from '../src/types/book'

const book = (extra: Partial<Book>): Book => ({ id: 'a', title: 'a', addedAt: 1, ...extra })

describe('isReading', () => {
  test('소장했고 1~99%면 읽는 중', () => {
    expect(isReading(book({ owned: true, progress: 1 }))).toBe(true)
    expect(isReading(book({ owned: true, progress: 99 }))).toBe(true)
  })

  test('안 읽었거나(0·없음) 다 읽었거나(100) 소장하지 않았으면 아니다', () => {
    expect(isReading(book({ owned: true }))).toBe(false)
    expect(isReading(book({ owned: true, progress: 0 }))).toBe(false)
    expect(isReading(book({ owned: true, progress: 100 }))).toBe(false)
    expect(isReading(book({ progress: 50 }))).toBe(false)
  })
})

describe('clampProgress', () => {
  test('0~100 정수로 맞춘다', () => {
    expect(clampProgress(-3)).toBe(0)
    expect(clampProgress(101)).toBe(100)
    expect(clampProgress(41.5)).toBe(42)
    expect(clampProgress(Number.NaN)).toBe(0)
  })
})
