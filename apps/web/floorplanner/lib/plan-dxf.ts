import type { Point } from '../domain/types'

export interface DxfDrawing { lines: { start: Point; end: Point; layer: string }[]; circles: { center: Point; radius: number; layer: string }[]; inchesPerUnit?: number }
/** Small, explicit 2D interchange subset. Unsupported geometry requires a PDF export. */
export function readPlanDxf(text: string): DxfDrawing {
  if (text.startsWith('AutoCAD Binary DXF')) throw new Error('Binary DXF is not supported. Save an ASCII DXF or export a PDF.')
  const raw = text.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/)
  const pairs: [number, string][] = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    if (!/^\s*\d+\s*$/.test(raw[i])) throw new Error('This DXF could not be read. Export the drawing as a PDF.')
    pairs.push([Number(raw[i]), raw[i + 1].trim()])
  }
  const result: DxfDrawing = { lines: [], circles: [] }
  const unitIndex = pairs.findIndex(([code, value]) => code === 9 && value === '$INSUNITS')
  if (unitIndex >= 0 && pairs[unitIndex + 1]?.[0] === 70) result.inchesPerUnit = ({ 1: 1, 2: 12, 4: 1 / 25.4, 5: 1 / 2.54, 6: 100 / 2.54 } as Record<number, number>)[Number(pairs[unitIndex + 1][1])]
  let entities = false
  for (let i = 0; i < pairs.length; i++) {
    const [code, type] = pairs[i]
    if (code === 2 && type === 'ENTITIES') { entities = true; continue }
    if (code === 0 && type === 'ENDSEC') { entities = false; continue }
    if (!entities || code !== 0) continue
    let end = i + 1
    while (end < pairs.length && pairs[end][0] !== 0) end++
    const fields = pairs.slice(i + 1, end)
    const value = (code: number) => fields.find(p => p[0] === code)?.[1]
    const num = (code: number, fallback?: number) => { const raw = value(code); const n = raw === undefined ? fallback : Number(raw); if (n === undefined || !Number.isFinite(n)) throw new Error('Invalid DXF coordinates. Export a PDF instead.'); return n }
    const layer = value(8) || '0'
    i = end - 1
    if (num(67, 0) === 1 || /furn|table|chair|seat/i.test(layer)) continue
    if (['TEXT', 'MTEXT', 'DIMENSION', 'POINT', 'VIEWPORT'].includes(type)) continue
    if (!['LINE', 'LWPOLYLINE', 'CIRCLE'].includes(type)) throw new Error(`This DXF contains ${type} geometry. Export a PDF, or a flattened 2D DXF containing lines, straight polylines, and circles.`)
    if (num(210, 0) !== 0 || num(220, 0) !== 0 || num(230, 1) !== 1 || num(30, 0) !== 0 || num(31, 0) !== 0 || num(38, 0) !== 0) throw new Error('Use a flat 2D drawing or export a PDF of this CAD view.')
    if (type === 'LINE') result.lines.push({ start: { x: num(10), y: num(20) }, end: { x: num(11), y: num(21) }, layer })
    if (type === 'CIRCLE') { const radius = num(40); if (radius <= 0) throw new Error('Invalid circle radius.'); result.circles.push({ center: { x: num(10), y: num(20) }, radius, layer }) }
    if (type === 'LWPOLYLINE') {
      if (fields.some(([code, value]) => code === 42 && Number(value) !== 0)) throw new Error('This DXF has curved polylines. Export a PDF to preserve the curves.')
      const vertices: Point[] = []
      for (let p = 0; p < fields.length; p++) if (fields[p][0] === 10) {
        const x = Number(fields[p][1]), yPair = fields[p + 1]
        if (yPair?.[0] !== 20 || !Number.isFinite(x) || !Number.isFinite(Number(yPair[1]))) throw new Error('Invalid DXF polyline.')
        vertices.push({ x, y: Number(yPair[1]) })
      }
      for (let p = 1; p < vertices.length; p++) result.lines.push({ start: vertices[p - 1], end: vertices[p], layer })
      if ((num(70, 0) & 1) && vertices.length > 2) result.lines.push({ start: vertices[vertices.length - 1], end: vertices[0], layer })
    }
    if (result.lines.length + result.circles.length > 20000) throw new Error('This CAD drawing is too detailed. Export only the floor-plan layers as PDF.')
  }
  if (!result.lines.length && !result.circles.length) throw new Error('No supported building geometry found. Export the CAD drawing as PDF.')
  return result
}
