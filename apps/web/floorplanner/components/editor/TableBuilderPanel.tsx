'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditorStore, selectSettings } from '@floorplanner/store/index'
import { formatDimension } from '@floorplanner/lib/units'

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
  const settings = useEditorStore(selectSettings)
  const setConfig = useEditorStore(s => s.setTableBuilderConfig)

  const [lengthStr, setLengthStr] = useState(String(settings.defaultTableWidth))
  const [widthStr, setWidthStr]   = useState(String(settings.defaultTableHeight))
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')

  useEffect(() => {
    setLengthStr(String(settings.defaultTableWidth))
    setWidthStr(String(settings.defaultTableHeight))
  }, [settings.defaultTableWidth, settings.defaultTableHeight])

  const length = clamp(lengthStr, 12, 240, settings.defaultTableWidth)
  const tableWidth = clamp(widthStr, 6, 120, settings.defaultTableHeight)

  useEffect(() => {
    const w = orientation === 'horizontal' ? length : tableWidth
    const h = orientation === 'horizontal' ? tableWidth : length
    setConfig({ tableWidth: w, tableHeight: h })
  }, [length, tableWidth, orientation, setConfig])

  const blurLength = useCallback(() => setLengthStr(String(length)), [length])
  const blurWidth  = useCallback(() => setWidthStr(String(tableWidth)), [tableWidth])

  const presets = [
    { label: '6ft Rect', w: 72, h: 30 },
    { label: '8ft Rect', w: 96, h: 30 },
    { label: '4ft Rect', w: 48, h: 30 },
    { label: '60" Round', w: 60, h: 60 },
    { label: '72" Round', w: 72, h: 72 },
  ]

  function applyPreset(w: number, h: number) {
    setLengthStr(String(w))
    setWidthStr(String(h))
    setOrientation('horizontal')
  }

  return (
    <div className="px-3 py-3 text-sm">
      <p className="mb-3 text-xs font-medium text-slate-600">Click canvas to place</p>

      {/* Presets */}
      <div className="flex flex-wrap gap-1 mb-3">
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.w, p.h)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              length === p.w && tableWidth === p.h
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-2">
        <label className="flex-1">
          <span className="text-xs font-medium text-slate-700">Length <span className="text-slate-500">({formatDimension(length)})</span></span>
          <input
            type="number" min={12} max={240}
            value={lengthStr}
            onChange={e => setLengthStr(e.target.value)}
            onBlur={blurLength}
            onKeyDown={e => e.stopPropagation()}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="flex-1">
          <span className="text-xs font-medium text-slate-700">Width <span className="text-slate-500">({formatDimension(tableWidth)})</span></span>
          <input
            type="number" min={6} max={120}
            value={widthStr}
            onChange={e => setWidthStr(e.target.value)}
            onBlur={blurWidth}
            onKeyDown={e => e.stopPropagation()}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-700">Orientation</span>
        <select
          value={orientation}
          onChange={e => setOrientation(e.target.value as 'horizontal' | 'vertical')}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
      </label>
    </div>
  )
}
