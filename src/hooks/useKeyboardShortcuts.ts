'use client'

import { useEffect } from 'react'
import {
  useEditorStore,
  selectSelectedIds,
  selectTables,
  selectVendorAssignments,
  selectCanUndo,
  selectCanRedo,
} from '@/store/index'
import { numberingModule } from '@/domain/numbering.impl'
import { DEFAULT_NUMBERING_SCHEME } from '@/domain/numbering'
import type { TableId, TableObject } from '@/domain/types'

export function useKeyboardShortcuts() {
  const undo         = useEditorStore(s => s.undo)
  const redo         = useEditorStore(s => s.redo)
  const dispatch     = useEditorStore(s => s.dispatch)
  const clearSelected = useEditorStore(s => s.clearSelected)
  const setActiveTool = useEditorStore(s => s.setActiveTool)
  const selectedIds  = useEditorStore(selectSelectedIds)
  const tables       = useEditorStore(selectTables)
  const vendorAssignments = useEditorStore(selectVendorAssignments)
  const canUndo      = useEditorStore(selectCanUndo)
  const canRedo      = useEditorStore(selectCanRedo)

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
          const remaining = Object.values(useEditorStore.getState().tables)
          if (remaining.length > 0) {
            const sorted = sortTablesSpatially(remaining)
            const labelChanges = numberingModule.numberTables(sorted, DEFAULT_NUMBERING_SCHEME, { skipOverrides: true })
            const changes = labelChanges
              .filter(lc => {
                const t = useEditorStore.getState().tables[lc.id]
                return t && (t.label !== lc.label || t.labelOverridden !== lc.labelOverridden)
              })
              .map(lc => ({
                tableId: lc.id as TableId,
                prev: {
                  label: useEditorStore.getState().tables[lc.id].label,
                  labelOverridden: useEditorStore.getState().tables[lc.id].labelOverridden,
                },
                next: { label: lc.label, labelOverridden: lc.labelOverridden },
              }))
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

      if (e.key === 's' || e.key === 'Escape') {
        setActiveTool('select')
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

      if (e.key === 'b') {
        setActiveTool('draw-room')
        return
      }

      if (e.key === 'v') {
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
  }, [undo, redo, dispatch, clearSelected, setActiveTool, selectedIds, tables, vendorAssignments, canUndo, canRedo])
}

/** Sort tables spatially: group by y-band (row tolerance), then left-to-right. */
function sortTablesSpatially(tables: TableObject[]): TableObject[] {
  if (tables.length === 0) return []
  const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x)

  const tolerance = sorted[0].height * 0.8
  const bands: TableObject[][] = []
  let currentBand: TableObject[] = [sorted[0]]
  let bandY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - bandY) <= tolerance) {
      currentBand.push(sorted[i])
    } else {
      bands.push(currentBand)
      currentBand = [sorted[i]]
      bandY = sorted[i].y
    }
  }
  bands.push(currentBand)

  return bands.flatMap(band => band.sort((a, b) => a.x - b.x))
}
