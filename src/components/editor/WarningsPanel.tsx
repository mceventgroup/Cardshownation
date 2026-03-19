'use client'

import { useState } from 'react'
import { useWarnings } from '@/hooks/useWarnings'
import type { LayoutWarning, WarningSeverity } from '@/domain/warnings'
import { useEditorStore, selectSettings } from '@/store/index'
import { formatDimension } from '@/lib/units'


const SEVERITY_ICON: Record<WarningSeverity, string> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵',
}

const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

function warningTableIds(w: LayoutWarning): string[] {
  switch (w.type) {
    case 'overlap':
    case 'narrow-aisle':
      return [...w.tableIds]
    case 'door-blocked':
      return [...w.blockingTableIds]
    case 'duplicate-label':
      return [...w.tableIds]
    case 'unassigned-table':
      return [w.tableId]
  }
}

export default function WarningsPanel() {
  const result = useWarnings()
  const setSelected = useEditorStore(s => s.setSelected)
  const dispatch = useEditorStore(s => s.dispatch)
  const settings = useEditorStore(selectSettings)

  const [aisleStr, setAisleStr] = useState(String(settings.minAisleWidth))

  const handleClickWarning = (w: LayoutWarning) => {
    const ids = warningTableIds(w)
    if (ids.length > 0) setSelected(ids)
  }

  const handleAisleApply = () => {
    const val = Math.max(0, Math.min(120, parseInt(aisleStr) || 0))
    setAisleStr(String(val))
    if (val !== settings.minAisleWidth) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        prev: { minAisleWidth: settings.minAisleWidth },
        next: { minAisleWidth: val },
        timestamp: Date.now(),
      })
    }
  }

  return (
    <div className="text-sm flex flex-col">

      {/* Min aisle width setting */}
      <div className="px-3 py-2 border-b border-gray-100">
        <label className="flex items-center gap-2">
          <span className="text-xs text-gray-600 whitespace-nowrap">Min Aisle Width</span>
          <input
            type="number"
            min={0}
            max={120}
            value={aisleStr}
            onChange={e => setAisleStr(e.target.value)}
            onBlur={handleAisleApply}
            onKeyDown={e => { if (e.key === 'Enter') handleAisleApply() }}
            className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-xs text-center"
          />
          <span className="text-xs text-gray-400">({formatDimension(parseInt(aisleStr) || 0)})</span>
        </label>
      </div>

      {/* Summary badges */}
      {result.warnings.length > 0 && (
        <div className="flex gap-2 px-3 py-2 border-b border-gray-50">
          {result.errorCount > 0 && (
            <span className="text-xs bg-red-50 text-red-700 rounded px-2 py-0.5 font-medium">
              {result.errorCount} error{result.errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {result.warningCount > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 rounded px-2 py-0.5 font-medium">
              {result.warningCount} warning{result.warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {result.infoCount > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5 font-medium">
              {result.infoCount} info
            </span>
          )}
        </div>
      )}

      {/* Warning list */}
      <div className="overflow-y-auto flex-1">
        {result.warnings.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-gray-400">
            No warnings — layout looks good!
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {result.warnings.map((w, i) => (
              <button
                key={i}
                onClick={() => handleClickWarning(w)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-start gap-2"
              >
                <span className="text-xs mt-0.5 shrink-0">
                  {SEVERITY_ICON[w.severity]}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500">
                    {SEVERITY_LABEL[w.severity]} &middot; {w.type.replace(/-/g, ' ')}
                  </div>
                  <div className="text-sm text-gray-700 truncate">
                    {w.message}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
