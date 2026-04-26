import { applyCommand, reverseCommand, type MutableCanvasState } from '../executor'
import type { TableObject } from '@/domain/types'
import type { LayoutCommand } from '@/domain/commands'

function makeState(tables: Record<string, TableObject>): MutableCanvasState {
  return { tables, rows: {}, sections: {}, vendorAssignments: {}, room: null, doors: {}, settings: { canvasWidth: 6000, canvasHeight: 4800, gridSize: 6, snapToGrid: true, snapToObjects: false, minAisleWidth: 36, doorClearance: 48, wallSetback: 36, showWallSetback: false, defaultTableWidth: 72, defaultTableHeight: 30, defaultTableShape: 'rectangle', unitLabel: 'in' } }
}

function makeTable(id: string, overrides: Partial<TableObject> = {}): TableObject {
  return {
    id:              id as any,
    x:               0,
    y:               0,
    width:           60,
    height:          30,
    rotation:        0,
    shape:           'rectangle',
    label:           '1',
    labelOverridden: false,
    rowId:           null,
    sectionId:       null,
    order:           0,
    premium:         false,
    ...overrides,
  }
}

describe('executor — PLACE_TABLE', () => {
  it('apply adds the table', () => {
    const state = makeState({})
    const table = makeTable('t1')
    applyCommand(state, { type: 'PLACE_TABLE', table, timestamp: 0 })
    expect(state.tables['t1']).toEqual(table)
  })

  it('reverse removes the table', () => {
    const table = makeTable('t1')
    const state = makeState({ t1: table })
    reverseCommand(state, { type: 'PLACE_TABLE', table, timestamp: 0 })
    expect(state.tables['t1']).toBeUndefined()
  })
})

describe('executor — MOVE_TABLES', () => {
  it('apply moves tables to next position', () => {
    const table = makeTable('t1', { x: 0, y: 0 })
    const state = makeState({ t1: { ...table } })
    const cmd: LayoutCommand = {
      type: 'MOVE_TABLES',
      moves: [{ tableId: 't1' as any, prevX: 0, prevY: 0, nextX: 100, nextY: 50 }],
      timestamp: 0,
    }
    applyCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(100)
    expect(state.tables['t1'].y).toBe(50)
  })

  it('reverse restores previous position', () => {
    const table = makeTable('t1', { x: 100, y: 50 })
    const state = makeState({ t1: { ...table } })
    const cmd: LayoutCommand = {
      type: 'MOVE_TABLES',
      moves: [{ tableId: 't1' as any, prevX: 0, prevY: 0, nextX: 100, nextY: 50 }],
      timestamp: 0,
    }
    reverseCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(0)
    expect(state.tables['t1'].y).toBe(0)
  })
})

describe('executor — DELETE_TABLES', () => {
  it('apply removes tables', () => {
    const table = makeTable('t1')
    const state = makeState({ t1: { ...table } })
    applyCommand(state, { type: 'DELETE_TABLES', tables: [table], affectedAssignments: [], timestamp: 0 })
    expect(state.tables['t1']).toBeUndefined()
  })

  it('reverse restores deleted tables', () => {
    const table = makeTable('t1')
    const state = makeState({})
    reverseCommand(state, { type: 'DELETE_TABLES', tables: [table], affectedAssignments: [], timestamp: 0 })
    expect(state.tables['t1']).toEqual(table)
  })
})

describe('executor — RESIZE_TABLE', () => {
  it('apply sets next geometry', () => {
    const table = makeTable('t1', { x: 0, y: 0, width: 60, height: 30 })
    const state = makeState({ t1: { ...table } })
    applyCommand(state, {
      type: 'RESIZE_TABLE',
      tableId: 't1' as any,
      prev: { x: 0, y: 0, width: 60, height: 30 },
      next: { x: 5, y: 5, width: 80, height: 40 },
      timestamp: 0,
    })
    expect(state.tables['t1']).toMatchObject({ x: 5, y: 5, width: 80, height: 40 })
  })

  it('reverse restores prev geometry', () => {
    const table = makeTable('t1', { x: 5, y: 5, width: 80, height: 40 })
    const state = makeState({ t1: { ...table } })
    reverseCommand(state, {
      type: 'RESIZE_TABLE',
      tableId: 't1' as any,
      prev: { x: 0, y: 0, width: 60, height: 30 },
      next: { x: 5, y: 5, width: 80, height: 40 },
      timestamp: 0,
    })
    expect(state.tables['t1']).toMatchObject({ x: 0, y: 0, width: 60, height: 30 })
  })
})

describe('undo/redo integration', () => {
  it('apply then reverse restores original state exactly', () => {
    const table = makeTable('t1', { x: 0, y: 0 })
    const state = makeState({ t1: { ...table } })
    const cmd: LayoutCommand = {
      type: 'MOVE_TABLES',
      moves: [{ tableId: 't1' as any, prevX: 0, prevY: 0, nextX: 100, nextY: 50 }],
      timestamp: 0,
    }
    applyCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(100)
    reverseCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(0)
    expect(state.tables['t1'].y).toBe(0)
  })
})
