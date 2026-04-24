import type { Point } from '@/domain/types'

/** Clamp value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Round value to the nearest multiple of step. */
export function roundTo(value: number, step: number): number {
  if (step === 0) return value
  return Math.round(value / step) * step
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Dot product of two 2D vectors. */
export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by
}
