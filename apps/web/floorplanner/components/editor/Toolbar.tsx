'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditorStore, selectCanUndo, selectCanRedo } from '@floorplanner/store/index'
import { getPendingChangesMessage, hasPendingEditorChanges } from '@floorplanner/lib/editor-save-state'
import ImportModal from './ImportModal'
import ExportModal from './ExportModal'
import LayoutManagerModal from './LayoutManagerModal'
import HelpCheatSheetModal from './HelpCheatSheetModal'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  section?: string
}

interface QuickActionGroup {
  label: string
  tone?: 'default' | 'primary'
  items: MenuItem[]
}

function useMenuItems(
  startNewLayout: () => void,
  openImport: () => void,
  openExport: () => void,
  openHelp: () => void,
): Record<string, MenuItem[]> {
  const setTool = useEditorStore(s => s.setActiveTool)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const canUndo = useEditorStore(selectCanUndo)
  const canRedo = useEditorStore(selectCanRedo)

  const emit = useCallback((key: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }, [])

  const clearLayout = useEditorStore(s => s.clearLayout)
  const clearVendors = useEditorStore(s => s.clearVendors)

  return {
    File: [
      {
        label: 'New Layout',
        action: startNewLayout,
        section: 'Project',
      },
      { label: 'Import Vendors...', action: openImport, section: 'Data' },
      {
        label: 'Clear All Vendors',
        action: () => {
          if (window.confirm('Remove all vendor assignments? Tables will remain.')) {
            clearVendors()
          }
        },
        section: 'Data',
      },
      { label: 'Export...', action: openExport, section: 'Data' },
    ],
    Tools: [
      { label: 'Select', shortcut: 'S', action: () => setTool('select') },
      { label: 'Place Table', shortcut: 'T', action: () => setTool('place-table') },
      { label: 'Place Row', shortcut: 'R', action: () => setTool('place-row') },
      { label: 'Measure', shortcut: 'M', action: () => setTool('measure') },
      { label: 'Split Room', shortcut: 'X', action: () => setTool('split-room') },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: redo, disabled: !canRedo },
      { label: 'Delete Selected', shortcut: 'Del', action: () => emit('Delete') },
      {
        label: 'Select All',
        shortcut: 'Ctrl+A',
        action: () => {
          const allIds = Object.keys(useEditorStore.getState().tables)
          useEditorStore.getState().setSelected(allIds)
        },
      },
      { label: 'Rename Table', shortcut: 'Dbl-click' },
      { label: 'Renumber Tables', shortcut: 'N', action: () => emit('n') },
    ],
    View: [
      { label: 'Vendor Roster', shortcut: 'V', action: () => emit('v') },
      { label: 'Warnings', shortcut: 'W', action: () => emit('w') },
      { label: 'Zoom In', shortcut: '+', action: () => emit('+') },
      { label: 'Zoom Out', shortcut: '-', action: () => emit('-') },
      { label: 'Reset Zoom', shortcut: '0', action: () => emit('0') },
    ],
    Help: [
      { label: 'Cheat Sheet', action: openHelp },
      { label: 'Keyboard Shortcuts', shortcut: '?', action: () => emit('?') },
    ],
  }
}

export default function Toolbar() {
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

  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showLayouts, setShowLayouts] = useState(false)
  const [layoutView, setLayoutView] = useState<'browser' | 'cloud'>('browser')
  const [showHelp, setShowHelp] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [openQuickAction, setOpenQuickAction] = useState<string | null>(null)
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
    setOpenQuickAction(null)
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
    setOpenQuickAction(null)
    fileInputRef.current?.click()
  }, [confirmDiscardCurrentWork])

  const menus = useMenuItems(
    handleStartNewLayout,
    () => { setShowImport(true); setOpenMenu(null) },
    () => { setShowExport(true); setOpenMenu(null) },
    () => { setShowHelp(true); setOpenMenu(null) },
  )

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
      setOpenQuickAction(null)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpenMenu(null)
      setOpenQuickAction(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function toggleMenu(name: string) {
    setOpenQuickAction(null)
    setOpenMenu(prev => prev === name ? null : name)
  }

  const activeItems = openMenu ? menus[openMenu] ?? [] : []
  const hasPendingChanges = hasPendingEditorChanges({
    saveStatus,
    saveError,
    activeDocumentSource,
    currentDocumentHash,
    lastCloudSyncHash,
    lastFileSyncHash,
  })
  const quickActions: QuickActionGroup[] = [
    {
      label: 'Open',
      items: [
        {
          label: 'Browser Saves...',
          action: () => {
            if (!confirmDiscardCurrentWork('Open browser saves')) return
            setLayoutView('browser')
            setShowLayouts(true)
            setOpenQuickAction(null)
          },
        },
        {
          label: 'Cloud Saves...',
          action: () => {
            if (!confirmDiscardCurrentWork('Open cloud saves')) return
            setLayoutView('cloud')
            setShowLayouts(true)
            setOpenQuickAction(null)
          },
        },
        { label: 'Open File...', action: openFilePicker },
      ],
    },
    {
      label: 'Save',
      tone: 'primary',
      items: [
        { label: 'Save to Cloud', action: () => { setLayoutView('cloud'); setShowLayouts(true); setOpenQuickAction(null) } },
        { label: 'Save to File...', action: () => { useEditorStore.getState().saveLayoutToFile(); setOpenQuickAction(null) } },
        { label: 'Export...', action: () => { setShowExport(true); setOpenQuickAction(null) } },
      ],
    },
  ]

  return (
    <div className="shrink-0">
      <div ref={toolbarRef} className="border-b border-slate-200 bg-white/92 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 lg:flex-nowrap">
          <span className="pr-2 text-sm font-semibold text-slate-800">Workspace</span>

          <div className="flex flex-wrap items-center gap-1">
            {Object.keys(menus).map(name => (
              <button
                key={name}
                onClick={() => toggleMenu(name)}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  openMenu === name
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-transparent text-gray-600 hover:border-slate-200 hover:bg-gray-50',
                ].join(' ')}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="min-w-[220px] flex-1 lg:min-w-[280px]">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <label className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Title
              </label>
              <input
                type="text"
                value={settings.eventName}
                onChange={e => updateTitle(e.target.value)}
                placeholder="Floor Plan"
                className="w-full bg-transparent text-sm text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2 lg:flex-nowrap">
            {hasPendingChanges && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                Unsynced changes
              </span>
            )}
            <div className="flex items-center gap-2">
              {quickActions.map(group => (
                <div key={group.label} className="relative">
                  <button
                    onClick={() => {
                      setOpenMenu(null)
                      setOpenQuickAction(prev => prev === group.label ? null : group.label)
                    }}
                    className={[
                      'flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                      group.tone === 'primary'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span>{group.label}</span>
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {openQuickAction === group.label && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[210px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      {group.items.map(item => (
                        <button
                          key={item.label}
                          onClick={() => item.action?.()}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <span>{item.label}</span>
                          {item.shortcut && (
                            <kbd className="text-xs font-mono text-slate-400">
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowMode(true)}
              className="rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:px-4"
            >
              Show Mode
            </button>

            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 7H10a4 4 0 010 8H5" strokeLinecap="round" />
                  <path d="M3 7L6 4M3 7L6 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
                className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 7H6a4 4 0 000 8H11" strokeLinecap="round" />
                  <path d="M13 7L10 4M13 7L10 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {openMenu && activeItems.length > 0 && (
        <div className="flex h-9 items-center gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 px-4">
          {activeItems.map(item => (
            <div key={item.label} className="flex items-center gap-1">
              {item.section && (
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {item.section}
                </span>
              )}
              <button
                onClick={() => {
                  if (!item.disabled && item.action) item.action()
                }}
                disabled={item.disabled}
                className={[
                  'flex items-center gap-2 px-3 py-1 rounded text-sm whitespace-nowrap transition-colors',
                  item.disabled
                    ? 'text-gray-400 cursor-default'
                    : 'text-gray-700 hover:bg-white hover:shadow-sm active:bg-gray-100',
                ].join(' ')}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <kbd className="text-xs font-mono text-gray-400 bg-white border border-gray-200 rounded px-1 py-0.5">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
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
