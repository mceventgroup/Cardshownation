'use client'

// ─────────────────────────────────────────────────────────────────────────────
// ROW EDIT PANEL
//
// Shows when all selected tables belong to the same row.
// Adjusting spacing repositions all tables in the row via MOVE_TABLES.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useEditorStore, selectTables, selectRows } from '@/store/index'
import { rowModule } from '@/domain/rows.impl'
import { formatDimension, formatTableSize } from '@/lib/units'
import type { TableId, RowId } from '@/domain/types'

function clamp(raw: string, min: number, max: number, def: number): number {
  const n = parseInt(raw)
  if (isNaN(n)) return def
  return Math.max(min, Math.min(max, n))
}

interface RowEditPanelProps {
  rowId: RowId
}

export default function RowEditPanel({ rowId }: RowEditPanelProps) {
  const tables   = useEditorStore(selectTables)
  const rows     = useEditorStore(selectRows)
  const dispatch = useEditorStore(s => s.dispatch)

  const row = rows[rowId]

  // Get all tables in this row, sorted by order
  const rowTables = useMemo(() =>
    Object.values(tables)
      .filter(t => t.rowId === rowId)
      .sort((a, b) => a.order - b.order),
    [tables, rowId],
  )

  const [spacingStr, setSpacingStr] = useState(String(row?.spacing ?? 10))

  // Reset when a different row is selected
  useEffect(() => {
    if (row) setSpacingStr(String(row.spacing))
  }, [row])

  const handleApply = useCallback(() => {
    if (!row || rowTables.length === 0) return

    const newSpacing = clamp(spacingStr, 0, 200, row.spacing)
    setSpacingStr(String(newSpacing))

    const repositioned = rowModule.recalculateRowPositions(
      row,
      rowTables,
      { spacing: newSpacing },
    )

    const moves = repositioned
      .map(rp => {
        const orig = tables[rp.id]
        if (!orig || (orig.x === rp.x && orig.y === rp.y)) return null
        return {
          tableId: rp.id as TableId,
          prevX: orig.x,
          prevY: orig.y,
          nextX: rp.x,
          nextY: rp.y,
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    if (moves.length > 0) {
      dispatch({ type: 'MOVE_TABLES', moves, timestamp: Date.now() })
    }
  }, [spacingStr, row, rowTables, tables, dispatch])

  if (!row) return null

  return (
    <div className="px-3 py-3 text-sm">
      <h3 className="font-semibold text-gray-800 mb-1">Edit Row</h3>
      <p className="text-xs text-gray-400 mb-3">
        {rowTables.length} table{rowTables.length !== 1 ? 's' : ''} · {row.orientation}
      </p>

      <label className="block mb-2">
        <span className="text-gray-600 text-xs">Table Spacing <span className="text-gray-400">({formatDimension(clamp(spacingStr, 0, 200, row.spacing))})</span></span>
        <input
          type="number"
          min={0}
          max={200}
          value={spacingStr}
          onChange={e => setSpacingStr(e.target.value)}
          onBlur={handleApply}
          onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
          className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      {rowTables[0] && (
        <p className="text-xs text-gray-400">
          Table size: {formatTableSize(rowTables[0].width, rowTables[0].height)}
        </p>
      )}
    </div>
  )
}
