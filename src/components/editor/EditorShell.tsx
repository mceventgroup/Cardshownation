'use client'

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR SHELL
//
// Three-column layout: LeftSidebar | Canvas | RightSidebar
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useEditorStore, selectCollapsedPanels } from '@/store/index'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import LeftSidebar from './LeftSidebar'
import VendorRosterPanel from './VendorRosterPanel'

const KonvaCanvas = dynamic(() => import('./KonvaCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-200 text-gray-500 text-sm">
      Loading canvas…
    </div>
  ),
})

export default function EditorShell() {
  useKeyboardShortcuts()
  const hydrateFromStorage = useEditorStore(s => s.hydrateFromStorage)
  const collapsed = useEditorStore(selectCollapsedPanels)
  const togglePanelCollapsed = useEditorStore(s => s.togglePanelCollapsed)
  const vendorDockCollapsed = collapsed.has('vendor-dock')

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  return (
    <div className="flex flex-col h-screen w-screen">
      <Toolbar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-row overflow-hidden">
          <LeftSidebar />
          <div className="flex-1 relative overflow-hidden">
            <KonvaCanvas />
          </div>
        </div>
        <div className={`border-t border-gray-200 overflow-hidden bg-white ${vendorDockCollapsed ? 'h-10' : 'h-72'}`}>
          <button
            onClick={() => togglePanelCollapsed('vendor-dock')}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-200"
          >
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${vendorDockCollapsed ? '' : 'rotate-90'}`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M4 2l4 4-4 4z" />
            </svg>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1 text-left">
              Vendors
            </span>
          </button>
          {!vendorDockCollapsed && (
            <div className="h-[calc(100%-41px)]">
              <VendorRosterPanel />
            </div>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
