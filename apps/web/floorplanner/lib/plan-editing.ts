import type { BackgroundImage, CompositeRoom, PlanOpening, PlanReference, PlanStructure, Point } from '../domain/types'

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export function wallEnds(s: PlanStructure): [Point, Point] {
  const a = s.rotation * Math.PI / 180
  const local = s.height > s.width ? [{ x: s.width / 2, y: 0 }, { x: s.width / 2, y: s.height }] : [{ x: 0, y: s.height / 2 }, { x: s.width, y: s.height / 2 }]
  return local.map(p => ({ x: s.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: s.y + p.x * Math.sin(a) + p.y * Math.cos(a) })) as [Point, Point]
}
export function wallFromEnds(s: PlanStructure, start: Point, end: Point): PlanStructure {
  const a = Math.atan2(end.y - start.y, end.x - start.x), thickness = Math.min(s.width, s.height)
  return { ...s, source: 'manual', x: start.x + Math.sin(a) * thickness / 2, y: start.y - Math.cos(a) * thickness / 2, width: distance(start, end), height: thickness, rotation: a * 180 / Math.PI }
}
export function snapPlanPoint(point: Point, structures: PlanStructure[], tolerance: number, excludeId?: string): Point {
  let best = point, nearest = tolerance
  for (const s of structures) if (s.kind === 'wall' && s.id !== excludeId) for (const p of wallEnds(s)) {
    const d = distance(point, p)
    if (d < nearest) { nearest = d; best = p }
  }
  return best
}
export function sameMark(a: PlanStructure, b: PlanStructure): boolean {
  if (a.kind !== b.kind) return false
  const aa = wallEnds(a), bb = wallEnds(b), tolerance = Math.max(5, Math.min(a.width, a.height, b.width, b.height) * 2)
  return Math.min(distance(aa[0], bb[0]) + distance(aa[1], bb[1]), distance(aa[0], bb[1]) + distance(aa[1], bb[0])) < tolerance * 2
}
export function mergeDetection(found: PlanStructure[], current: PlanStructure[], rejected: PlanStructure[] = []): PlanStructure[] {
  const manual = current.filter(s => s.source === 'manual')
  return [...found.filter(s => ![...rejected, ...manual].some(old => sameMark(s, old))), ...manual]
}
export function referenceError(reference: PlanReference, scale: number): number {
  return Math.abs(distance(reference.start, reference.end) * scale / reference.inches - 1) * 100
}
export function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((area, p, i) => { const q = points[(i + 1) % points.length]; return area + p.x * q.y - q.x * p.y }, 0)) / 2
}
export function validRoom(points: Point[]): boolean {
  if (points.length < 3 || polygonArea(points) < 25 || points.some((p, i) => distance(p, points[(i + 1) % points.length]) < 1)) return false
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  for (let i = 0; i < points.length; i++) for (let j = i + 2; j < points.length; j++) {
    if (i === 0 && j === points.length - 1) continue
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length]
    if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0 && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))) return false
  }
  return true
}
/** Only unambiguous closed loops qualify. Branches and gaps require manual review. */
export function connectedRooms(structures: PlanStructure[], tolerance: number): Point[][] {
  const nodes: Point[] = [], edges: number[][] = []
  const node = (p: Point) => { const i = nodes.findIndex(n => distance(n, p) <= tolerance); if (i >= 0) return i; nodes.push(p); return nodes.length - 1 }
  for (const s of structures.filter(s => s.kind === 'wall')) { const [a, b] = wallEnds(s); const from = node(a), to = node(b); if (from !== to) edges.push([from, to]) }
  const neighbors = nodes.map((_, i) => [...new Set(edges.filter(e => e.includes(i)).map(e => e[0] === i ? e[1] : e[0]))])
  const visited = new Set<number>(), result: Point[][] = []
  for (let i = 0; i < nodes.length; i++) {
    if (visited.has(i)) continue
    const component: number[] = [], queue = [i]
    while (queue.length) { const n = queue.pop()!; if (visited.has(n)) continue; visited.add(n); component.push(n); queue.push(...neighbors[n].filter(k => !visited.has(k))) }
    if (component.length < 3 || component.some(n => neighbors[n].length !== 2)) continue
    const loop = [component[0]]; let previous = -1, current = component[0]
    while (loop.length <= component.length) { const next = neighbors[current].find(n => n !== previous)!; if (next === loop[0]) break; loop.push(next); previous = current; current = next }
    const polygon = loop.map(n => nodes[n]); if (validRoom(polygon)) result.push(polygon)
  }
  return result
}
export function splitWall(s: PlanStructure, ratio = .5, gap = 0): PlanStructure[] {
  const [a, b] = wallEnds(s), length = distance(a, b), offset = gap / length / 2
  if (ratio - offset <= .01 || ratio + offset >= .99) throw new Error('The opening must fit within the selected wall.')
  const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  return [wallFromEnds(s, a, at(ratio - offset)), wallFromEnds({ ...s, id: crypto.randomUUID() }, at(ratio + offset), b)]
}
export function joinWalls(a: PlanStructure, b: PlanStructure, tolerance: number): PlanStructure {
  const aa = wallEnds(a), bb = wallEnds(b), candidates = aa.flatMap((p, i) => bb.map((q, j) => ({ i, j, d: distance(p, q) }))).sort((a, b) => a.d - b.d), match = candidates[0]
  const start = aa[1 - match.i], end = bb[1 - match.j], length = distance(start, end)
  const deviation = (p: Point) => Math.abs((end.x - start.x) * (p.y - start.y) - (end.y - start.y) * (p.x - start.x)) / length
  if (a.kind !== 'wall' || b.kind !== 'wall' || match.d > tolerance || length < 1 || deviation(aa[match.i]) > tolerance || deviation(bb[match.j]) > tolerance) throw new Error('Choose two adjoining, straight wall pieces. Corners remain separate walls.')
  return wallFromEnds(a, start, end)
}
export function openingLines(o: PlanOpening): Point[][] {
  if (o.kind === 'opening') return [[o.start, o.end]]
  const dx = o.end.x - o.start.x, dy = o.end.y - o.start.y, sign = o.swing === 'left' ? 1 : -1
  const tip = { x: o.start.x - dy * sign, y: o.start.y + dx * sign }
  const arc = Array.from({ length: 17 }, (_, i) => { const angle = sign * i / 16 * Math.PI / 2; return { x: o.start.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: o.start.y + dx * Math.sin(angle) + dy * Math.cos(angle) } })
  return [[o.start, tip], arc]
}
export function planPoint(image: BackgroundImage, p: Point): Point { return { x: image.x + p.x * image.width / image.plan!.sourceWidth, y: image.y + p.y * image.height / image.plan!.sourceHeight } }
export function syncImportedRooms(room: CompositeRoom | null, images: Record<string, BackgroundImage>): CompositeRoom | null {
  const importedPolygons = Object.values(images).flatMap(image => (image.plan?.rooms || []).map(r => ({ ...r, id: `${image.id}:${r.id}`, sourceImageId: image.id, vertices: r.vertices.map(p => planPoint(image, p)) })))
  if (!room && !importedPolygons.length) return null
  return { ...(room || { segments: [], freehandVertices: null }), importedPolygons }
}
