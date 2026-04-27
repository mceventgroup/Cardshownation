'use client'

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR SHELL
//
// Three-column layout: LeftSidebar | Canvas | RightSidebar
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useEditorStore } from '@/store'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import LeftSidebar from './LeftSidebar'
import RightSidebar from './RightSidebar'

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

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  return (
    <div className="flex flex-col h-screen w-screen">
      <Toolbar />
      <div className="flex-1 flex flex-row overflow-hidden">
        <LeftSidebar />
        <div className="flex-1 relative overflow-hidden">
          <KonvaCanvas />
        </div>
        <RightSidebar />
      </div>
      <StatusBar />
    </div>
  )
}
