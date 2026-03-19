'use client'

import { useEditorStore } from '@/store/index'

export default function StatusBar() {
  // Select primitive values only — never use Object.values() or array constructors
  // inside a selector, as they return a new reference on every call and cause
  // useSyncExternalStore to loop.
  const totalCount    = useEditorStore(s => Object.keys(s.tables).length)
  const selectedCount = useEditorStore(s => s.selectedIds.size)

  return (
    <div className="h-7 bg-white border-t border-gray-200 flex items-center gap-4 px-4 text-xs text-gray-500 shrink-0">
      <span>{totalCount} table{totalCount !== 1 ? 's' : ''}</span>
      {selectedCount > 0 && (
        <span className="text-blue-600">{selectedCount} selected</span>
      )}
      <div className="flex-1" />
      <span>Scroll to zoom · Space+drag to pan · T = table · R = row · V = select</span>
    </div>
  )
}
