'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditorStore, selectCanUndo, selectCanRedo, selectSelectedIds, selectTables } from '@floorplanner/store/index'
import type { TableId } from '@floorplanner/domain/types'
import { getPendingChangesMessage, hasPendingEditorChanges } from '@floorplanner/lib/editor-save-state'
import ImportModal from './ImportModal'
import ExportModal from './ExportModal'
import LayoutManagerModal from './LayoutManagerModal'
import HelpCheatSheetModal from './HelpCheatSheetModal'
import BackgroundImageModal from './BackgroundImageModal'

const OPEN_HELP_EVENT = 'floorplanner:open-help'
const OPEN_VENDOR_IMPORT_EVENT = 'floorplanner:open-vendor-import'

interface ToolbarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Toolbar({ theme, onToggleTheme }: ToolbarProps) {
  const canUndo = useEditorStore(selectCanUndo)
  const canRedo = useEditorStore(selectCanRedo)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const loadFromFile = useEditorStore(s => s.loadLayoutFromFile)
  const setShowMode = useEditorStore(s => s.setShowMode)
  const settings = useEditorStore(s => s.settings)
  const dispatch = useEditorStore(s => s.dispatch)
  const saveStatus = useEditorStore(s => s.saveStatus)
  const saveError = useEditorStore(s => s.saveError)
  const activeDocumentSource = useEditorStore(s => s.activeDocumentSource)
  const currentDocumentHash = useEditorStore(s => s.currentDocumentHash)
  const lastCloudSyncHash = useEditorStore(s => s.lastCloudSyncHash)
  const lastFileSyncHash = useEditorStore(s => s.lastFileSyncHash)
  const selectedIds = useEditorStore(selectSelectedIds)
  const tables = useEditorStore(selectTables)

  const [showImport, setShowImport] = useState(false)
  const [showFloorPlanImport, setShowFloorPlanImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showLayouts, setShowLayouts] = useState(false)
  const [layoutView, setLayoutView] = useState<'browser' | 'cloud'>('browser')
  const [showHelp, setShowHelp] = useState(false)
  const [openMenu, setOpenMenu] = useState<'project' | 'more' | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const confirmDiscardCurrentWork = useCallback((action: string) => {
    const state = useEditorStore.getState()
    if (!hasPendingEditorChanges({
      saveStatus: state.saveStatus,
      saveError: state.saveError,
      activeDocumentSource: state.activeDocumentSource,
      currentDocumentHash: state.currentDocumentHash,
      lastCloudSyncHash: state.lastCloudSyncHash,
      lastFileSyncHash: state.lastFileSyncHash,
    })) {
      return true
    }
    return window.confirm(getPendingChangesMessage(action))
  }, [])

  const handleStartNewLayout = useCallback(() => {
    if (!confirmDiscardCurrentWork('Start a new layout')) return
    if (!window.confirm('Start a new layout? Current work will be cleared.')) return
    useEditorStore.getState().clearLayout()
    setOpenMenu(null)
  }, [confirmDiscardCurrentWork])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const err = await loadFromFile(file)
    if (err) setFileError(err)
  }, [loadFromFile])

  const openFilePicker = useCallback(() => {
    if (!confirmDiscardCurrentWork('Open a file')) return
    setOpenMenu(null)
    fileInputRef.current?.click()
  }, [confirmDiscardCurrentWork])

  const openBrowserLayouts = useCallback(() => {
    if (!confirmDiscardCurrentWork('Open browser saves')) return
    setLayoutView('browser')
    setShowLayouts(true)
    setOpenMenu(null)
  }, [confirmDiscardCurrentWork])

  const openCloudLayouts = useCallback(() => {
    if (!confirmDiscardCurrentWork('Open cloud saves')) return
    setLayoutView('cloud')
    setShowLayouts(true)
    setOpenMenu(null)
  }, [confirmDiscardCurrentWork])

  const saveToCloud = useCallback(() => {
    setLayoutView('cloud')
    setShowLayouts(true)
    setOpenMenu(null)
  }, [])

  const saveToFile = useCallback(() => {
    useEditorStore.getState().saveLayoutToFile()
    setOpenMenu(null)
  }, [])

  const openHelp = useCallback(() => {
    setOpenMenu(null)
    window.setTimeout(() => {
      setShowHelp(true)
    }, 0)
  }, [])

  const updateTitle = useCallback((value: string) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      prev: { eventName: settings.eventName },
      next: { eventName: value },
      timestamp: Date.now(),
    })
  }, [dispatch, settings.eventName])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (toolbarRef.current?.contains(target)) return
      setOpenMenu(null)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpenMenu(null)
    }

    function handleOpenHelp() {
      openHelp()
    }

    function handleOpenVendorImport() {
      setOpenMenu(null)
      window.setTimeout(() => {
        setShowImport(true)
      }, 0)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener(OPEN_HELP_EVENT, handleOpenHelp)
    window.addEventListener(OPEN_VENDOR_IMPORT_EVENT, handleOpenVendorImport)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener(OPEN_HELP_EVENT, handleOpenHelp)
      window.removeEventListener(OPEN_VENDOR_IMPORT_EVENT, handleOpenVendorImport)
    }
  }, [openHelp])

  function toggleMenu(name: 'project' | 'more') {
    setOpenMenu(prev => prev === name ? null : name)
  }

  const hasPendingChanges = hasPendingEditorChanges({
    saveStatus,
    saveError,
    activeDocumentSource,
    currentDocumentHash,
    lastCloudSyncHash,
    lastFileSyncHash,
  })
  const selectedTableIds = [...selectedIds].filter(id => tables[id]) as TableId[]
  const selectedPremiumCount = selectedTableIds.filter(id => tables[id]?.premium).length
  const hasSelection = selectedTableIds.length > 0
  const allSelectedPremium = hasSelection && selectedPremiumCount === selectedTableIds.length

  const toggleSelectedPremium = useCallback(() => {
    if (selectedTableIds.length === 0) return

    const nextPremium = !allSelectedPremium
    const prev = Object.fromEntries(
      selectedTableIds.map(id => [id, tables[id]?.premium ?? false]),
    )

    dispatch({
      type: 'SET_TABLE_PREMIUM',
      tableIds: selectedTableIds,
      premium: nextPremium,
      prev,
      timestamp: Date.now(),
    })
  }, [allSelectedPremium, dispatch, selectedTableIds, tables])

  return (
    <div ref={toolbarRef} className="relative z-30 shrink-0">
      <div className="border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <button
            onClick={() => toggleMenu('project')}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'project'}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
              openMenu === 'project'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Project
            <svg className={`h-3.5 w-3.5 transition-transform ${openMenu === 'project' ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="min-w-[210px] flex-1 xl:max-w-xl">
            <label className="sr-only" htmlFor="floorplanner-title">Floor plan title</label>
            <input
              id="floorplanner-title"
              type="text"
              value={settings.eventName}
              onChange={e => updateTitle(e.target.value)}
              placeholder="Untitled floor plan"
              className="w-full rounded-xl border border-transparent bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="mr-1 flex items-center rounded-xl border border-slate-200 bg-white p-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 7H10a4 4 0 010 8H5" strokeLinecap="round" />
                  <path d="M3 7L6 4M3 7L6 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 7H6a4 4 0 000 8H11" strokeLinecap="round" />
                  <path d="M13 7L10 4M13 7L10 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {hasPendingChanges && (
              <span className="hidden rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-700 2xl:inline-flex">
                Not synced
              </span>
            )}

            {hasSelection && (
              <button
                onClick={toggleSelectedPremium}
                title={`Toggle premium for selected tables (P)`}
                className={`hidden rounded-xl px-3 py-2 text-sm font-medium lg:inline-flex ${
                  allSelectedPremium
                    ? 'border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
                    : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {allSelectedPremium ? 'Premium On' : 'Mark Premium'}
              </button>
            )}

            <button
              onClick={saveToCloud}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save
            </button>

            <button
              onClick={() => { setShowExport(true); setOpenMenu(null) }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export
            </button>

            <button
              onClick={() => setShowMode(true)}
              className="hidden rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Print
            </button>

            <button
              onClick={() => toggleMenu('more')}
              aria-label="More floor planner options"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'more'}
              className={`rounded-xl border p-2 transition-colors ${openMenu === 'more' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {openMenu === 'project' && (
        <div role="menu" className="absolute left-3 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Start or open</div>
          {[
            ['New floor plan', 'Start with an empty canvas', handleStartNewLayout],
            ['Browser saves', 'Layouts saved on this device', openBrowserLayouts],
            ['Cloud saves', 'Open or manage synced layouts', openCloudLayouts],
            ['Open backup file', 'Load a .json floor plan', openFilePicker],
          ].map(([label, description, action]) => (
            <button key={label as string} role="menuitem" onClick={action as () => void} className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50">
              <span className="block text-sm font-medium text-slate-800">{label as string}</span>
              <span className="block text-xs text-slate-500">{description as string}</span>
            </button>
          ))}
          <div className="my-2 border-t border-slate-100" />
          <button role="menuitem" onClick={saveToFile} className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50">
            <span className="block text-sm font-medium text-slate-800">Download backup</span>
            <span className="block text-xs text-slate-500">Save an editable copy to your computer</span>
          </button>
          <button role="menuitem" onClick={() => { setShowFloorPlanImport(true); setOpenMenu(null) }} className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50">
            <span className="block text-sm font-medium text-slate-800">Import floor plan image</span>
            <span className="block text-xs text-slate-500">Trace over an existing map</span>
          </button>
        </div>
      )}

      {openMenu === 'more' && (
        <div role="menu" className="absolute right-3 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          <button role="menuitem" onClick={() => { setShowMode(true); setOpenMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:hidden">
            Print view
          </button>
          <button role="menuitem" onClick={() => { onToggleTheme(); setOpenMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Appearance
            <span className="text-xs font-normal text-slate-400">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button role="menuitem" onClick={openHelp} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Help & shortcuts
            <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-xs font-normal text-slate-400">?</kbd>
          </button>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showFloorPlanImport && <BackgroundImageModal onClose={() => setShowFloorPlanImport(false)} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showLayouts && <LayoutManagerModal initialView={layoutView} onClose={() => setShowLayouts(false)} />}
      {showHelp && <HelpCheatSheetModal onClose={() => setShowHelp(false)} />}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {fileError && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-2 rounded shadow-lg z-50 flex items-center gap-3">
          <span>{fileError}</span>
          <button onClick={() => setFileError(null)} className="ml-2 font-bold hover:opacity-75">x</button>
        </div>
      )}
    </div>
  )
}
