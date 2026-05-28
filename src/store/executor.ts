// ─────────────────────────────────────────────────────────────────────────────
// COMMAND EXECUTOR
//
// Applies and reverses LayoutCommands against the mutable canvas state.
// Called exclusively from within Zustand immer `set` callbacks — the state
// parameter is an immer draft and can be mutated directly.
//
// Only Phase 1 command types are implemented here.
// Each later phase adds its cases as the store expands.
//
// IMPORTANT: applyCommand must be called with the state BEFORE any mutation.
// The caller (store dispatch) is responsible for reading prevX/prevY etc.
// before invoking dispatch — these values come from the interaction hook
// (pre-commit local drag state), not from the store after the fact.
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Row, Section, Door, CompositeRoom, Vendor, VendorAssignment, LayoutSettings } from '@/domain/types'
import type { LayoutCommand } from '@/domain/commands'

function cloneRoom(room: CompositeRoom): CompositeRoom {
  return {
    segments: room.segments.map(s => ({ ...s })),
    circles: room.circles?.map(circle => ({ ...circle })) ?? [],
    freehandVertices: room.freehandVertices ? room.freehandVertices.map(v => ({ ...v })) : null,
    roomLabels: room.roomLabels ? { ...room.roomLabels } : undefined,
  }
}

/** Object.assign that strips prototype-polluting keys (__proto__, constructor, prototype). */
function safeAssign<T extends object>(target: T, source: Partial<T>): T {
  const blocked = new Set(['__proto__', 'constructor', 'prototype'])
  for (const key of Object.keys(source) as Array<keyof T>) {
    if (!blocked.has(key as string)) {
      const value = source[key]
      if (value !== undefined) {
        target[key] = value
      }
    }
  }
  return target
}

export type MutableCanvasState = {
  tables: Record<string, TableObject>
  rows: Record<string, Row>
  sections: Record<string, Section>
  vendors: Record<string, Vendor>
  vendorAssignments: Record<string, VendorAssignment>
  room: CompositeRoom | null
  doors: Record<string, Door>
  settings: LayoutSettings
}

export function applyCommand(state: MutableCanvasState, command: LayoutCommand): void {
  switch (command.type) {
    case 'PLACE_TABLE': {
      state.tables[command.table.id] = { ...command.table }
      break
    }

    case 'MOVE_TABLES': {
      for (const m of command.moves) {
        const t = state.tables[m.tableId]
        if (t) {
          t.x = m.nextX
          t.y = m.nextY
        }
      }
      break
    }

    case 'RESIZE_TABLE': {
      const t = state.tables[command.tableId]
      if (t) {
        t.x      = command.next.x
        t.y      = command.next.y
        t.width  = command.next.width
        t.height = command.next.height
      }
      break
    }

    case 'ROTATE_TABLES': {
      for (const r of command.rotations) {
        const t = state.tables[r.tableId]
        if (t) t.rotation = r.nextRotation
      }
      break
    }

    case 'SET_TABLE_PREMIUM': {
      for (const id of command.tableIds) {
        const t = state.tables[id]
        if (t) t.premium = command.premium
      }
      break
    }

    case 'DELETE_TABLES': {
      for (const t of command.tables) {
        delete state.tables[t.id]
      }
      for (const a of command.affectedAssignments) {
        delete state.vendorAssignments[a.id]
      }
      break
    }

    case 'RELABEL_TABLE': {
      const t = state.tables[command.tableId]
      if (t) {
        t.label           = command.next.label
        t.labelOverridden = command.next.labelOverridden
      }
      break
    }

    // ── Row commands ──────────────────────────────────────────────────────

    case 'PLACE_ROW': {
      state.rows[command.row.id] = { ...command.row }
      for (const t of command.tables) {
        state.tables[t.id] = { ...t }
      }
      break
    }

    case 'DELETE_ROW': {
      delete state.rows[command.row.id]
      for (const t of command.tables) {
        delete state.tables[t.id]
      }
      for (const a of command.affectedAssignments) {
        delete state.vendorAssignments[a.id]
      }
      break
    }

    // ── Section commands ───────────────────────────────────────────────────

    case 'CREATE_SECTION': {
      state.sections[command.section.id] = { ...command.section }
      break
    }

    case 'UPDATE_SECTION': {
      const sec = state.sections[command.sectionId]
      if (sec) {
        safeAssign(sec, command.next)
      }
      break
    }

    case 'DELETE_SECTION': {
      delete state.sections[command.section.id]
      for (const tableId of command.affectedTableIds) {
        const t = state.tables[tableId]
        if (t) t.sectionId = null
      }
      break
    }

    case 'ASSIGN_TO_SECTION': {
      for (const tableId of command.tableIds) {
        const t = state.tables[tableId]
        if (t) t.sectionId = command.nextSectionId
      }
      break
    }

    // ── Numbering commands ────────────────────────────────────────────────

    case 'RENUMBER': {
      for (const c of command.changes) {
        const t = state.tables[c.tableId]
        if (t) {
          t.label = c.next.label
          t.labelOverridden = c.next.labelOverridden
        }
      }
      break
    }

    // ── Vendor assignment commands ────────────────────────────────────────

    case 'ASSIGN_VENDOR': {
      if (command.prevAssignment) {
        delete state.vendorAssignments[command.prevAssignment.id]
      }
      state.vendorAssignments[command.assignment.id] = { ...command.assignment }
      break
    }

    case 'UPDATE_VENDOR_ASSIGNMENT': {
      const a = state.vendorAssignments[command.assignmentId]
      if (a) safeAssign(a, command.next)
      break
    }

    case 'CLEAR_VENDOR_ASSIGNMENT': {
      delete state.vendorAssignments[command.assignment.id]
      break
    }

    case 'BATCH_ASSIGN_VENDORS':
    case 'APPLY_IMPORT': {
      if (command.type === 'APPLY_IMPORT') {
        for (const v of command.createdVendors) {
          state.vendors[v.id] = { ...v }
        }
      }
      for (const a of command.replacedAssignments) {
        delete state.vendorAssignments[a.id]
      }
      for (const a of command.createdAssignments) {
        state.vendorAssignments[a.id] = { ...a }
      }
      break
    }

    // ── Room & door commands ────────────────────────────────────────────

    case 'SET_ROOM': {
      state.room = command.nextRoom ? cloneRoom(command.nextRoom) : null
      break
    }

    case 'ADD_ROOM_SEGMENT': {
      if (!state.room) {
        state.room = { segments: [], circles: [], freehandVertices: null, roomLabels: {} }
      }
      state.room.segments.push({ ...command.segment })
      state.room.freehandVertices = null // adding segments clears freehand
      break
    }

    case 'UPDATE_ROOM_SEGMENT': {
      if (state.room) {
        const seg = state.room.segments.find(s => s.id === command.segmentId)
        if (seg) {
          seg.x = command.next.x
          seg.y = command.next.y
          seg.width = command.next.width
          seg.height = command.next.height
        }
      }
      break
    }

    case 'DELETE_ROOM_SEGMENT': {
      if (state.room) {
        state.room.segments = state.room.segments.filter(s => s.id !== command.segment.id)
        if (
          state.room.segments.length === 0 &&
          (state.room.circles?.length ?? 0) === 0 &&
          !state.room.freehandVertices
        ) {
          state.room = null
        }
      }
      break
    }

    case 'SET_FREEHAND_ROOM': {
      state.room = {
        segments: [],
        circles: [],
        freehandVertices: command.vertices.map(v => ({ ...v })),
        roomLabels: command.prevRoom?.roomLabels ? { ...command.prevRoom.roomLabels } : {},
      }
      break
    }

    case 'PLACE_DOOR': {
      state.doors[command.door.id] = { ...command.door }
      break
    }

    case 'MOVE_DOOR': {
      const d = state.doors[command.doorId]
      if (d) {
        d.x = command.next.x
        d.y = command.next.y
        d.side = command.next.side
      }
      break
    }

    case 'RESIZE_DOOR': {
      const d = state.doors[command.doorId]
      if (d) d.width = command.nextWidth
      break
    }

    case 'DELETE_DOOR': {
      delete state.doors[command.door.id]
      break
    }

    // ── Settings command ──────────────────────────────────────────────────

    case 'UPDATE_SETTINGS': {
      safeAssign(state.settings, command.next)
      break
    }

    default:
      break
  }
}

export function reverseCommand(state: MutableCanvasState, command: LayoutCommand): void {
  switch (command.type) {
    case 'PLACE_TABLE': {
      delete state.tables[command.table.id]
      break
    }

    case 'MOVE_TABLES': {
      for (const m of command.moves) {
        const t = state.tables[m.tableId]
        if (t) {
          t.x = m.prevX
          t.y = m.prevY
        }
      }
      break
    }

    case 'RESIZE_TABLE': {
      const t = state.tables[command.tableId]
      if (t) {
        t.x      = command.prev.x
        t.y      = command.prev.y
        t.width  = command.prev.width
        t.height = command.prev.height
      }
      break
    }

    case 'ROTATE_TABLES': {
      for (const r of command.rotations) {
        const t = state.tables[r.tableId]
        if (t) t.rotation = r.prevRotation
      }
      break
    }

    case 'SET_TABLE_PREMIUM': {
      for (const id of command.tableIds) {
        const t = state.tables[id]
        if (t) t.premium = command.prev[id] ?? false
      }
      break
    }

    case 'DELETE_TABLES': {
      for (const t of command.tables) {
        state.tables[t.id] = { ...t }
      }
      for (const a of command.affectedAssignments) {
        state.vendorAssignments[a.id] = { ...a }
      }
      break
    }

    case 'RELABEL_TABLE': {
      const t = state.tables[command.tableId]
      if (t) {
        t.label           = command.prev.label
        t.labelOverridden = command.prev.labelOverridden
      }
      break
    }

    // ── Row commands ──────────────────────────────────────────────────────

    case 'PLACE_ROW': {
      delete state.rows[command.row.id]
      for (const t of command.tables) {
        delete state.tables[t.id]
      }
      break
    }

    case 'DELETE_ROW': {
      state.rows[command.row.id] = { ...command.row }
      for (const t of command.tables) {
        state.tables[t.id] = { ...t }
      }
      for (const a of command.affectedAssignments) {
        state.vendorAssignments[a.id] = { ...a }
      }
      break
    }

    // ── Section commands ───────────────────────────────────────────────────

    case 'CREATE_SECTION': {
      delete state.sections[command.section.id]
      break
    }

    case 'UPDATE_SECTION': {
      const sec = state.sections[command.sectionId]
      if (sec) {
        safeAssign(sec, command.prev)
      }
      break
    }

    case 'DELETE_SECTION': {
      state.sections[command.section.id] = { ...command.section }
      for (let i = 0; i < command.affectedTableIds.length; i++) {
        const t = state.tables[command.affectedTableIds[i]]
        if (t) t.sectionId = command.section.id
      }
      break
    }

    case 'ASSIGN_TO_SECTION': {
      for (let i = 0; i < command.tableIds.length; i++) {
        const t = state.tables[command.tableIds[i]]
        if (t) t.sectionId = command.prevSectionIds[i]
      }
      break
    }

    // ── Numbering commands ────────────────────────────────────────────────

    case 'RENUMBER': {
      for (const c of command.changes) {
        const t = state.tables[c.tableId]
        if (t) {
          t.label = c.prev.label
          t.labelOverridden = c.prev.labelOverridden
        }
      }
      break
    }

    // ── Vendor assignment commands ────────────────────────────────────────

    case 'ASSIGN_VENDOR': {
      delete state.vendorAssignments[command.assignment.id]
      if (command.prevAssignment) {
        state.vendorAssignments[command.prevAssignment.id] = { ...command.prevAssignment }
      }
      break
    }

    case 'UPDATE_VENDOR_ASSIGNMENT': {
      const a = state.vendorAssignments[command.assignmentId]
      if (a) safeAssign(a, command.prev)
      break
    }

    case 'CLEAR_VENDOR_ASSIGNMENT': {
      state.vendorAssignments[command.assignment.id] = { ...command.assignment }
      break
    }

    case 'BATCH_ASSIGN_VENDORS':
    case 'APPLY_IMPORT': {
      if (command.type === 'APPLY_IMPORT') {
        for (const v of command.createdVendors) {
          delete state.vendors[v.id]
        }
      }
      for (const a of command.createdAssignments) {
        delete state.vendorAssignments[a.id]
      }
      for (const a of command.replacedAssignments) {
        state.vendorAssignments[a.id] = { ...a }
      }
      break
    }

    // ── Room & door commands ────────────────────────────────────────────

    case 'SET_ROOM': {
      state.room = command.prevRoom ? cloneRoom(command.prevRoom) : null
      break
    }

    case 'ADD_ROOM_SEGMENT': {
      state.room = command.prevRoom ? cloneRoom(command.prevRoom) : null
      break
    }

    case 'UPDATE_ROOM_SEGMENT': {
      if (state.room) {
        const seg = state.room.segments.find(s => s.id === command.segmentId)
        if (seg) {
          seg.x = command.prev.x
          seg.y = command.prev.y
          seg.width = command.prev.width
          seg.height = command.prev.height
        }
      }
      break
    }

    case 'DELETE_ROOM_SEGMENT': {
      if (!state.room) {
        state.room = { segments: [], circles: [], freehandVertices: null, roomLabels: {} }
      }
      state.room.segments.push({ ...command.segment })
      break
    }

    case 'SET_FREEHAND_ROOM': {
      state.room = command.prevRoom ? cloneRoom(command.prevRoom) : null
      break
    }

    case 'PLACE_DOOR': {
      delete state.doors[command.door.id]
      break
    }

    case 'MOVE_DOOR': {
      const d = state.doors[command.doorId]
      if (d) {
        d.x = command.prev.x
        d.y = command.prev.y
        d.side = command.prev.side
      }
      break
    }

    case 'RESIZE_DOOR': {
      const d = state.doors[command.doorId]
      if (d) d.width = command.prevWidth
      break
    }

    case 'DELETE_DOOR': {
      state.doors[command.door.id] = { ...command.door }
      break
    }

    // ── Settings command ──────────────────────────────────────────────────

    case 'UPDATE_SETTINGS': {
      safeAssign(state.settings, command.prev)
      break
    }

    default:
      break
  }
}
