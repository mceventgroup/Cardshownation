'use client'

import { getFloorplannerShowLabel } from '@floorplanner/lib/runtime'
import { useEditorStore } from '@floorplanner/store/index'
import { hasPendingEditorChanges } from '@floorplanner/lib/editor-save-state'

function formatRelativeTime(value: string | null): string | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return null

  const deltaSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (deltaSeconds < 10) return 'just now'
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`

  const deltaMinutes = Math.round(deltaSeconds / 60)
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`

  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours}h ago`

  const deltaDays = Math.round(deltaHours / 24)
  return `${deltaDays}d ago`
}

export default function StatusBar() {
  const totalCount = useEditorStore(s => Object.keys(s.tables).length)
  const assignedCount = useEditorStore(s => Object.keys(s.vendorAssignments).length)
  const selectedCount = useEditorStore(s => s.selectedIds.size)
  const premiumCount = useEditorStore(s => Object.values(s.tables).filter(t => t.premium).length)
  const saveStatus = useEditorStore(s => s.saveStatus)
  const saveError = useEditorStore(s => s.saveError)
  const activeDocumentSource = useEditorStore(s => s.activeDocumentSource)
  const activeDocumentLabel = useEditorStore(s => s.activeDocumentLabel)
  const currentDocumentHash = useEditorStore(s => s.currentDocumentHash)
  const lastCloudSyncHash = useEditorStore(s => s.lastCloudSyncHash)
  const lastFileSyncHash = useEditorStore(s => s.lastFileSyncHash)
  const lastLocalSaveAt = useEditorStore(s => s.lastLocalSaveAt)
  const lastCloudSaveAt = useEditorStore(s => s.lastCloudSaveAt)
  const lastFileSaveAt = useEditorStore(s => s.lastFileSaveAt)
  const showLabel = getFloorplannerShowLabel()

  const unassignedCount = totalCount - assignedCount
  const percentFilled = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0
  const sourceLabel = activeDocumentSource === 'cloud'
    ? 'Cloud'
    : activeDocumentSource === 'file'
      ? 'File'
      : 'Browser'
  const sourceSaveTime = activeDocumentSource === 'cloud'
    ? formatRelativeTime(lastCloudSaveAt)
    : activeDocumentSource === 'file'
      ? formatRelativeTime(lastFileSaveAt)
      : formatRelativeTime(lastLocalSaveAt)
  const hasPendingChanges = hasPendingEditorChanges({
    saveStatus,
    saveError,
    activeDocumentSource,
    currentDocumentHash,
    lastCloudSyncHash,
    lastFileSyncHash,
  })

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-2.5 shadow-[0_-1px_0_rgba(148,163,184,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px] max-w-[260px] flex-1">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Layout Fill</span>
            <span>{percentFilled}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percentFilled}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{totalCount} total</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{assignedCount} assigned</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">{unassignedCount} open</span>
          <span className="rounded-full bg-yellow-50 px-2.5 py-1 font-medium text-yellow-700">{premiumCount} premium</span>
          {selectedCount > 0 && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{selectedCount} selected</span>
          )}
          <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700">
            {sourceLabel}{activeDocumentLabel ? `: ${activeDocumentLabel}` : ''}
          </span>
          {sourceSaveTime && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              Last saved {sourceSaveTime}
            </span>
          )}
          {hasPendingChanges && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
              Unsynced changes
            </span>
          )}
        </div>

        <div className="flex-1" />
        <span className="text-xs font-medium text-sky-700">{showLabel}</span>
        <span className="hidden text-xs text-slate-500 xl:inline">
          Scroll to zoom | Space+drag to pan | Shift+click for multi-select
        </span>
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
