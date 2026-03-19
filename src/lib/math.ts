import type { Point } from '@/domain/types'

/** Rotate point (px, py) around center (cx, cy) by angleDeg degrees. */
export function rotatePoint(px: number, py: number, cx: number, cy: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

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

/** Linear interpolation from a to b by t (0–1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Dot product of two 2D vectors. */
export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by
}
