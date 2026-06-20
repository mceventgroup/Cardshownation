'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEditorStore, selectSelectedIds, selectTables } from '@floorplanner/store/index'
import { formatDimension } from '@floorplanner/lib/units'
import type { TableId, TableObject } from '@floorplanner/domain/types'

function clamp(raw: string, min: number, max: number): number | null {
  if (raw.trim() === '') return null
  const n = parseInt(raw, 10)
  if (isNaN(n)) return null
  return Math.max(min, Math.min(max, n))
}

function normalizeRotation(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return null
  return Math.round(((((n % 360) + 360) % 360)) * 10) / 10
}

function commonValue(values: number[]): string {
  if (values.length === 0) return ''
  return values.every(value => value === values[0]) ? String(values[0]) : ''
}

export default function BulkTableEditPanel() {
  const tables = useEditorStore(selectTables)
  const selectedIds = useEditorStore(selectSelectedIds)
  const dispatch = useEditorStore(s => s.dispatch)

  const selectedTables = useMemo(() =>
    [...selectedIds]
      .map(id => tables[id])
      .filter((table): table is TableObject => Boolean(table)),
    [selectedIds, tables],
  )
  const premiumCount = useMemo(
    () => selectedTables.filter(table => table.premium).length,
    [selectedTables],
  )
  const allPremium = selectedTables.length > 0 && premiumCount === selectedTables.length
  const anyPremium = premiumCount > 0

  const [lengthStr, setLengthStr] = useState('')
  const [widthStr, setWidthStr] = useState('')
  const [rotationStr, setRotationStr] = useState('')

  useEffect(() => {
    const lengths = selectedTables.map(table => Math.max(table.width, table.height))
    const widths = selectedTables.map(table => Math.min(table.width, table.height))
    const rotations = selectedTables.map(table => Math.round(table.rotation * 10) / 10)
    setLengthStr(commonValue(lengths))
    setWidthStr(commonValue(widths))
    setRotationStr(commonValue(rotations))
  }, [selectedTables])

  const previewLength = clamp(lengthStr, 12, 240)
  const previewWidth = clamp(widthStr, 6, 120)
  const previewRotation = normalizeRotation(rotationStr)

  const applyPremiumToSelection = useCallback((premium: boolean) => {
    const prev = Object.fromEntries(
      selectedTables.map(table => [table.id, table.premium]),
    )

    dispatch({
      type: 'SET_TABLE_PREMIUM',
      tableIds: selectedTables.map(table => table.id as TableId),
      premium,
      prev,
      timestamp: Date.now(),
    })
  }, [dispatch, selectedTables])

  const handleApply = useCallback(() => {
    const targetLength = clamp(lengthStr, 12, 240)
    const targetWidth = clamp(widthStr, 6, 120)
    const targetRotation = normalizeRotation(rotationStr)
    if (targetLength === null && targetWidth === null && targetRotation === null) return

    for (const table of selectedTables) {
      const currentLength = Math.max(table.width, table.height)
      const currentWidth = Math.min(table.width, table.height)
      const nextLength = targetLength ?? currentLength
      const nextWidth = targetWidth ?? currentWidth
      const isVertical = table.height > table.width
      const nextW = isVertical ? nextWidth : nextLength
      const nextH = isVertical ? nextLength : nextWidth

      if (nextW !== table.width || nextH !== table.height) {
        dispatch({
          type: 'RESIZE_TABLE',
          tableId: table.id as TableId,
          prev: { x: table.x, y: table.y, width: table.width, height: table.height },
          next: { x: table.x, y: table.y, width: nextW, height: nextH },
          timestamp: Date.now(),
        })
      }

      if (targetRotation !== null && targetRotation !== table.rotation) {
        dispatch({
          type: 'ROTATE_TABLES',
          rotations: [{
            tableId: table.id as TableId,
            prevRotation: table.rotation,
            nextRotation: targetRotation,
          }],
          timestamp: Date.now(),
        })
      }
    }
  }, [dispatch, lengthStr, rotationStr, selectedTables, widthStr])

  if (selectedTables.length < 2) return null

  return (
    <div className="space-y-4 px-4 py-4 text-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Bulk Table Edit</h3>
            <p className="text-xs text-slate-500">
              Resize, rotate, or mark {selectedTables.length} selected tables as premium. Current orientation stays the same.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {selectedTables.length} selected
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-amber-800">Premium Tables</div>
              <div className="mt-1 text-sm text-amber-900">
                {allPremium
                  ? 'All selected tables are premium.'
                  : anyPremium
                    ? `${premiumCount} of ${selectedTables.length} selected tables are premium.`
                    : 'None of the selected tables are premium.'}
              </div>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 shadow-sm">
              {premiumCount}/{selectedTables.length}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => applyPremiumToSelection(true)}
              disabled={allPremium}
              className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-200 disabled:text-amber-700"
            >
              Mark Premium
            </button>
            <button
              onClick={() => applyPremiumToSelection(false)}
              disabled={!anyPremium}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              Remove Premium
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Length {previewLength !== null ? `(${formatDimension(previewLength)})` : ''}
            </span>
            <input
              type="number"
              min={12}
              max={240}
              value={lengthStr}
              placeholder="Mixed"
              onChange={e => setLengthStr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Width {previewWidth !== null ? `(${formatDimension(previewWidth)})` : ''}
            </span>
            <input
              type="number"
              min={6}
              max={120}
              value={widthStr}
              placeholder="Mixed"
              onChange={e => setWidthStr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Rotation {previewRotation !== null ? `(${previewRotation} deg)` : ''}
            </span>
            <input
              type="number"
              step="0.1"
              value={rotationStr}
              placeholder="Mixed"
              onChange={e => setRotationStr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <button
          onClick={handleApply}
          className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Apply to {selectedTables.length} Tables
        </button>

        <div className="mt-3 text-xs text-slate-500">
          Use `Ctrl+A` to select all tables, then apply one size or angle to the full layout.
        </div>
      </div>
    </div>
  )
}
