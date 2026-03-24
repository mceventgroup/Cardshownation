'use client'

import { useEditorStore } from '@/store/index'

export default function StatusBar() {
  // Select primitive values only — never use Object.values() or array constructors
  // inside a selector, as they return a new reference on every call and cause
  // useSyncExternalStore to loop.
  const totalCount    = useEditorStore(s => Object.keys(s.tables).length)
  const assignedCount = useEditorStore(s => Object.keys(s.vendorAssignments).length)
  const selectedCount = useEditorStore(s => s.selectedIds.size)
  const saveStatus    = useEditorStore(s => s.saveStatus)
  const saveError     = useEditorStore(s => s.saveError)

  const unassignedCount = totalCount - assignedCount

  return (
    <div className="h-7 bg-white border-t border-gray-200 flex items-center gap-4 px-4 text-xs text-gray-500 shrink-0">
      <span>{totalCount} table{totalCount !== 1 ? 's' : ''}</span>
      {totalCount > 0 && (
        <>
          <span className="text-green-600">{assignedCount} assigned</span>
          {unassignedCount > 0 && (
            <span className="text-amber-500">{unassignedCount} unassigned</span>
          )}
        </>
      )}
      {selectedCount > 0 && (
        <span className="text-blue-600">{selectedCount} selected</span>
      )}
      <div className="flex-1" />
      <span>Scroll to zoom · Space+drag to pan · T = table · R = row · V = select</span>
      {saveStatus === 'saving' && (
        <span className="text-gray-400">Saving…</span>
      )}
      {saveStatus === 'saved' && (
        <span className="text-green-600">Saved ✓</span>
      )}
      {saveStatus === 'error' && (
        <span className="text-red-500" title={saveError === 'quota-exceeded' ? 'Storage full — clear space or export your layout.' : 'Save failed.'}>
          {saveError === 'quota-exceeded' ? 'Storage full ⚠' : 'Save error ⚠'}
        </span>
      )}
    </div>
  )
}
