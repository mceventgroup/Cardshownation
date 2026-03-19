'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditorStore, selectTables, selectSelectedIds } from '@/store/index'
import { formatDimension } from '@/lib/units'
import type { TableId } from '@/domain/types'

function clamp(raw: string, min: number, max: number, def: number): number {
  const n = parseInt(raw)
  if (isNaN(n)) return def
  return Math.max(min, Math.min(max, n))
}

export default function TablePropertiesPanel() {
  const tables = useEditorStore(selectTables)
  const selectedIds = useEditorStore(selectSelectedIds)
  const dispatch = useEditorStore(s => s.dispatch)

  // Only show when exactly 1 table is selected and it's NOT part of a row
  const tableId = selectedIds.size === 1 ? [...selectedIds][0] : null
  const table = tableId ? tables[tableId] : null

  // Don't show for row tables (RowEditPanel handles those)
  if (!table || table.rowId) return null

  return (
    <TablePropertiesForm
      key={table.id}
      tableId={table.id}
      width={table.width}
      height={table.height}
      x={table.x}
      y={table.y}
      isVertical={table.height > table.width}
      dispatch={dispatch}
    />
  )
}

interface FormProps {
  tableId: string
  width: number
  height: number
  x: number
  y: number
  isVertical: boolean
  dispatch: (cmd: any) => void
}

function TablePropertiesForm({ tableId, width, height, x, y, isVertical, dispatch }: FormProps) {
  // For display: "length" = long side, "width" = short side
  const length = Math.max(width, height)
  const tableWidth = Math.min(width, height)

  const [lengthStr, setLengthStr] = useState(String(length))
  const [widthStr, setWidthStr] = useState(String(tableWidth))

  useEffect(() => {
    setLengthStr(String(Math.max(width, height)))
    setWidthStr(String(Math.min(width, height)))
  }, [width, height])

  const applySize = useCallback((newLength: number, newWidth: number, vertical: boolean) => {
    // In canvas coordinates: width = horizontal, height = vertical
    const nextW = vertical ? newWidth : newLength
    const nextH = vertical ? newLength : newWidth

    if (nextW === width && nextH === height) return

    dispatch({
      type: 'RESIZE_TABLE',
      tableId: tableId as TableId,
      prev: { x, y, width, height },
      next: { x, y, width: nextW, height: nextH },
      timestamp: Date.now(),
    })
  }, [tableId, x, y, width, height, dispatch])

  const handleLengthBlur = useCallback(() => {
    const val = clamp(lengthStr, 12, 240, length)
    setLengthStr(String(val))
    applySize(val, Math.min(width, height), isVertical)
  }, [lengthStr, length, width, height, isVertical, applySize])

  const handleWidthBlur = useCallback(() => {
    const val = clamp(widthStr, 6, 120, tableWidth)
    setWidthStr(String(val))
    applySize(Math.max(width, height), val, isVertical)
  }, [widthStr, tableWidth, width, height, isVertical, applySize])

  const handleToggleOrientation = useCallback(() => {
    const newVertical = !isVertical
    // Swap width and height
    const nextW = newVertical ? Math.min(width, height) : Math.max(width, height)
    const nextH = newVertical ? Math.max(width, height) : Math.min(width, height)

    if (nextW === width && nextH === height) return

    dispatch({
      type: 'RESIZE_TABLE',
      tableId: tableId as TableId,
      prev: { x, y, width, height },
      next: { x, y, width: nextW, height: nextH },
      timestamp: Date.now(),
    })
  }, [tableId, x, y, width, height, isVertical, dispatch])

  return (
    <div className="px-3 py-3 text-sm">
      <h3 className="font-semibold text-gray-800 mb-2">Table Properties</h3>

      <label className="block mb-2">
        <span className="text-gray-600 text-xs">
          Length <span className="text-gray-400">({formatDimension(clamp(lengthStr, 12, 240, length))})</span>
        </span>
        <input
          type="number"
          min={12}
          max={240}
          value={lengthStr}
          onChange={e => setLengthStr(e.target.value)}
          onBlur={handleLengthBlur}
          onKeyDown={e => { if (e.key === 'Enter') handleLengthBlur() }}
          className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <label className="block mb-2">
        <span className="text-gray-600 text-xs">
          Width <span className="text-gray-400">({formatDimension(clamp(widthStr, 6, 120, tableWidth))})</span>
        </span>
        <input
          type="number"
          min={6}
          max={120}
          value={widthStr}
          onChange={e => setWidthStr(e.target.value)}
          onBlur={handleWidthBlur}
          onKeyDown={e => { if (e.key === 'Enter') handleWidthBlur() }}
          className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-600">Orientation</span>
        <button
          onClick={handleToggleOrientation}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            {isVertical ? (
              // Vertical table icon
              <rect x="5" y="2" width="6" height="12" rx="1" />
            ) : (
              // Horizontal table icon
              <rect x="2" y="5" width="12" height="6" rx="1" />
            )}
          </svg>
          {isVertical ? 'Vertical' : 'Horizontal'}
        </button>
      </div>
    </div>
  )
}
