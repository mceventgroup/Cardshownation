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
  const [curveRadiusStr, setCurveRadiusStr] = useState(String(row?.curveRadius ?? 120))

  // Reset when a different row is selected
  useEffect(() => {
    if (row) {
      setSpacingStr(String(row.spacing))
      setCurveRadiusStr(String(row.curveRadius ?? 120))
    }
  }, [row])

  const handleApply = useCallback(() => {
    if (!row || rowTables.length === 0) return

    const newSpacing = clamp(spacingStr, 0, 200, row.spacing)
    const newCurveRadius = row.orientation === 'curved'
      ? clamp(curveRadiusStr, 24, 1200, row.curveRadius ?? 120)
      : undefined
    setSpacingStr(String(newSpacing))
    if (newCurveRadius !== undefined) setCurveRadiusStr(String(newCurveRadius))

    const repositioned = rowModule.recalculateRowPositions(
      row,
      rowTables,
      { spacing: newSpacing, curveRadius: newCurveRadius },
    )

    const tableChanges = repositioned
      .map(rp => {
        const orig = tables[rp.id]
        const nextRotation = rp.rotation ?? orig?.rotation
        if (!orig || (orig.x === rp.x && orig.y === rp.y && orig.rotation === nextRotation)) return null
        return {
          tableId: rp.id as TableId,
          prev: { x: orig.x, y: orig.y, rotation: orig.rotation },
          next: { x: rp.x, y: rp.y, rotation: nextRotation ?? 0 },
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)

    const nextRow = {
      spacing: newSpacing,
      ...(row.orientation === 'curved' ? { curveRadius: newCurveRadius } : {}),
    }
    const rowChanged =
      row.spacing !== nextRow.spacing ||
      (row.orientation === 'curved' && row.curveRadius !== nextRow.curveRadius)

    if (rowChanged || tableChanges.length > 0) {
      dispatch({
        type: 'UPDATE_ROW',
        rowId,
        prev: {
          spacing: row.spacing,
          ...(row.orientation === 'curved' ? { curveRadius: row.curveRadius } : {}),
        },
        next: nextRow,
        tableChanges,
        timestamp: Date.now(),
      })
    }
  }, [curveRadiusStr, spacingStr, row, rowId, rowTables, tables, dispatch])

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

      {row.orientation === 'curved' && (
        <label className="block mb-2">
          <span className="text-gray-600 text-xs">Curve Radius <span className="text-gray-400">({formatDimension(clamp(curveRadiusStr, 24, 1200, row.curveRadius ?? 120))})</span></span>
          <input
            type="number"
            min={24}
            max={1200}
            value={curveRadiusStr}
            onChange={e => setCurveRadiusStr(e.target.value)}
            onBlur={handleApply}
            onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
            className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
      )}

      {rowTables[0] && (
        <p className="text-xs text-gray-400">
          Table size: {formatTableSize(rowTables[0].width, rowTables[0].height)}
        </p>
      )}
    </div>
  )
}
