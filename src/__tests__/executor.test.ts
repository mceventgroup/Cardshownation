import { applyCommand, reverseCommand } from '@/store/executor'
import type { MutableCanvasState } from '@/store/executor'
import type {
  TableObject, TableId, RowId, SectionId, VendorAssignment,
  VendorAssignmentId, VendorId, LayoutId, ImportSessionId, DoorId, Door,
} from '@/domain/types'
import type {
  PlaceTableCommand, MoveTablesCommand, DeleteTablesCommand,
  AssignVendorCommand, ClearVendorAssignmentCommand, ApplyImportCommand,
  PlaceDoorCommand, DeleteDoorCommand,
} from '@/domain/commands'
import { DEFAULT_SETTINGS } from '@/lib/defaults'

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyState(): MutableCanvasState {
  return {
    tables: {},
    rows: {},
    sections: {},
    vendorAssignments: {},
    room: null,
    doors: {},
    settings: { ...DEFAULT_SETTINGS },
  }
}

function makeTable(id: string, label: string): TableObject {
  return {
    id: id as TableId, x: 100, y: 200, width: 72, height: 30,
    rotation: 0, shape: 'rectangle', label, labelOverridden: false,
    rowId: null as RowId | null, sectionId: null as SectionId | null, order: 0,
  }
}

function makeAssignment(id: string, tableId: string, name: string): VendorAssignment {
  return {
    id: id as VendorAssignmentId, tableId: tableId as TableId,
    layoutId: 'layout-1' as LayoutId, vendorId: `v-${name}` as VendorId,
    vendorName: name, vendorCategory: null, colorOverride: null,
    notes: null, paymentStatus: 'unknown', importSessionId: null,
  }
}

const ts = Date.now()

// ── PLACE_TABLE / undo ──────────────────────────────────────────────────────

describe('PLACE_TABLE', () => {
  it('adds then removes table', () => {
    const state = emptyState()
    const table = makeTable('t1', '1')
    const cmd: PlaceTableCommand = { type: 'PLACE_TABLE', table, timestamp: ts }

    applyCommand(state, cmd)
    expect(state.tables['t1']).toBeDefined()
    expect(state.tables['t1'].label).toBe('1')

    reverseCommand(state, cmd)
    expect(state.tables['t1']).toBeUndefined()
  })
})

// ── MOVE_TABLES / undo ──────────────────────────────────────────────────────

describe('MOVE_TABLES', () => {
  it('moves then restores positions', () => {
    const state = emptyState()
    state.tables['t1'] = makeTable('t1', '1')

    const cmd: MoveTablesCommand = {
      type: 'MOVE_TABLES', timestamp: ts,
      moves: [{ tableId: 't1' as TableId, prevX: 100, prevY: 200, nextX: 300, nextY: 400 }],
    }

    applyCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(300)
    expect(state.tables['t1'].y).toBe(400)

    reverseCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(100)
    expect(state.tables['t1'].y).toBe(200)
  })
})

// ── DELETE_TABLES / undo ────────────────────────────────────────────────────

describe('DELETE_TABLES', () => {
  it('deletes tables and assignments, then restores them', () => {
    const state = emptyState()
    const table = makeTable('t1', '1')
    state.tables['t1'] = table
    const assignment = makeAssignment('a1', 't1', 'Acme')
    state.vendorAssignments['a1'] = assignment

    const cmd: DeleteTablesCommand = {
      type: 'DELETE_TABLES', timestamp: ts,
      tables: [table], affectedAssignments: [assignment],
    }

    applyCommand(state, cmd)
    expect(state.tables['t1']).toBeUndefined()
    expect(state.vendorAssignments['a1']).toBeUndefined()

    reverseCommand(state, cmd)
    expect(state.tables['t1']).toBeDefined()
    expect(state.vendorAssignments['a1']).toBeDefined()
    expect(state.vendorAssignments['a1'].vendorName).toBe('Acme')
  })
})

// ── ASSIGN_VENDOR / undo ────────────────────────────────────────────────────

describe('ASSIGN_VENDOR', () => {
  it('assigns then removes vendor', () => {
    const state = emptyState()
    state.tables['t1'] = makeTable('t1', '1')
    const assignment = makeAssignment('a1', 't1', 'Acme')

    const cmd: AssignVendorCommand = {
      type: 'ASSIGN_VENDOR', timestamp: ts,
      assignment, prevAssignment: null,
    }

    applyCommand(state, cmd)
    expect(state.vendorAssignments['a1']).toBeDefined()

    reverseCommand(state, cmd)
    expect(state.vendorAssignments['a1']).toBeUndefined()
  })

  it('replaces then restores previous assignment', () => {
    const state = emptyState()
    state.tables['t1'] = makeTable('t1', '1')
    const oldAssignment = makeAssignment('a1', 't1', 'OldVendor')
    state.vendorAssignments['a1'] = oldAssignment

    const newAssignment = makeAssignment('a2', 't1', 'NewVendor')
    const cmd: AssignVendorCommand = {
      type: 'ASSIGN_VENDOR', timestamp: ts,
      assignment: newAssignment, prevAssignment: oldAssignment,
    }

    applyCommand(state, cmd)
    expect(state.vendorAssignments['a1']).toBeUndefined()
    expect(state.vendorAssignments['a2'].vendorName).toBe('NewVendor')

    reverseCommand(state, cmd)
    expect(state.vendorAssignments['a2']).toBeUndefined()
    expect(state.vendorAssignments['a1'].vendorName).toBe('OldVendor')
  })
})

// ── CLEAR_VENDOR_ASSIGNMENT / undo ──────────────────────────────────────────

describe('CLEAR_VENDOR_ASSIGNMENT', () => {
  it('removes then restores assignment', () => {
    const state = emptyState()
    const assignment = makeAssignment('a1', 't1', 'Acme')
    state.vendorAssignments['a1'] = assignment

    const cmd: ClearVendorAssignmentCommand = {
      type: 'CLEAR_VENDOR_ASSIGNMENT', timestamp: ts, assignment,
    }

    applyCommand(state, cmd)
    expect(state.vendorAssignments['a1']).toBeUndefined()

    reverseCommand(state, cmd)
    expect(state.vendorAssignments['a1']).toBeDefined()
  })
})

// ── APPLY_IMPORT / undo ─────────────────────────────────────────────────────

describe('APPLY_IMPORT', () => {
  it('applies import (replace + create) then reverses cleanly', () => {
    const state = emptyState()
    const oldAssignment = makeAssignment('a-old', 't1', 'OldVendor')
    state.vendorAssignments['a-old'] = oldAssignment

    const newAssignment1 = makeAssignment('a-new1', 't1', 'ImportedVendor1')
    const newAssignment2 = makeAssignment('a-new2', 't2', 'ImportedVendor2')

    const cmd: ApplyImportCommand = {
      type: 'APPLY_IMPORT', timestamp: ts,
      importSessionId: 'sess-1' as ImportSessionId,
      replacedAssignments: [oldAssignment],
      createdAssignments: [newAssignment1, newAssignment2],
    }

    applyCommand(state, cmd)
    expect(state.vendorAssignments['a-old']).toBeUndefined()
    expect(state.vendorAssignments['a-new1'].vendorName).toBe('ImportedVendor1')
    expect(state.vendorAssignments['a-new2'].vendorName).toBe('ImportedVendor2')

    reverseCommand(state, cmd)
    expect(state.vendorAssignments['a-new1']).toBeUndefined()
    expect(state.vendorAssignments['a-new2']).toBeUndefined()
    expect(state.vendorAssignments['a-old'].vendorName).toBe('OldVendor')
  })
})

// ── PLACE_DOOR / DELETE_DOOR / undo ─────────────────────────────────────────

describe('Door commands', () => {
  const door: Door = {
    id: 'd1' as DoorId, label: 'Main', x: 100, y: 0, width: 48, side: 'top',
  }

  it('places then removes door', () => {
    const state = emptyState()
    const cmd: PlaceDoorCommand = { type: 'PLACE_DOOR', timestamp: ts, door }

    applyCommand(state, cmd)
    expect(state.doors['d1']).toBeDefined()

    reverseCommand(state, cmd)
    expect(state.doors['d1']).toBeUndefined()
  })

  it('deletes then restores door', () => {
    const state = emptyState()
    state.doors['d1'] = { ...door }

    const cmd: DeleteDoorCommand = { type: 'DELETE_DOOR', timestamp: ts, door }

    applyCommand(state, cmd)
    expect(state.doors['d1']).toBeUndefined()

    reverseCommand(state, cmd)
    expect(state.doors['d1']).toBeDefined()
    expect(state.doors['d1'].label).toBe('Main')
  })
})
