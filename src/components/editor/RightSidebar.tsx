'use client'

import { useWarnings } from '@/hooks/useWarnings'
import CollapsibleSection from './CollapsibleSection'
import SectionsPanel from './SectionsPanel'
import WarningsPanel from './WarningsPanel'

function WarningsBadge() {
  const result = useWarnings()
  if (result.warnings.length === 0) return null
  return (
    <span className="text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-medium">
      {result.warnings.length}
    </span>
  )
}

export default function RightSidebar() {
  return (
    <div className="w-72 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <CollapsibleSection title="Sections" panelId="sections">
        <SectionsPanel />
      </CollapsibleSection>

      <CollapsibleSection title="Warnings" panelId="warnings" badge={<WarningsBadge />}>
        <WarningsPanel />
      </CollapsibleSection>

      {/* Fill remaining space */}
      <div className="flex-1" />
    </div>
  )
}
