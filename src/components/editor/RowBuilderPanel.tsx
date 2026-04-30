'use client'

// ─────────────────────────────────────────────────────────────────────────────
// ROW BUILDER PANEL
//
// Side panel that appears when the place-row tool is active.
// User configures table count, spacing, orientation, then clicks canvas to place.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useEditorStore, selectSections, selectSettings } from '@/store/index'
import { DEFAULT_ROW_SPACING, DEFAULT_ROW_TABLE_COUNT } from '@/lib/defaults'
import { formatDimension } from '@/lib/units'
import type { SectionId } from '@/domain/types'

export interface RowBuilderConfig {
  tableCount: number
  tableWidth: number
  tableHeight: number
  spacing: number
  orientation: 'horizontal' | 'vertical'
  sectionId: SectionId | null
}

function clamp(raw: string, min: number, max: number, def: number): number {
  const n = parseInt(raw)
  if (isNaN(n)) return def
  return Math.max(min, Math.min(max, n))
}

export default function RowBuilderPanel() {
  const sections = useEditorStore(selectSections)
  const settings = useEditorStore(selectSettings)
  const setConfig = useEditorStore(s => s.setRowBuilderConfig)

  const [countStr, setCountStr]   = useState(String(DEFAULT_ROW_TABLE_COUNT))
  const [widthStr, setWidthStr]   = useState(String(settings.defaultTableWidth))
  const [heightStr, setHeightStr] = useState(String(settings.defaultTableHeight))
  const [spacingStr, setSpacingStr] = useState(String(DEFAULT_ROW_SPACING))

  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')
  const [sectionId, setSectionId]     = useState<SectionId | null>(null)

  const tableCount  = clamp(countStr, 1, 100, DEFAULT_ROW_TABLE_COUNT)
  useEffect(() => {
    setWidthStr(String(settings.defaultTableWidth))
    setHeightStr(String(settings.defaultTableHeight))
  }, [settings.defaultTableWidth, settings.defaultTableHeight])

  const tableWidth  = clamp(widthStr, 10, 500, settings.defaultTableWidth)
  const tableHeight = clamp(heightStr, 10, 500, settings.defaultTableHeight)
  const spacing     = clamp(spacingStr, 0, 200, DEFAULT_ROW_SPACING)

  useEffect(() => {
    setConfig({ tableCount, tableWidth, tableHeight, spacing, orientation, sectionId })
  }, [tableCount, tableWidth, tableHeight, spacing, orientation, sectionId, setConfig])

  const blurCount   = useCallback(() => setCountStr(String(tableCount)), [tableCount])
  const blurWidth   = useCallback(() => setWidthStr(String(tableWidth)), [tableWidth])
  const blurHeight  = useCallback(() => setHeightStr(String(tableHeight)), [tableHeight])
  const blurSpacing = useCallback(() => setSpacingStr(String(spacing)), [spacing])

  const sectionList = Object.values(sections)

  return (
    <div className="px-3 py-3 text-sm">
      <p className="text-xs text-gray-500 mb-3">Click canvas to place row</p>

      <label className="block mb-2">
        <span className="text-gray-600 text-xs">Tables</span>
        <input
          type="number" min={1} max={100}
          value={countStr}
          onChange={e => setCountStr(e.target.value)}
          onBlur={blurCount}
          onKeyDown={e => e.stopPropagation()}
          className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <div className="flex gap-2 mb-2">
        <label className="flex-1">
          <span className="text-gray-600 text-xs">Length <span className="text-gray-400">({formatDimension(tableWidth)})</span></span>
          <input
            type="number" min={10} max={500}
            value={widthStr}
            onChange={e => setWidthStr(e.target.value)}
            onBlur={blurWidth}
            onKeyDown={e => e.stopPropagation()}
            className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="flex-1">
          <span className="text-gray-600 text-xs">Width <span className="text-gray-400">({formatDimension(tableHeight)})</span></span>
          <input
            type="number" min={10} max={500}
            value={heightStr}
            onChange={e => setHeightStr(e.target.value)}
            onBlur={blurHeight}
            onKeyDown={e => e.stopPropagation()}
            className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
      </div>

      <label className="block mb-2">
        <span className="text-gray-600 text-xs">Table Spacing <span className="text-gray-400">({formatDimension(spacing)})</span></span>
        <input
          type="number" min={0} max={200}
          value={spacingStr}
          onChange={e => setSpacingStr(e.target.value)}
          onBlur={blurSpacing}
          onKeyDown={e => e.stopPropagation()}
          className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      </label>

      <label className="block mb-2">
        <span className="text-gray-600 text-xs">Orientation</span>
        <select
          value={orientation}
          onChange={e => setOrientation(e.target.value as 'horizontal' | 'vertical')}
          className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
      </label>

      {sectionList.length > 0 && (
        <label className="block mb-1">
          <span className="text-gray-600 text-xs">Section</span>
          <select
            value={sectionId ?? ''}
            onChange={e => setSectionId((e.target.value || null) as SectionId | null)}
            className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
          >
            <option value="">None</option>
            {sectionList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
