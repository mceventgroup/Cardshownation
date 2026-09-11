import type { PlanReviewMetadata, PlanRoom, PlanStructure, Point } from '../domain/types'
import { validRoom } from './plan-editing'

function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid drawing metadata.'); return value as Record<string, unknown> }
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid drawing coordinate.'); return value }
function string(value: unknown): string { if (typeof value !== 'string') throw new Error('Invalid drawing label.'); return value }
function point(value: unknown): Point { const p = record(value); return { x: number(p.x), y: number(p.y) } }
function list<T>(value: unknown, parse: (value: unknown) => T, limit = 2000): T[] { if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid drawing list.'); return value.map(parse) }
export function parsePlanRoom(value: unknown): PlanRoom {
  const r = record(value), vertices = list(r.vertices, point, 500)
  if (!validRoom(vertices)) throw new Error('Room boundaries must form a simple closed polygon.')
  return { id: string(r.id), label: string(r.label), vertices }
}
export function parsePlanMetadata(value: unknown): PlanReviewMetadata {
  const p = record(value), result: PlanReviewMetadata = {}
  for (const key of ['calibration', 'verification'] as const) if (p[key] !== undefined) {
    const r = record(p[key]), start = point(r.start), end = point(r.end), inches = number(r.inches)
    if (inches <= 0 || Math.hypot(start.x - end.x, start.y - end.y) < 5) throw new Error('Invalid scale reference.')
    result[key] = { start, end, inches }
  }
  if (p.dimensionLabels !== undefined) result.dimensionLabels = list(p.dimensionLabels, string, 100)
  if (p.contrast !== undefined) { if (p.contrast !== 'standard' && p.contrast !== 'faint') throw new Error('Invalid drawing contrast.'); result.contrast = p.contrast }
  if (p.detectionArea !== undefined) { const a = record(p.detectionArea); result.detectionArea = { x: number(a.x), y: number(a.y), width: number(a.width), height: number(a.height) }; if (result.detectionArea.width <= 0 || result.detectionArea.height <= 0) throw new Error('Invalid detection area.') }
  if (p.rooms !== undefined) result.rooms = list(p.rooms, parsePlanRoom, 100)
  if (p.openings !== undefined) result.openings = list(p.openings, value => {
    const o = record(value)
    if (!['door', 'exit', 'opening'].includes(string(o.kind)) || !['left', 'right'].includes(string(o.swing))) throw new Error('Invalid opening.')
    const start = point(o.start), end = point(o.end)
    if (Math.hypot(start.x - end.x, start.y - end.y) < 1) throw new Error('Invalid opening width.')
    return { id: string(o.id), kind: o.kind as 'door' | 'exit' | 'opening', swing: o.swing as 'left' | 'right', start, end }
  })
  if (p.rejected !== undefined) result.rejected = list(p.rejected, value => {
    const s = record(value)
    if (!['wall', 'pillar'].includes(string(s.kind)) || !['auto', 'manual'].includes(string(s.source))) throw new Error('Invalid rejected mark.')
    const width = number(s.width), height = number(s.height)
    if (width <= 0 || height <= 0) throw new Error('Invalid rejected dimensions.')
    return { id: string(s.id), kind: s.kind, source: s.source, x: number(s.x), y: number(s.y), width, height, rotation: number(s.rotation) } as PlanStructure
  }, 4000)
  return result
}
