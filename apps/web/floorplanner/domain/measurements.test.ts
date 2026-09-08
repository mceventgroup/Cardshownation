import test from 'node:test'
import assert from 'node:assert/strict'
import { measurementEnd, formatMeasurement, snapMeasurementPoint } from './measurements'
import { validateDocumentSlice } from '../lib/document-schema'
import { extractDocumentSlice } from '../lib/persistence'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { applyCommand, reverseCommand } from '../store/executor'

test('exact reference marks use feet converted to inches and constrain direction', () => {
  const start = { x: 10, y: 20 }
  const end = measurementEnd(start, { x: 12, y: 40 }, 240, true)
  assert.deepEqual(end, { x: 10, y: 260 })
  assert.equal(formatMeasurement(start, end), '20′')
  assert.equal(formatMeasurement(start, { x: 58, y: 20 }), '4′')
  assert.equal(formatMeasurement(start, { x: 64, y: 20 }), '4′ 6″')
})

test('measurements snap to wall edges and remain unsnapped outside tolerance', () => {
  const room = { segments: [{ id: 'room' as never, x: 0, y: 0, width: 400, height: 400 }], freehandVertices: null }
  assert.deepEqual(snapMeasurementPoint({ x: 4, y: 80 }, room, [], 12), { x: 0, y: 80 })
  assert.deepEqual(snapMeasurementPoint({ x: 40, y: 80 }, room, [], 12), { x: 40, y: 80 })
})

test('measurement annotations round-trip, undo, redo, and old documents load empty', () => {
  const doc = { tables: {}, rows: {}, sections: {}, vendors: {}, vendorAssignments: {}, room: null, doors: {}, backgroundImages: {}, settings: DEFAULT_SETTINGS }
  const state = validateDocumentSlice(doc)
  assert.deepEqual(state.measurements, {})
  const next = { mark: { id: 'mark', start: { x: 0, y: 0 }, end: { x: 0, y: 240 } } }
  const command = { type: 'UPDATE_MEASUREMENTS' as const, prev: {}, next, timestamp: 0 }
  applyCommand(state, command)
  assert.deepEqual(validateDocumentSlice(JSON.parse(JSON.stringify(extractDocumentSlice(state)))).measurements, next)
  reverseCommand(state, command)
  assert.deepEqual(state.measurements, {})
  applyCommand(state, command)
  assert.deepEqual(state.measurements, next)
  assert.throws(() => validateDocumentSlice({ ...doc, measurements: { bad: { id: 'bad', start: { x: NaN, y: 0 }, end: { x: 0, y: 0 } } } }))
})
