'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditorStore } from '@/store/index'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import { formatDimension } from '@/lib/units'

export interface TableBuilderConfig {
  tableWidth: number
  tableHeight: number
}

function clamp(raw: string, min: number, max: number, def: number): number {
  const n = parseInt(raw)
  if (isNaN(n)) return def
  return Math.max(min, Math.min(max, n))
}

export default function TableBuilderPanel() {
  const setConfig = useEditorStore(s => s.setTableBuilderConfig)

  const [lengthStr, setLengthStr] = useState(String(DEFAULT_SETTINGS.defaultTableWidth))
  const [widthStr, setWidthStr]   = useState(String(DEFAULT_SETTINGS.defaultTableHeight))
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')

  const length = clamp(lengthStr, 12, 240, DEFAULT_SETTINGS.defaultTableWidth)
  const tableWidth = clamp(widthStr, 6, 120, DEFAULT_SETTINGS.defaultTableHeight)

  useEffect(() => {
    const w = orientation === 'horizontal' ? length : tableWidth
    const h = orientation === 'horizontal' ? tableWidth : length
    setConfig({ tableWidth: w, tableHeight: h })
  }, [length, tableWidth, orientation, setConfig])

  const blurLength = useCallback(() => setLengthStr(String(length)), [length])
  const blurWidth  = useCallback(() => setWidthStr(String(tableWidth)), [tableWidth])

  return (
    <div className="px-3 py-3 text-sm">
      <p className="text-xs text-gray-500 mb-3">Click canvas to place</p>

      <div className="flex gap-2 mb-2">
        <label className="flex-1">
          <span className="text-gray-600 text-xs">Length <span className="text-gray-400">({formatDimension(length)})</span></span>
          <input
            type="number" min={12} max={240}
            value={lengthStr}
            onChange={e => setLengthStr(e.target.value)}
            onBlur={blurLength}
            onKeyDown={e => e.stopPropagation()}
            className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="flex-1">
          <span className="text-gray-600 text-xs">Width <span className="text-gray-400">({formatDimension(tableWidth)})</span></span>
          <input
            type="number" min={6} max={120}
            value={widthStr}
            onChange={e => setWidthStr(e.target.value)}
            onBlur={blurWidth}
            onKeyDown={e => e.stopPropagation()}
            className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </label>
      </div>

      <label className="block">
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
    </div>
  )
}
