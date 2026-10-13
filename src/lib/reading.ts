/** 읽은 정도를 0~100 정수로 맞춘다. 숫자가 아니면 0. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}
