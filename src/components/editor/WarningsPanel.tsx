'use client'

import { useWarnings } from '@/hooks/useWarnings'
import type { LayoutWarning, WarningSeverity } from '@/domain/warnings'
import { useEditorStore } from '@/store/index'


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
      return [...w.tableIds]
    case 'narrow-aisle':
      return [...w.tableIds]
    case 'door-blocked':
      return [...w.blockingTableIds]
    case 'duplicate-label':
      return [...w.tableIds]
    case 'unassigned-table':
    case 'out-of-bounds':
    case 'wall-setback':
      return [w.tableId]
  }
}

export default function WarningsPanel() {
  const result = useWarnings()
  const setSelected = useEditorStore(s => s.setSelected)

  const handleClickWarning = (w: LayoutWarning) => {
    const ids = warningTableIds(w)
    if (ids.length > 0) setSelected(ids)
  }

  return (
    <div className="text-sm flex flex-col">

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
