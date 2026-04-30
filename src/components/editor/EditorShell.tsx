'use client'

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR SHELL
//
// Three-column layout: LeftSidebar | Canvas | RightSidebar
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useEditorStore, selectShowMode } from '@/store/index'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import LeftSidebar from './LeftSidebar'
import KonvaCanvas from './KonvaCanvas'
import HelpCheatSheetModal from './HelpCheatSheetModal'
import FirstRunModal from './FirstRunModal'

const FIRST_RUN_BYPASS_KEY = 'floorplanner:onboarding:bypass'

export default function EditorShell() {
  useKeyboardShortcuts()
  const hydrateFromStorage = useEditorStore(s => s.hydrateFromStorage)
  const showMode = useEditorStore(selectShowMode)
  const setShowMode = useEditorStore(s => s.setShowMode)
  const [showHelp, setShowHelp] = useState(false)
  const [showFirstRun, setShowFirstRun] = useState(false)

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(FIRST_RUN_BYPASS_KEY) !== 'true') {
      setShowFirstRun(true)
    }
  }, [])

  const persistBypass = useCallback((skipNextTime: boolean) => {
    if (typeof window === 'undefined') return
    if (skipNextTime) {
      window.localStorage.setItem(FIRST_RUN_BYPASS_KEY, 'true')
    } else {
      window.localStorage.removeItem(FIRST_RUN_BYPASS_KEY)
    }
  }, [])

  const handleStart = useCallback((skipNextTime: boolean) => {
    persistBypass(skipNextTime)
    setShowFirstRun(false)
  }, [persistBypass])

  const handleOpenHelp = useCallback((skipNextTime: boolean) => {
    persistBypass(skipNextTime)
    setShowFirstRun(false)
    setShowHelp(true)
  }, [persistBypass])

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      {!showMode && <Toolbar />}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-row overflow-hidden">
          {!showMode && <LeftSidebar />}
          <div className="relative flex-1 overflow-hidden">
            <KonvaCanvas />
            {showMode && (
              <button
                onClick={() => setShowMode(false)}
                className="absolute left-4 top-4 z-30 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-lg backdrop-blur-sm hover:bg-white"
              >
                Exit Show Mode
              </button>
            )}
          </div>
        </div>
      </div>
      {!showMode && <StatusBar />}
      {showHelp && <HelpCheatSheetModal onClose={() => setShowHelp(false)} />}
      {showFirstRun && !showMode && (
        <FirstRunModal
          onStart={handleStart}
          onOpenHelp={handleOpenHelp}
        />
      )}
    </div>
  )
}
