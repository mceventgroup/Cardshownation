import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { useEditorStore } from './index'
import { buildSectionRenumberChanges } from '../domain/room-numbering'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { validateDocumentSlice } from '../lib/document-schema'
import type { DocumentSlice } from '../lib/persistence'
import type { SectionId, TableId, TableObject } from '../domain/types'

const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
before(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  } })
})
after(() => {
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

function document(): DocumentSlice {
  const tables = Object.fromEntries([[20, 20], [120, 20], [120, 120], [20, 120]].map(([x, y], index) => {
    const id = `t${index}` as TableId
    const table: TableObject = { id, x, y, width: 20, height: 20, rotation: 0, roomId: 'R1', tableNumber: index + 1,
      displayId: `A0${index + 1}`, label: `A0${index + 1}`, labelOverridden: false, shape: 'rectangle', rowId: null,
      sectionId: 'a' as SectionId, order: index, premium: false }
    return [id, table]
  }))
  return { tables, sections: { a: { id: 'a' as SectionId, name: 'Section A', color: '#000000', order: 0 }, b: { id: 'b' as SectionId, name: 'Section B', color: '#ffffff', order: 1 } },
    room: null, rows: {}, vendors: {}, vendorAssignments: {}, doors: {}, backgroundImages: {}, settings: { ...DEFAULT_SETTINGS } }
}

test('explicit section direction survives dispatch, cosmetic edits, undo/redo and reopening', () => {
  const original = document()
  useEditorStore.getState().loadDocumentSlice(original)
  const changes = buildSectionRenumberChanges(original.tables, original.sections, 'a', 'ccw')
  useEditorStore.getState().dispatch({ type: 'RENUMBER', scope: 'section', scopeId: 'a' as SectionId, changes, timestamp: 1 })
  const numbered = useEditorStore.getState().tables
  assert.deepEqual(Object.values(numbered).map(table => table.displayId), ['A01', 'A04', 'A03', 'A02'])
  useEditorStore.getState().dispatch({ type: 'UPDATE_SECTION', sectionId: 'a' as SectionId, prev: { color: '#000000' }, next: { color: '#ff0000' }, timestamp: 2 })
  assert.deepEqual(useEditorStore.getState().tables, numbered)
  useEditorStore.getState().undo()
  useEditorStore.getState().undo()
  assert.deepEqual(useEditorStore.getState().tables, original.tables)
  useEditorStore.getState().redo()
  assert.deepEqual(useEditorStore.getState().tables, numbered)
  useEditorStore.getState().loadDocumentSlice({ ...original, tables: numbered })
  assert.deepEqual(useEditorStore.getState().tables, numbered)
})

test('section assignment, rename, unassignment and deletion restore every label with undo/redo', () => {
  const original = document()
  useEditorStore.getState().loadDocumentSlice(original)
  useEditorStore.getState().dispatch({ type: 'ASSIGN_TO_SECTION', tableIds: ['t1' as TableId], prevSectionIds: ['a' as SectionId], nextSectionId: 'b' as SectionId, timestamp: 1 })
  const assigned = useEditorStore.getState().tables
  assert.deepEqual(Object.values(assigned).map(table => table.displayId), ['A01', 'B01', 'A02', 'A03'])
  useEditorStore.getState().undo()
  assert.deepEqual(useEditorStore.getState().tables, original.tables)
  useEditorStore.getState().redo()
  assert.deepEqual(useEditorStore.getState().tables, assigned)
  useEditorStore.getState().dispatch({ type: 'UPDATE_SECTION', sectionId: 'b' as SectionId, prev: { name: 'Section B' }, next: { name: 'Section C' }, timestamp: 2 })
  assert.equal(useEditorStore.getState().tables.t1.displayId, 'C01')
  useEditorStore.getState().undo()
  assert.deepEqual(useEditorStore.getState().tables, assigned)
  useEditorStore.getState().dispatch({ type: 'DELETE_SECTION', section: original.sections.b, affectedTableIds: ['t1' as TableId], timestamp: 3 })
  assert.equal(useEditorStore.getState().tables.t1.displayId, '1')
  useEditorStore.getState().undo()
  assert.deepEqual(useEditorStore.getState().tables, assigned)
})

test('placing a table replays its automatic numbering and restores neighboring tables', () => {
  const original = document()
  useEditorStore.getState().loadDocumentSlice(original)
  useEditorStore.getState().dispatch({ type: 'PLACE_TABLE', table: { ...original.tables.t0, id: 'new' as TableId, x: 70, label: '99', displayId: '99', tableNumber: 99 }, timestamp: 1 })
  const placed = useEditorStore.getState().tables
  assert.equal(placed.new.displayId, 'A02')
  useEditorStore.getState().undo()
  assert.deepEqual(useEditorStore.getState().tables, original.tables)
  useEditorStore.getState().redo()
  assert.deepEqual(useEditorStore.getState().tables, placed)
})

test('saved section direction survives geometry edits, section rename and backup validation', () => {
  const original = document()
  useEditorStore.getState().loadDocumentSlice(original)
  const changes = buildSectionRenumberChanges(original.tables, original.sections, 'a', 'ccw')
  useEditorStore.getState().dispatch({ type: 'RENUMBER', scope: 'section', scopeId: 'a' as SectionId, direction: 'ccw', changes, timestamp: 1 })
  assert.equal(useEditorStore.getState().sections.a.numberingDirection, 'ccw')
  useEditorStore.getState().undo()
  assert.equal(useEditorStore.getState().sections.a.numberingDirection, undefined)
  useEditorStore.getState().redo()
  const state = useEditorStore.getState()
  const reopened = validateDocumentSlice(JSON.parse(JSON.stringify({ ...original, tables: state.tables, sections: state.sections })))
  useEditorStore.getState().loadDocumentSlice(reopened)
  useEditorStore.getState().dispatch({ type: 'MOVE_TABLES', moves: [{ tableId: 't1' as TableId, prevX: 120, prevY: 20, nextX: 125, nextY: 20 }], timestamp: 2 })
  assert.deepEqual(Object.values(useEditorStore.getState().tables).map(table => table.displayId), ['A01', 'A04', 'A03', 'A02'])
  useEditorStore.getState().dispatch({ type: 'UPDATE_SECTION', sectionId: 'a' as SectionId, prev: { name: 'Section A' }, next: { name: 'Section C' }, timestamp: 3 })
  assert.deepEqual(Object.values(useEditorStore.getState().tables).map(table => table.displayId), ['C01', 'C04', 'C03', 'C02'])
})

test('layout direction applies to unassigned and newly created sections and is undoable', () => {
  const original = document()
  useEditorStore.getState().loadDocumentSlice(original)
  useEditorStore.getState().dispatch({ type: 'RENUMBER', scope: 'layout', scopeId: null, direction: 'rtl', changes: [], timestamp: 1 })
  assert.equal(useEditorStore.getState().settings.numberingDirection, 'rtl')
  useEditorStore.getState().undo()
  assert.equal(useEditorStore.getState().settings.numberingDirection, undefined)
  assert.equal(useEditorStore.getState().sections.a.numberingDirection, undefined)
  useEditorStore.getState().redo()
  useEditorStore.getState().dispatch({ type: 'ASSIGN_TO_SECTION', tableIds: ['t0', 't1', 't2', 't3'] as TableId[], prevSectionIds: ['a', 'a', 'a', 'a'] as SectionId[], nextSectionId: null, timestamp: 2 })
  assert.deepEqual(Object.values(useEditorStore.getState().tables).map(table => table.displayId), ['2', '1', '3', '4'])
  const saved = validateDocumentSlice(JSON.parse(JSON.stringify({ ...original, settings: useEditorStore.getState().settings })))
  assert.equal(saved.settings.numberingDirection, 'rtl')
  assert.throws(() => validateDocumentSlice({ ...original, settings: { ...original.settings, numberingDirection: 'invalid' } }), /numberingDirection/)
})

test('starting tables survive edits and backups, and undo restores the previous start', () => {
  const original = document()
  useEditorStore.getState().loadDocumentSlice(original)
  const startTableId = 't2' as TableId
  const changes = buildSectionRenumberChanges(original.tables, original.sections, 'a', 'cw', null, startTableId)
  useEditorStore.getState().dispatch({ type: 'RENUMBER', scope: 'section', scopeId: 'a' as SectionId, direction: 'cw', startTableId, changes, timestamp: 1 })
  assert.equal(useEditorStore.getState().tables.t2.displayId, 'A01')
  useEditorStore.getState().undo()
  assert.equal(useEditorStore.getState().sections.a.numberingStartTableId, undefined)
  useEditorStore.getState().redo()
  const state = useEditorStore.getState()
  const saved = validateDocumentSlice(JSON.parse(JSON.stringify({ ...original, tables: state.tables, sections: state.sections })))
  useEditorStore.getState().loadDocumentSlice(saved)
  useEditorStore.getState().dispatch({ type: 'MOVE_TABLES', moves: [{ tableId: 't1' as TableId, prevX: 120, prevY: 20, nextX: 125, nextY: 20 }], timestamp: 2 })
  assert.equal(useEditorStore.getState().tables.t2.displayId, 'A01')
  assert.equal(useEditorStore.getState().sections.a.numberingStartTableId, startTableId)
})

test('locking keeps IDs through geometry and section edits, blocks renumbering, and numbers only new tables', () => {
  const original = document()
  useEditorStore.getState().loadDocumentSlice(original)
  useEditorStore.getState().dispatch({ type: 'UPDATE_SETTINGS', prev: { numberingLocked: false }, next: { numberingLocked: true }, timestamp: 1 })
  const lockedHistoryLength = useEditorStore.getState().history.past.length
  useEditorStore.getState().dispatch({ type: 'RENUMBER', scope: 'layout', scopeId: null, direction: 'ccw', changes: buildSectionRenumberChanges(original.tables, original.sections, 'a', 'ccw'), timestamp: 2 })
  assert.equal(useEditorStore.getState().history.past.length, lockedHistoryLength)
  useEditorStore.getState().dispatch({ type: 'MOVE_TABLES', moves: [{ tableId: 't1' as TableId, prevX: 120, prevY: 20, nextX: 0, nextY: 20 }], timestamp: 3 })
  useEditorStore.getState().dispatch({ type: 'ASSIGN_TO_SECTION', tableIds: ['t1' as TableId], prevSectionIds: ['a' as SectionId], nextSectionId: 'b' as SectionId, timestamp: 4 })
  useEditorStore.getState().dispatch({ type: 'UPDATE_SECTION', sectionId: 'a' as SectionId, prev: { name: 'Section A' }, next: { name: 'Section C' }, timestamp: 5 })
  assert.deepEqual(Object.values(useEditorStore.getState().tables).map(table => table.displayId), ['A01', 'A02', 'A03', 'A04'])
  const beforePlacement = useEditorStore.getState().tables
  useEditorStore.getState().dispatch({ type: 'PLACE_TABLES', tables: ['new1', 'new2'].map(id => ({ ...original.tables.t0, id: id as TableId })), timestamp: 6 })
  const placed = useEditorStore.getState().tables
  assert.equal(placed.new1.displayId, 'C01')
  assert.equal(placed.new2.displayId, 'C02')
  useEditorStore.getState().undo()
  assert.deepEqual(useEditorStore.getState().tables, beforePlacement)
  useEditorStore.getState().redo()
  assert.deepEqual(useEditorStore.getState().tables, placed)
  const state = useEditorStore.getState()
  const saved = validateDocumentSlice(JSON.parse(JSON.stringify({ ...original, tables: state.tables, sections: state.sections, settings: state.settings })))
  useEditorStore.getState().loadDocumentSlice(saved)
  assert.equal(useEditorStore.getState().settings.numberingLocked, true)
  useEditorStore.getState().dispatch({ type: 'UPDATE_SETTINGS', prev: { numberingLocked: true }, next: { numberingLocked: false }, timestamp: 7 })
  assert.deepEqual(useEditorStore.getState().tables, placed)
})
