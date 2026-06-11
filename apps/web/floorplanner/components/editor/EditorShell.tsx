'use client'

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR SHELL
//
// Three-column layout: LeftSidebar | Canvas | RightSidebar
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { useKeyboardShortcuts } from '@floorplanner/hooks/useKeyboardShortcuts'
import { useEditorStore, selectShowCaseHighlights, selectShowMode, selectShowSectionColors } from '@floorplanner/store/index'
import { exportFloorplanImage, exportVendorAssignmentsCsv, exportVendorListImage, printShowModeSheet, printVendorManifest, printVendorTableAssignments } from '@floorplanner/lib/export'
import { loadFromLocalStorage, type DocumentSlice } from '@floorplanner/lib/persistence'
import { configureFloorplannerRuntime } from '@floorplanner/lib/runtime'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import LeftSidebar from './LeftSidebar'
import ShowModeSidebar from './ShowModeSidebar'
import KonvaCanvas from './KonvaCanvas'
import VendorDrawer from './VendorDrawer'
import ShowModeVendorList from './ShowModeVendorList'
import HelpCheatSheetModal from './HelpCheatSheetModal'
import FirstRunModal from './FirstRunModal'

const FIRST_RUN_BYPASS_KEY = 'floorplanner:onboarding:bypass'

function readBypassPreference(): boolean {
  try {
    return window.localStorage.getItem(FIRST_RUN_BYPASS_KEY) === 'true'
  } catch {
    return false
  }
}

function writeBypassPreference(skipNextTime: boolean): void {
  try {
    if (skipNextTime) {
      window.localStorage.setItem(FIRST_RUN_BYPASS_KEY, 'true')
    } else {
      window.localStorage.removeItem(FIRST_RUN_BYPASS_KEY)
    }
  } catch {
    // Ignore browsers that block localStorage access.
  }
}

type EditorShellProps = {
  cloudBasePath: string
  initialCloudLayout?: {
    id: string
    name: string
    revision: number
    data: DocumentSlice
  } | null
  showLabel: string
  storageNamespace: string
}

export default function EditorShell({
  cloudBasePath,
  initialCloudLayout,
  showLabel,
  storageNamespace,
}: EditorShellProps) {
  useKeyboardShortcuts()
  const hydrateFromStorage = useEditorStore(s => s.hydrateFromStorage)
  const loadDocumentSlice = useEditorStore(s => s.loadDocumentSlice)
  const showMode = useEditorStore(selectShowMode)
  const showCaseHighlights = useEditorStore(selectShowCaseHighlights)
  const showSectionColors = useEditorStore(selectShowSectionColors)
  const setShowMode = useEditorStore(s => s.setShowMode)
  const setShowCaseHighlights = useEditorStore(s => s.setShowCaseHighlights)
  const setShowSectionColors = useEditorStore(s => s.setShowSectionColors)
  const tables = useEditorStore(s => s.tables)
  const sections = useEditorStore(s => s.sections)
  const vendors = useEditorStore(s => s.vendors)
  const assignments = useEditorStore(s => s.vendorAssignments)
  const room = useEditorStore(s => s.room)
  const doors = useEditorStore(s => s.doors)
  const backgroundImages = useEditorStore(s => s.backgroundImages)
  const settings = useEditorStore(s => s.settings)
  const setActiveCloudLayout = useEditorStore(s => s.setActiveCloudLayout)
  const [showHelp, setShowHelp] = useState(false)
  const [showFirstRun, setShowFirstRun] = useState(false)
  const [activeTab, setActiveTab] = useState<'layout' | 'vendors' | 'settings'>('layout')

  useEffect(() => {
    configureFloorplannerRuntime({
      cloudBasePath,
      showLabel,
      storageNamespace,
    })
    hydrateFromStorage()
    if (!loadFromLocalStorage() && initialCloudLayout) {
      loadDocumentSlice(initialCloudLayout.data)
      setActiveCloudLayout({
        id: initialCloudLayout.id,
        name: initialCloudLayout.name,
        revision: initialCloudLayout.revision,
      })
    }
  }, [
    cloudBasePath,
    hydrateFromStorage,
    initialCloudLayout,
    loadDocumentSlice,
    setActiveCloudLayout,
    showLabel,
    storageNamespace,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!readBypassPreference()) {
      setShowFirstRun(true)
    }
  }, [])

  const persistBypass = useCallback((skipNextTime: boolean) => {
    if (typeof window === 'undefined') return
    writeBypassPreference(skipNextTime)
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

  const handleTabChange = useCallback((nextTab: 'layout' | 'vendors' | 'settings') => {
    setActiveTab(nextTab)
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-slate-100">
      {!showMode && <Toolbar />}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-row overflow-hidden">
          {showMode ? (
            <ShowModeSidebar
              onPrintShowSheet={() => printShowModeSheet(tables, sections, vendors, assignments, room, 'Show Sheet', doors, backgroundImages)}
              onSaveFloorplanImage={() => exportFloorplanImage(
                tables,
                sections,
                vendors,
                assignments,
                room,
                doors,
                { showVendorNames: false, showPaymentStatus: false, title: 'Floor Plan' },
                backgroundImages,
                'floorplan.png',
              )}
              onSaveVendorListImage={() => exportVendorListImage(tables, vendors, assignments, 'Vendor List', 'vendor-list.png')}
              onExportVendorCsv={() => exportVendorAssignmentsCsv(tables, vendors, assignments, room, 'vendor-list')}
              onPrintVendorChecklist={() => printVendorManifest(tables, vendors, assignments, 'Vendor Checklist')}
              onPrintVendorTablesPdf={() => printVendorTableAssignments(tables, sections, vendors, assignments, settings)}
              onPrintCaseRentals={() => printVendorManifest(tables, vendors, assignments, 'Case Rental Checklist', { casesOnly: true })}
              showCaseHighlights={showCaseHighlights}
              onToggleCaseHighlights={setShowCaseHighlights}
              showSectionColors={showSectionColors}
              onToggleSectionColors={setShowSectionColors}
              onExitShowMode={() => setShowMode(false)}
            />
          ) : (
            <LeftSidebar activeTab={activeTab} onTabChange={handleTabChange} />
          )}
          <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <KonvaCanvas />
            </div>
            {!showMode && <VendorDrawer active={activeTab === 'vendors'} />}
          </div>
          {showMode && <ShowModeVendorList />}
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
