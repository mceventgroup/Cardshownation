'use client'

import { useEditorStore, selectCollapsedPanels } from '@/store/index'

interface CollapsibleSectionProps {
  title: string
  panelId: string
  badge?: React.ReactNode
  children: React.ReactNode
  defaultCollapsed?: boolean
}

export default function CollapsibleSection({
  title,
  panelId,
  badge,
  children,
}: CollapsibleSectionProps) {
  const collapsed = useEditorStore(selectCollapsedPanels)
  const toggle = useEditorStore(s => s.togglePanelCollapsed)
  const isCollapsed = collapsed.has(panelId)

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => toggle(panelId)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
      >
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M4 2l4 4-4 4z" />
        </svg>
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1 text-left">
          {title}
        </span>
        {badge}
      </button>
      {!isCollapsed && (
        <div className="overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  )
}
