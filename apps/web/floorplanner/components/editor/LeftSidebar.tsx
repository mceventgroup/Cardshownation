'use client'

import { useWarnings } from '@floorplanner/hooks/useWarnings'
import { useEditorStore, selectActiveTool, selectSelectedIds, selectSelectedRowId } from '@floorplanner/store/index'
import type { ActiveTool } from '@floorplanner/store/index'
import CollapsibleSection from './CollapsibleSection'
import TableBuilderPanel from './TableBuilderPanel'
import BulkTableEditPanel from './BulkTableEditPanel'
import RowBuilderPanel from './RowBuilderPanel'
import RowEditPanel from './RowEditPanel'
import TablePropertiesPanel from './TablePropertiesPanel'
import NumberingPanel from './NumberingPanel'
import RoomPanel from './RoomPanel'
import DoorsPanel from './DoorsPanel'
import SectionsPanel from './SectionsPanel'
import WarningsPanel from './WarningsPanel'
import SettingsPanel from './SettingsPanel'
import VendorQuickAdd from './VendorQuickAdd'

const OPEN_VENDOR_IMPORT_EVENT = 'floorplanner:open-vendor-import'

interface LeftSidebarProps {
  activeTab: 'layout' | 'vendors' | 'settings'
  onTabChange: (tab: 'layout' | 'vendors' | 'settings') => void
}

const TOOLS: { tool: ActiveTool; label: string; shortcut: string }[] = [
  { tool: 'select',      label: 'Select',      shortcut: 'S' },
  { tool: 'place-table', label: 'Place Table',  shortcut: 'T' },
  { tool: 'place-row',   label: 'Place Row',    shortcut: 'R' },
  { tool: 'split-room', label: 'Split Room', shortcut: 'X' },
]

function ToolSelector() {
  const activeTool = useEditorStore(selectActiveTool)
  const setTool = useEditorStore(s => s.setActiveTool)

  return (
    <div className="px-3 pt-2 pb-1 space-y-0.5">
      {TOOLS.map(({ tool, label, shortcut }) => (
        <button
          key={tool}
          onClick={() => setTool(tool)}
          className={[
            'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-sm transition-colors',
            activeTool === tool
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100',
          ].join(' ')}
        >
          <span>{label}</span>
          <kbd className="text-xs font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded px-1 py-0.5">
            {shortcut}
          </kbd>
        </button>
      ))}
    </div>
  )
}

function ToolOptions() {
  const activeTool = useEditorStore(selectActiveTool)
  const selectedIds = useEditorStore(selectSelectedIds)
  const selectedRowId = useEditorStore(selectSelectedRowId)

  if (activeTool === 'place-table') {
    return <TableBuilderPanel />
  }

  if (activeTool === 'place-row') {
    return <RowBuilderPanel />
  }

  // Select tool — contextual panels
  if (selectedIds.size >= 2) {
    return (
      <>
        <BulkTableEditPanel />
        {selectedRowId && <RowEditPanel rowId={selectedRowId} />}
        <NumberingPanel />
      </>
    )
  }

  if (selectedIds.size === 1) {
    if (selectedRowId) {
      return <RowEditPanel rowId={selectedRowId} />
    }
    return <TablePropertiesPanel />
  }

  return null
}

function WarningsBadge() {
  const result = useWarnings()
  if (result.warnings.length === 0) return null
  return (
    <span className="text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-medium">
      {result.warnings.length}
    </span>
  )
}

export default function LeftSidebar({ activeTab, onTabChange }: LeftSidebarProps) {
  const clearVendors = useEditorStore(s => s.clearVendors)

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/95 backdrop-blur-sm">
      <div className="border-b border-slate-200 bg-white/90 px-3 py-3 shadow-sm">
        <div className="rounded-2xl bg-slate-100 p-1">
          <div className="grid grid-cols-3 gap-1">
            {[
              ['layout', 'Layout'],
              ['vendors', 'Vendors'],
              ['settings', 'Settings'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => onTabChange(value as typeof activeTab)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'layout' && (
          <div className="space-y-0">
            <CollapsibleSection title="Tables" panelId="tools">
              <ToolSelector />
              <ToolOptions />
            </CollapsibleSection>

            <CollapsibleSection title="Add Room" panelId="room">
              <RoomPanel />
            </CollapsibleSection>

            <CollapsibleSection title="Doors" panelId="doors">
              <DoorsPanel />
            </CollapsibleSection>

            <CollapsibleSection title="Sections" panelId="sections">
              <SectionsPanel />
            </CollapsibleSection>

            <CollapsibleSection title="Warnings" panelId="warnings" badge={<WarningsBadge />}>
              <WarningsPanel />
            </CollapsibleSection>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="flex h-full flex-col">
            <VendorQuickAdd />
            <div className="space-y-3 px-3 py-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vendor Tools</div>
                <div className="mt-3 grid gap-2">
                  <button
                    onClick={() => window.dispatchEvent(new Event(OPEN_VENDOR_IMPORT_EVENT))}
                    className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Import Vendors
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Remove all vendors and clear all vendor-to-table assignments?')) {
                        clearVendors()
                      }
                    }}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Clear All Vendors
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Full vendor roster stays in the bottom drawer for search, multi-select delete, assignment status, and inline table-count edits.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && <SettingsPanel />}
      </div>
    </aside>
  )
}
