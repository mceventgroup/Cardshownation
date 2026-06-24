'use client'

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR SHELL
//
// Three-column layout: LeftSidebar | Canvas | RightSidebar
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useKeyboardShortcuts } from '@floorplanner/hooks/useKeyboardShortcuts'
import { useEditorStore, selectShowCaseHighlights, selectShowInventoryKey, selectShowMode, selectShowSectionColors } from '@floorplanner/store/index'
import { exportFloorplanImage, exportVendorAssignmentsCsv, exportVendorListImage, printShowModeSheet, printVendorManifest, printVendorTableAssignments } from '@floorplanner/lib/export'
import { hasPendingEditorChanges } from '@floorplanner/lib/editor-save-state'
import { loadFromLocalStorage, type DocumentSlice } from '@floorplanner/lib/persistence'
import { configureFloorplannerRuntime } from '@floorplanner/lib/runtime'
import { buildShowInventoryOptions } from '@floorplanner/lib/show-inventory'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import LeftSidebar from './LeftSidebar'
import ShowModeSidebar from './ShowModeSidebar'
import VendorDrawer from './VendorDrawer'
import ShowModeVendorList from './ShowModeVendorList'
import HelpCheatSheetModal from './HelpCheatSheetModal'
import FirstRunModal from './FirstRunModal'

const KonvaCanvas = dynamic(() => import('./KonvaCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-200 text-sm text-slate-600">
      Loading canvas...
    </div>
  ),
})

const FIRST_RUN_BYPASS_KEY = 'floorplanner:onboarding:bypass'
const EDITOR_THEME_KEY = 'floorplanner:theme'

type EditorTheme = 'light' | 'dark'

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

function readEditorThemePreference(): EditorTheme {
  try {
    return window.localStorage.getItem(EDITOR_THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function writeEditorThemePreference(theme: EditorTheme): void {
  try {
    window.localStorage.setItem(EDITOR_THEME_KEY, theme)
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
  const showInventoryKey = useEditorStore(selectShowInventoryKey)
  const setShowMode = useEditorStore(s => s.setShowMode)
  const setShowCaseHighlights = useEditorStore(s => s.setShowCaseHighlights)
  const setShowSectionColors = useEditorStore(s => s.setShowSectionColors)
  const setShowInventoryKey = useEditorStore(s => s.setShowInventoryKey)
  const saveStatus = useEditorStore(s => s.saveStatus)
  const saveError = useEditorStore(s => s.saveError)
  const activeDocumentSource = useEditorStore(s => s.activeDocumentSource)
  const currentDocumentHash = useEditorStore(s => s.currentDocumentHash)
  const lastCloudSyncHash = useEditorStore(s => s.lastCloudSyncHash)
  const lastFileSyncHash = useEditorStore(s => s.lastFileSyncHash)
  const tables = useEditorStore(s => s.tables)
  const sections = useEditorStore(s => s.sections)
  const vendors = useEditorStore(s => s.vendors)
  const assignments = useEditorStore(s => s.vendorAssignments)
  const room = useEditorStore(s => s.room)
  const doors = useEditorStore(s => s.doors)
  const backgroundImages = useEditorStore(s => s.backgroundImages)
  const settings = useEditorStore(s => s.settings)
  const inventoryOptions = useMemo(() => buildShowInventoryOptions(vendors), [vendors])
  const selectedInventoryOption = useMemo(
    () => inventoryOptions.find(option => option.key === showInventoryKey) ?? null,
    [inventoryOptions, showInventoryKey],
  )
  const [showHelp, setShowHelp] = useState(false)
  const [showFirstRun, setShowFirstRun] = useState(false)
  const [activeTab, setActiveTab] = useState<'layout' | 'vendors' | 'settings'>('layout')
  const [theme, setTheme] = useState<EditorTheme>('light')

  useEffect(() => {
    configureFloorplannerRuntime({
      cloudBasePath,
      showLabel,
      storageNamespace,
    })
    hydrateFromStorage()
    if (!loadFromLocalStorage() && initialCloudLayout) {
      loadDocumentSlice(initialCloudLayout.data, {
        source: 'cloud',
        label: initialCloudLayout.name,
        cloudLayout: {
          id: initialCloudLayout.id,
          name: initialCloudLayout.name,
          revision: initialCloudLayout.revision,
        },
      })
    }
  }, [
    cloudBasePath,
    hydrateFromStorage,
    initialCloudLayout,
    loadDocumentSlice,
    showLabel,
    storageNamespace,
  ])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasPendingEditorChanges({
        saveStatus,
        saveError,
        activeDocumentSource,
        currentDocumentHash,
        lastCloudSyncHash,
        lastFileSyncHash,
      })) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [
    activeDocumentSource,
    currentDocumentHash,
    lastCloudSyncHash,
    lastFileSyncHash,
    saveError,
    saveStatus,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!readBypassPreference()) {
      setShowFirstRun(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setTheme(readEditorThemePreference())
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.remove('fp-theme-light', 'fp-theme-dark')
    document.body.classList.add(`fp-theme-${theme}`)

    return () => {
      document.body.classList.remove('fp-theme-light', 'fp-theme-dark')
    }
  }, [theme])

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

  const handleToggleTheme = useCallback(() => {
    setTheme(currentTheme => {
      const nextTheme: EditorTheme = currentTheme === 'dark' ? 'light' : 'dark'
      writeEditorThemePreference(nextTheme)
      return nextTheme
    })
  }, [])

  return (
    <div className={`fp-theme-root fp-theme-${theme} flex h-full w-full flex-col ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-950'}`}>
      {!showMode && <Toolbar theme={theme} onToggleTheme={handleToggleTheme} />}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-row overflow-hidden">
          {showMode ? (
            <ShowModeSidebar
              onPrintShowSheet={() => printShowModeSheet(
                tables,
                sections,
                vendors,
                assignments,
                room,
                'Print Sheet',
                doors,
                backgroundImages,
                {
                  showSectionColors,
                  showInventoryKey,
                },
              )}
              onSaveFloorplanImage={() => exportFloorplanImage(
                tables,
                sections,
                vendors,
                assignments,
                room,
                doors,
                {
                  showVendorNames: false,
                  showPaymentStatus: false,
                  title: 'Floor Plan',
                  showSectionColors,
                  showInventoryKey,
                },
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
              inventoryOptions={inventoryOptions}
              selectedInventoryKey={showInventoryKey}
              selectedInventoryLabel={selectedInventoryOption?.label ?? null}
              onSelectInventoryKey={setShowInventoryKey}
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
