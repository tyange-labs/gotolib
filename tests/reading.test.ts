import { describe, expect, test } from 'bun:test'
import { clampProgress } from '../src/lib/reading'

describe('clampProgress', () => {
  test('0~100 정수로 맞춘다', () => {
    expect(clampProgress(-3)).toBe(0)
    expect(clampProgress(101)).toBe(100)
    expect(clampProgress(41.5)).toBe(42)
    expect(clampProgress(Number.NaN)).toBe(0)
  })
})
