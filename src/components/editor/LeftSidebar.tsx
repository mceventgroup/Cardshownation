'use client'

import { useWarnings } from '@/hooks/useWarnings'
import { useEditorStore, selectActiveTool, selectSelectedIds, selectSelectedRowId } from '@/store/index'
import type { ActiveTool } from '@/store/index'
import CollapsibleSection from './CollapsibleSection'
import TableBuilderPanel from './TableBuilderPanel'
import RowBuilderPanel from './RowBuilderPanel'
import RowEditPanel from './RowEditPanel'
import TablePropertiesPanel from './TablePropertiesPanel'
import NumberingPanel from './NumberingPanel'
import RoomPanel from './RoomPanel'
import DoorsPanel from './DoorsPanel'
import SectionsPanel from './SectionsPanel'
import WarningsPanel from './WarningsPanel'
import BackgroundImagePanel from './BackgroundImagePanel'

const TOOLS: { tool: ActiveTool; label: string; shortcut: string }[] = [
  { tool: 'select',      label: 'Select',      shortcut: 'S' },
  { tool: 'place-table', label: 'Place Table',  shortcut: 'T' },
  { tool: 'place-row',   label: 'Place Row',    shortcut: 'R' },
  { tool: 'draw-room',   label: 'Draw Room',    shortcut: 'B' },
  { tool: 'draw-room-freehand', label: 'Freehand Room', shortcut: 'F' },
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

export default function LeftSidebar() {
  return (
    <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
      <CollapsibleSection title="Tables" panelId="tools">
        <ToolSelector />
        <ToolOptions />
      </CollapsibleSection>

      <CollapsibleSection title="Room" panelId="room">
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

      <CollapsibleSection title="Background Images" panelId="background-images">
        <BackgroundImagePanel />
      </CollapsibleSection>
    </div>
  )
}
