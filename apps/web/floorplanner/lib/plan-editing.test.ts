import test from 'node:test'
import assert from 'node:assert/strict'
import type { BackgroundImage, PlanStructure, Point, TableObject } from '../domain/types'
import { connectedRooms, joinWalls, mergeDetection, referenceError, splitWall, syncImportedRooms, validRoom, wallEnds, wallFromEnds } from './plan-editing'
import { computeRoomBounds, isPointInRoom } from '../domain/room-contour'
import { getRoomZones } from '../domain/room-numbering'
import { validateDocumentSlice } from './document-schema'
import { DEFAULT_SETTINGS } from './defaults'
import { structurePolygon } from './plan-structure'
import { warningsModule } from '../domain/warnings.impl'
import { buildSVG } from './export'

const wall = (id: string, a: Point, b: Point): PlanStructure => wallFromEnds({ id, kind: 'wall', x: 0, y: 0, width: 1000, height: 4, rotation: 0, source: 'auto' }, a, b)
const vertices = [{ x: 20, y: 20 }, { x: 420, y: 20 }, { x: 420, y: 320 }, { x: 20, y: 320 }]
const walls = vertices.map((p, i) => wall('w' + i, p, vertices[(i + 1) % 4]))
const image: BackgroundImage = { id: 'image' as never, name: 'Venue', dataUrl: '', x: 10, y: 20, width: 1000, height: 800, opacity: 0, locked: true, visible: true, order: 0, plan: { sourceWidth: 500, sourceHeight: 400, calibrated: true, structures: walls, rooms: [{ id: 'hall', label: 'Main hall', vertices }], calibration: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, inches: 200 }, verification: { start: { x: 0, y: 0 }, end: { x: 0, y: 100 }, inches: 200 } } }

test('builds closed loops but refuses gaps, crossing boundaries, and branching walls', () => {
  assert.equal(connectedRooms(walls, 5).length, 1)
  assert.equal(connectedRooms(walls.slice(0, 3), 5).length, 0)
  assert.equal(connectedRooms([...walls, wall('branch', vertices[0], { x: 0, y: 0 })], 5).length, 0)
  assert.equal(validRoom([vertices[0], vertices[2], vertices[1], vertices[3]]), false)
})
test('wall split and join preserve endpoints; door gaps remain excluded after detection', () => {
  const split = splitWall(walls[0])
  assert.deepEqual(wallEnds(joinWalls(split[0], split[1], 5)), wallEnds(walls[0]))
  const gap = splitWall(walls[0], .5, 36)
  assert.ok(Math.abs(wallEnds(gap[1])[0].x - wallEnds(gap[0])[1].x - 36) < .00001)
  assert.equal(mergeDetection([{ ...walls[0], id: 'new-detection', source: 'auto' }], gap, [walls[0]]).length, 2)
  assert.throws(() => splitWall(walls[0], .01, 36))
  assert.throws(() => joinWalls(walls[0], walls[1], 5))
})
test('imported room IDs stay stable and geometry follows page movement and deletion', () => {
  const room = syncImportedRooms(null, { image })!
  assert.equal(getRoomZones(room)[0].id, 'image:hall')
  assert.equal(isPointInRoom(room, { x: 100, y: 100 }), true)
  assert.equal(isPointInRoom(room, { x: 900, y: 700 }), false)
  const moved = syncImportedRooms(room, { image: { ...image, x: 110 } })!
  assert.equal(computeRoomBounds(moved)!.x, computeRoomBounds(room)!.x + 100)
  assert.equal(getRoomZones(moved)[0].id, 'image:hall')
  assert.equal(getRoomZones(syncImportedRooms(moved, {})).length, 0)
})
test('calibration, room geometry, exclusions, round pillars and door symbols survive backup validation', () => {
  const enriched = { ...image, plan: { ...image.plan!, rejected: walls, structures: [...walls, { ...walls[0], id: 'round', kind: 'pillar' as const, shape: 'ellipse' as const, width: 20, height: 20 }], openings: [{ id: 'exit', kind: 'exit' as const, start: { x: 150, y: 20 }, end: { x: 186, y: 20 }, swing: 'left' as const }] } }
  const room = syncImportedRooms(null, { image: enriched })
  const parsed = validateDocumentSlice(JSON.parse(JSON.stringify({ tables: {}, rows: {}, sections: {}, vendors: {}, vendorAssignments: {}, room, doors: {}, settings: DEFAULT_SETTINGS, backgroundImages: { image: enriched } })))
  assert.deepEqual(parsed.room, { ...room, circles: undefined, roomLabels: undefined })
  assert.deepEqual(parsed.backgroundImages.image.plan, enriched.plan)
  assert.equal(referenceError(image.plan!.verification!, 2), 0)
  assert.ok(referenceError(image.plan!.verification!, 2.1) > 4)
  assert.equal(structurePolygon(enriched, enriched.plan.structures.at(-1)!).length, 32)
  const output = buildSVG([], {}, {}, {}, room, [], { colorMode: 'bw', showVendorNames: false, showPaymentStatus: false, title: 'Venue' }, { image: enriched })
  assert.ok(output.svg.includes('<polyline'))
})
test('imported boundaries and openings participate in placement warnings', () => {
  const withDoor = { ...image, plan: { ...image.plan!, openings: [{ id: 'exit', kind: 'exit' as const, start: { x: 100, y: 20 }, end: { x: 136, y: 20 }, swing: 'left' as const }] } }
  const tables = [{ id: 'outside', label: '1', x: 950, y: 750, width: 20, height: 20, rotation: 0 }, { id: 'blocked', label: '2', x: 220, y: 70, width: 20, height: 20, rotation: 0 }] as TableObject[]
  const result = warningsModule.computeWarnings(tables, [], [], DEFAULT_SETTINGS, false, syncImportedRooms(null, { image }), [withDoor])
  assert.ok(result.warnings.some(w => w.type === 'out-of-bounds' && w.tableId === 'outside'))
  assert.ok(result.warnings.some(w => w.type === 'door-blocked' && w.blockingTableIds.includes('blocked')))
})
