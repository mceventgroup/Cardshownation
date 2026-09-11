import type { BackgroundImage, PlanStructure, Point } from '../domain/types'
import type { PixelImage } from './floorplan-detection'

/** Explicit units only. Bare drawing numbers are not assumed to be dimensions. */
export function parsePlanDimension(value: string): number | null {
  const s = value.trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″“”]/g, '"').replace(/[½¼¾⅛⅜⅝⅞]/g, c => ' ' + ({ '½': '1/2', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' }[c]))
  const amount = (text: string): number => {
    const m = text.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/)
    if (m) return Number(m[3]) > 0 ? Number(m[1] || 0) + Number(m[2]) / Number(m[3]) : NaN
    return /^\d+(?:\.\d+)?$/.test(text.trim()) ? Number(text) : NaN
  }
  const feet = s.match(/^(.+?)\s*(?:ft|feet|')\s*(?:-?\s*(.+?)\s*(?:in|inches|"))?$/)
  const single = s.match(/^(.+?)\s*(mm|cm|m|in|inches|")$/)
  const result = feet ? amount(feet[1]) * 12 + (feet[2] ? amount(feet[2]) : 0) : single ? amount(single[1]) * ({ mm: 1 / 25.4, cm: 1 / 2.54, m: 100 / 2.54, in: 1, inches: 1, '"': 1 }[single[2]]!) : NaN
  return Number.isFinite(result) && result > 0 ? result : null
}

export function scaleFromReference(start: Point, end: Point, inches: number): number {
  const pixels = Math.hypot(end.x - start.x, end.y - start.y)
  if (!Number.isFinite(inches) || inches <= 0 || !Number.isFinite(pixels) || pixels < 5) throw new Error('Select two different endpoints at least 5 pixels apart and enter a positive distance.')
  return inches / pixels
}

/** Conservative raster candidates, never table objects. Review before importing. */
export function detectPlanStructures(image: PixelImage, contrast: 'standard' | 'faint' = 'standard'): PlanStructure[] {
  const { width: w, height: h, data } = image
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 100 && data[i * 4] * .2126 + data[i * 4 + 1] * .7152 + data[i * 4 + 2] * .0722 < (contrast === 'faint' ? 190 : 110) ? 1 : 0
  const candidates: PlanStructure[] = []
  const minRun = Math.max(50, Math.max(w, h) * .16)
  for (const vertical of [false, true]) {
    const across = vertical ? h : w, rows = vertical ? w : h
    const runs: { start: number; end: number; row: number; thickness: number }[] = []
    for (let row = 0; row < rows; row++) {
      for (let x = 0; x < across;) {
        if (!mask[vertical ? x * w + row : row * w + x]) { x++; continue }
        const start = x
        while (x < across && mask[vertical ? x * w + row : row * w + x]) x++
        if (x - start < minRun) continue
        const prior = runs.findLast(r => r.row + r.thickness === row && Math.abs(r.start - start) <= 3 && Math.abs(r.end - x) <= 3)
        if (prior) prior.thickness++
        else runs.push({ start, end: x, row, thickness: 1 })
      }
    }
    for (const r of runs) {
      if (r.thickness > Math.min(w, h) * .07) continue
      candidates.push({ id: `wall-${candidates.length}`, kind: 'wall', x: vertical ? r.row : r.start, y: vertical ? r.start : r.row, width: vertical ? r.thickness : r.end - r.start, height: vertical ? r.end - r.start : r.thickness, rotation: 0, source: 'auto' })
    }
  }
  // Solid isolated compact marks are column candidates; outline furniture is excluded.
  const visited = new Uint8Array(mask.length), queue = new Int32Array(mask.length)
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue
    let head = 0, tail = 1, minX = w, minY = h, maxX = 0, maxY = 0
    queue[0] = start; visited[start] = 1
    while (head < tail) {
      const p = queue[head++], x = p % w, y = Math.floor(p / w)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      for (const n of [x > 0 ? p - 1 : -1, x + 1 < w ? p + 1 : -1, y > 0 ? p - w : -1, y + 1 < h ? p + w : -1]) {
        if (n >= 0 && mask[n] && !visited[n]) { visited[n] = 1; queue[tail++] = n }
      }
    }
    const width = maxX - minX + 1, height = maxY - minY + 1
    if (width >= 6 && height >= 6 && Math.max(width, height) < Math.min(w, h) * .06 && width / height > .65 && width / height < 1.55 && tail / (width * height) > .7) candidates.push({ id: `pillar-${candidates.length}`, kind: 'pillar', x: minX, y: minY, width, height, rotation: 0, source: 'auto' })
  }
  return candidates.slice(0, 500)
}

export function structurePolygon(image: BackgroundImage, item: PlanStructure): Point[] {
  const sx = image.width / (image.plan?.sourceWidth || image.width), sy = image.height / (image.plan?.sourceHeight || image.height)
  const angle = item.rotation * Math.PI / 180
  const vertices = item.shape === 'ellipse' ? Array.from({ length: 32 }, (_, i) => [item.width / 2 + Math.cos(i / 32 * Math.PI * 2) * item.width / 2, item.height / 2 + Math.sin(i / 32 * Math.PI * 2) * item.height / 2]) : [[0, 0], [item.width, 0], [item.width, item.height], [0, item.height]]
  return vertices.map(([x, y]) => ({ x: image.x + (item.x + x * Math.cos(angle) - y * Math.sin(angle)) * sx, y: image.y + (item.y + x * Math.sin(angle) + y * Math.cos(angle)) * sy }))
}

export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length]
    const axis = { x: -(q.y - p.y), y: q.x - p.x }
    const aa = a.map(v => v.x * axis.x + v.y * axis.y), bb = b.map(v => v.x * axis.x + v.y * axis.y)
    if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) return false
  }
  return true
}
