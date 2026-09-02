'use client'

import { useState } from 'react'
import { useWarnings } from '@floorplanner/hooks/useWarnings'
import { useEditorStore, selectActiveTool, selectSelectedIds, selectSelectedRowId } from '@floorplanner/store/index'
import type { ActiveTool } from '@floorplanner/store/index'
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
import BackgroundImagePanel from './BackgroundImagePanel'

const OPEN_VENDOR_IMPORT_EVENT = 'floorplanner:open-vendor-import'

export type FloorplannerSidebarTab = 'tables' | 'space' | 'vendors' | 'setup'
type SpaceTab = 'room' | 'doors' | 'sections' | 'plan'
type SetupTab = 'settings' | 'checks'

interface LeftSidebarProps {
  activeTab: FloorplannerSidebarTab
  onTabChange: (tab: FloorplannerSidebarTab) => void
}

const TABLE_TOOLS: { tool: ActiveTool; label: string; shortcut: string }[] = [
  { tool: 'select', label: 'Select', shortcut: 'S' },
  { tool: 'place-table', label: 'Table', shortcut: 'T' },
  { tool: 'place-row', label: 'Row', shortcut: 'R' },
  { tool: 'measure', label: 'Measure', shortcut: 'M' },
]

const SPACE_TOOLS: { tool: ActiveTool; label: string; shortcut: string }[] = [
  { tool: 'select', label: 'Select', shortcut: 'S' },
  { tool: 'split-room', label: 'Split room', shortcut: 'X' },
]

const NAV_ITEMS: { value: FloorplannerSidebarTab; label: string; hint: string }[] = [
  { value: 'tables', label: 'Tables', hint: 'Place and edit tables' },
  { value: 'space', label: 'Space', hint: 'Rooms and zones' },
  { value: 'vendors', label: 'Vendors', hint: 'Assign booths' },
  { value: 'setup', label: 'Setup', hint: 'Defaults and checks' },
]

function ToolSelector({ tools }: { tools: typeof TABLE_TOOLS }) {
  const activeTool = useEditorStore(selectActiveTool)
  const setTool = useEditorStore(s => s.setActiveTool)

  return (
    <div className="grid grid-cols-2 gap-2">
      {tools.map(({ tool, label, shortcut }) => (
        <button
          key={tool}
          onClick={() => setTool(tool)}
          aria-pressed={activeTool === tool}
          className={`flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            activeTool === tool
              ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span>{label}</span>
          <kbd className="rounded border border-current/15 bg-white/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
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

  if (activeTool === 'place-table') return <TableBuilderPanel />
  if (activeTool === 'place-row') return <RowBuilderPanel />

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
    return selectedRowId ? <RowEditPanel rowId={selectedRowId} /> : <TablePropertiesPanel />
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-center">
      <p className="text-sm font-medium text-slate-700">Choose a tool to get started</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Place a table or row, then select it to edit its size, label, section, and vendor.</p>
    </div>
  )
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-4 pb-3 pt-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  )
}

function SegmentedTabs<T extends string>({ items, value, onChange }: {
  items: { value: T; label: string; badge?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="mx-3 mb-3 grid auto-cols-fr grid-flow-col rounded-xl bg-slate-200/70 p-1">
      {items.map(item => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
            value === item.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {item.label}
          {item.badge ? <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] text-red-700">{item.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

export default function LeftSidebar({ activeTab, onTabChange }: LeftSidebarProps) {
  const clearVendors = useEditorStore(s => s.clearVendors)
  const hasImportedPlan = useEditorStore(s => Object.keys(s.backgroundImages).length > 0)
  const warningCount = useWarnings().warnings.length
  const [spaceTab, setSpaceTab] = useState<SpaceTab>('room')
  const [setupTab, setSetupTab] = useState<SetupTab>('settings')

  const spaceTabs: { value: SpaceTab; label: string }[] = [
    { value: 'room', label: 'Room' },
    { value: 'doors', label: 'Doors' },
    { value: 'sections', label: 'Zones' },
    ...(hasImportedPlan ? [{ value: 'plan' as const, label: 'Plan' }] : []),
  ]

  return (
    <aside className="flex h-full w-[288px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/95 backdrop-blur-sm lg:w-[304px]">
      <nav aria-label="Floor planner tasks" className="grid grid-cols-4 gap-1 border-b border-slate-200 bg-white p-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.value}
            onClick={() => onTabChange(item.value)}
            aria-current={activeTab === item.value ? 'page' : undefined}
            title={item.hint}
            className={`rounded-xl px-1 py-2 text-xs font-semibold transition-colors ${
              activeTab === item.value
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'tables' && (
          <div>
            <PanelHeading title="Build tables" description="Choose what to place, or select existing tables to edit them." />
            <div className="space-y-3 px-3 pb-4">
              <ToolSelector tools={TABLE_TOOLS} />
              <ToolOptions />
            </div>
          </div>
        )}

        {activeTab === 'space' && (
          <div>
            <PanelHeading title="Shape the space" description="Build the room first, then add entrances and organize table zones." />
            <div className="px-3 pb-3">
              <ToolSelector tools={SPACE_TOOLS} />
            </div>
            <SegmentedTabs items={spaceTabs} value={spaceTab} onChange={setSpaceTab} />
            <div className="border-t border-slate-200 bg-white">
              {spaceTab === 'room' && <RoomPanel />}
              {spaceTab === 'doors' && <DoorsPanel />}
              {spaceTab === 'sections' && <SectionsPanel />}
              {spaceTab === 'plan' && <div className="px-3 py-3"><BackgroundImagePanel /></div>}
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div>
            <PanelHeading title="Manage vendors" description="Add vendors here, then use the roster below the canvas for assignments and check-in." />
            <VendorQuickAdd />
            <div className="space-y-3 px-3 py-3">
              <button
                onClick={() => window.dispatchEvent(new Event(OPEN_VENDOR_IMPORT_EVENT))}
                className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Import vendor list
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Remove all vendors and clear all vendor-to-table assignments?')) clearVendors()
                }}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Clear all vendors
              </button>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div>
            <PanelHeading title="Plan setup" description="Set defaults once and review anything that needs attention before printing." />
            <SegmentedTabs
              items={[
                { value: 'settings', label: 'Settings' },
                { value: 'checks', label: 'Checks', badge: warningCount },
              ]}
              value={setupTab}
              onChange={setSetupTab}
            />
            <div className="border-t border-slate-200 bg-white">
              {setupTab === 'settings' ? <SettingsPanel /> : <WarningsPanel />}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
