'use client'

import { useState, useCallback } from 'react'
import { useEditorStore, selectCanUndo, selectCanRedo } from '@/store/index'
import ImportModal from './ImportModal'
import ExportModal from './ExportModal'
import LayoutManagerModal from './LayoutManagerModal'

// ─────────────────────────────────────────────────────────────────────────────
// MENU DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
}

function useMenuItems(openImport: () => void, openExport: () => void, openLayouts: () => void) {
  const setTool  = useEditorStore(s => s.setActiveTool)
  const undo     = useEditorStore(s => s.undo)
  const redo     = useEditorStore(s => s.redo)
  const canUndo  = useEditorStore(selectCanUndo)
  const canRedo  = useEditorStore(selectCanRedo)

  const emit = useCallback((key: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }, [])

  const clearLayout = useEditorStore(s => s.clearLayout)
  const clearVendors = useEditorStore(s => s.clearVendors)

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New Layout', action: () => {
        if (window.confirm('Start a new layout? Current work will be cleared.')) {
          clearLayout()
        }
      }},
      { label: 'Saved Layouts…', action: openLayouts },
      { label: 'Import Vendors…', action: openImport },
      { label: 'Clear All Vendors', action: () => {
        if (window.confirm('Remove all vendor assignments? Tables will remain.')) {
          clearVendors()
        }
      }},
      { label: 'Export…', action: openExport },
    ],
    Tools: [
      { label: 'Select',       shortcut: 'S',   action: () => setTool('select') },
      { label: 'Place Table',  shortcut: 'T',   action: () => setTool('place-table') },
      { label: 'Place Row',    shortcut: 'R',   action: () => setTool('place-row') },
    ],
    Edit: [
      { label: 'Undo',            shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },
      { label: 'Redo',            shortcut: 'Ctrl+Y', action: redo, disabled: !canRedo },
      { label: 'Delete Selected', shortcut: 'Del',    action: () => emit('Delete') },
      { label: 'Select All',      shortcut: 'Ctrl+A', action: () => {
        const allIds = Object.keys(useEditorStore.getState().tables)
        useEditorStore.getState().setSelected(allIds)
      }},
      { label: 'Rename Table',    shortcut: 'Dbl-click' },
      { label: 'Renumber Tables', shortcut: 'N',   action: () => emit('n') },
    ],
    View: [
      { label: 'Vendor Roster',  shortcut: 'V', action: () => emit('v') },
      { label: 'Warnings',       shortcut: 'W', action: () => emit('w') },
      { label: 'Zoom In',        shortcut: '+', action: () => emit('+') },
      { label: 'Zoom Out',       shortcut: '-', action: () => emit('-') },
      { label: 'Reset Zoom',     shortcut: '0', action: () => emit('0') },
    ],
    Help: [
      { label: 'Keyboard Shortcuts', shortcut: '?', action: () => emit('?') },
    ],
  }

  return menus
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR
// ─────────────────────────────────────────────────────────────────────────────

export default function Toolbar() {
  const canUndo    = useEditorStore(selectCanUndo)
  const canRedo    = useEditorStore(selectCanRedo)
  const undo       = useEditorStore(s => s.undo)
  const redo       = useEditorStore(s => s.redo)

  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showLayouts, setShowLayouts] = useState(false)
  const menus = useMenuItems(
    () => { setShowImport(true); setOpenMenu(null) },
    () => { setShowExport(true); setOpenMenu(null) },
    () => { setShowLayouts(true); setOpenMenu(null) },
  )
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  function toggleMenu(name: string) {
    setOpenMenu(prev => prev === name ? null : name)
  }

  const activeItems = openMenu ? menus[openMenu] ?? [] : []

  return (
    <div className="shrink-0">
      {/* ── Top bar: menu tabs + quick tools ───────────────────────────── */}
      <div className="h-10 bg-white border-b border-gray-200 flex items-center">
        {/* App name */}
        <span className="font-semibold text-gray-800 text-sm px-4">Floorplanner</span>

        {/* Menu tabs */}
        {Object.keys(menus).map(name => (
          <button
            key={name}
            onClick={() => toggleMenu(name)}
            className={[
              'h-full px-3 text-sm transition-colors border-b-2',
              openMenu === name
                ? 'bg-gray-50 text-blue-700 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50 border-transparent',
            ].join(' ')}
          >
            {name}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="p-1.5 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7H10a4 4 0 010 8H5" strokeLinecap="round" />
              <path d="M3 7L6 4M3 7L6 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            className="p-1.5 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13 7H6a4 4 0 000 8H11" strokeLinecap="round" />
              <path d="M13 7L10 4M13 7L10 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Submenu ribbon ─────────────────────────────────────────────── */}
      {openMenu && activeItems.length > 0 && (
        <div className="h-9 bg-gray-50 border-b border-gray-200 flex items-center gap-1 px-4 overflow-x-auto">
          {activeItems.map(item => (
            <button
              key={item.label}
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
          ))}
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showLayouts && <LayoutManagerModal onClose={() => setShowLayouts(false)} />}
    </div>
  )
}
