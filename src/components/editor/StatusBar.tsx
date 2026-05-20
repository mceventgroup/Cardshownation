'use client'

import { getCardShowNationBaseUrl, getCardShowNationHost } from '@/lib/card-show-nation'
import { useEditorStore } from '@/store/index'

export default function StatusBar() {
  const totalCount = useEditorStore(s => Object.keys(s.tables).length)
  const assignedCount = useEditorStore(s => Object.keys(s.vendorAssignments).length)
  const selectedCount = useEditorStore(s => s.selectedIds.size)
  const premiumCount = useEditorStore(s => Object.values(s.tables).filter(t => t.premium).length)
  const saveStatus = useEditorStore(s => s.saveStatus)
  const saveError = useEditorStore(s => s.saveError)
  const cardShowNationBaseUrl = getCardShowNationBaseUrl()
  const cardShowNationHost = getCardShowNationHost()

  const unassignedCount = totalCount - assignedCount
  const percentFilled = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-1px_0_rgba(148,163,184,0.08)]">
      <div className="flex items-center gap-6">
        <div className="min-w-[220px]">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Layout Fill</span>
            <span>{percentFilled}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percentFilled}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{totalCount} total</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{assignedCount} assigned</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">{unassignedCount} open</span>
          <span className="rounded-full bg-yellow-50 px-2.5 py-1 font-medium text-yellow-700">{premiumCount} premium</span>
          {selectedCount > 0 && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{selectedCount} selected</span>
          )}
        </div>

        <div className="flex-1" />
        <a
          href={cardShowNationBaseUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
          title={`Card Show Nation target: ${cardShowNationBaseUrl}`}
        >
          CSN: {cardShowNationHost}
        </a>
        <span className="text-xs text-slate-500">Scroll to zoom | Space+drag to pan | Shift+click for multi-select</span>
        {saveStatus === 'saving' && <span className="text-xs text-slate-400">Saving...</span>}
        {saveStatus === 'saved' && <span className="text-xs text-emerald-600">Saved</span>}
        {saveStatus === 'error' && (
          <span className="text-xs text-red-500" title={saveError === 'quota-exceeded' ? 'Storage full - clear space or export your layout.' : 'Save failed.'}>
            {saveError === 'quota-exceeded' ? 'Storage full' : 'Save error'}
          </span>
        )}
      </div>
    </div>
  )
}
