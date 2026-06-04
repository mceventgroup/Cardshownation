'use client'

import { useEffect, useRef } from 'react'
import {
  useEditorStore,
  selectActiveRoomId,
  selectSelectedIds,
  selectTables,
  selectVendorAssignments,
  selectCanUndo,
  selectCanRedo,
} from '@/store/index'
import { createTableId } from '@/lib/id'
import { getNextLabelNumberForRoom } from '@/lib/labels'
import { buildAllSectionRenumberChanges, formatDisplayId } from '@/domain/room-numbering'
import type { TableObject } from '@/domain/types'

/** Clipboard entry — stores the table template for pasting. */
interface ClipboardEntry {
  width: number
  height: number
  rotation: number
  shape: TableObject['shape']
  rowId: TableObject['rowId']
  sectionId: TableObject['sectionId']
  /** Offset from the top-left-most copied table, so multi-table paste preserves layout */
  dx: number
  dy: number
}

/** Paste offset so successive pastes don't stack exactly on top of each other. */
const PASTE_OFFSET = 24 // 2 ft

export function useKeyboardShortcuts() {
  const undo         = useEditorStore(s => s.undo)
  const redo         = useEditorStore(s => s.redo)
  const dispatch     = useEditorStore(s => s.dispatch)
  const clearSelected = useEditorStore(s => s.clearSelected)
  const setActiveTool = useEditorStore(s => s.setActiveTool)
  const selectedIds  = useEditorStore(selectSelectedIds)
  const activeRoomId = useEditorStore(selectActiveRoomId)
  const tables       = useEditorStore(selectTables)
  const vendorAssignments = useEditorStore(selectVendorAssignments)
  const canUndo      = useEditorStore(selectCanUndo)
  const canRedo      = useEditorStore(selectCanRedo)

  const clipboardRef = useRef<ClipboardEntry[]>([])
  const pasteCountRef = useRef(0)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore shortcuts when typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) undo()
        return
      }

      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        e.preventDefault()
        if (canRedo) redo()
        return
      }

      // Copy
      if (ctrl && e.key === 'c') {
        if (selectedIds.size === 0) return
        e.preventDefault()
        const selected = [...selectedIds].map(id => tables[id]).filter(Boolean)
        if (selected.length === 0) return

        // Find top-left origin of selection
        const minX = Math.min(...selected.map(t => t.x))
        const minY = Math.min(...selected.map(t => t.y))

        clipboardRef.current = selected.map(t => ({
          width: t.width,
          height: t.height,
          rotation: t.rotation,
          shape: t.shape,
          rowId: t.rowId,
          sectionId: t.sectionId,
          dx: t.x - minX,
          dy: t.y - minY,
        }))
        pasteCountRef.current = 0
        return
      }

      // Paste
      if (ctrl && e.key === 'v') {
        if (clipboardRef.current.length === 0) return
        e.preventDefault()
        pasteCountRef.current++

        const currentTables = useEditorStore.getState().tables
        const roomId = activeRoomId ?? Object.values(currentTables)[0]?.roomId ?? 'R1'
        let nextTableNumber = getNextLabelNumberForRoom(currentTables, roomId)
        const offset = PASTE_OFFSET * pasteCountRef.current

        // Find the origin of the original copy to place relative to it
        // Use the first selected table's position as base, or fall back to offset from 0,0
        const firstSelected = [...selectedIds].map(id => currentTables[id]).find(Boolean)
        const baseX = firstSelected ? firstSelected.x + offset : offset
        const baseY = firstSelected ? firstSelected.y + offset : offset

        const newIds: string[] = []
        for (const entry of clipboardRef.current) {
          const id = createTableId()
          newIds.push(id)
          dispatch({
            type: 'PLACE_TABLE',
            table: {
              id,
              roomId,
              tableNumber: nextTableNumber,
              displayId: formatDisplayId(roomId, nextTableNumber),
              x: baseX + entry.dx,
              y: baseY + entry.dy,
              width: entry.width,
              height: entry.height,
              rotation: entry.rotation,
              shape: entry.shape,
              label: formatDisplayId(roomId, nextTableNumber),
              labelOverridden: false,
              rowId: null,
              sectionId: entry.sectionId,
              order: 0,
              premium: false,
            },
            timestamp: Date.now(),
          })
          nextTableNumber++
        }
        useEditorStore.getState().setSelected(newIds)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size === 0) return
        e.preventDefault()

        const tablesToDelete = [...selectedIds]
          .map(id => tables[id])
          .filter(Boolean)

        if (tablesToDelete.length > 0) {
          const deletedIds = new Set(tablesToDelete.map(t => t.id))
          const affectedAssignments = Object.values(vendorAssignments)
            .filter(a => deletedIds.has(a.tableId))
          dispatch({
            type: 'DELETE_TABLES',
            tables: tablesToDelete,
            affectedAssignments,
            timestamp: Date.now(),
          })
          clearSelected()

          // Auto-renumber all remaining tables to close gaps
          const currentState = useEditorStore.getState()
          const remaining = Object.values(currentState.tables)
          if (remaining.length > 0) {
            const changes = buildAllSectionRenumberChanges(
              currentState.tables,
              currentState.sections,
              currentState.room,
              'cw',
            ).filter(change => (
              change.prev.label !== change.next.label ||
              change.prev.labelOverridden !== change.next.labelOverridden ||
              change.prev.displayId !== change.next.displayId ||
              change.prev.tableNumber !== change.next.tableNumber
            ))
            if (changes.length > 0) {
              dispatch({
                type: 'RENUMBER',
                scope: 'layout',
                scopeId: null,
                changes,
                timestamp: Date.now(),
              })
            }
          }
        }
        return
      }

      if (ctrl && e.key === 's') {
        e.preventDefault()
        useEditorStore.getState().saveLayoutToFile()
        return
      }

      if ((e.key === 's' && !ctrl) || e.key === 'Escape') {
        setActiveTool('select')
        useEditorStore.getState().setDoorPlacementConfig(null)
        return
      }

      if (e.key === 't') {
        setActiveTool('place-table')
        return
      }

      if (e.key === 'r') {
        setActiveTool('place-row')
        return
      }

      if (e.key === 'm') {
        setActiveTool('measure')
        return
      }

      if (e.key === 'b') {
        setActiveTool('draw-room')
        return
      }

      if (e.key === 'c' && !ctrl) {
        setActiveTool('draw-room-circle')
        return
      }

      if (e.key === 'f') {
        setActiveTool('draw-room-freehand')
        return
      }

      if (e.key === 'x') {
        setActiveTool('split-room')
        return
      }

      if (e.key === 'v' && !ctrl) {
        useEditorStore.getState().togglePanelCollapsed('vendors')
        return
      }

      if (e.key === 'w') {
        useEditorStore.getState().togglePanelCollapsed('warnings')
        return
      }

      if (ctrl && e.key === 'a') {
        e.preventDefault()
        const allIds = Object.keys(tables)
        useEditorStore.getState().setSelected(allIds)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeRoomId, undo, redo, dispatch, clearSelected, setActiveTool, selectedIds, tables, vendorAssignments, canUndo, canRedo])
}
