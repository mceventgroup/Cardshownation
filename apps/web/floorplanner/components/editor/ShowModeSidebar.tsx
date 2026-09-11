'use client'

import { useState } from 'react'
import ExportModal from './ExportModal'
import type { ShowInventoryOption } from '@floorplanner/lib/show-inventory'

interface ShowModeSidebarProps {
  onPrintShowSheet: () => void
  onSaveFloorplanImage: () => void
  onSaveVendorListImage: () => void
  onExportVendorCsv: () => void
  onPrintVendorChecklist: () => void
  onPrintVendorTablesPdf: () => void
  onPrintCaseRentals: () => void
  showCaseHighlights: boolean
  onToggleCaseHighlights: (checked: boolean) => void
  showSectionColors: boolean
  onToggleSectionColors: (checked: boolean) => void
  inventoryOptions: ShowInventoryOption[]
  selectedInventoryKey: string | null
  selectedInventoryLabel: string | null
  onSelectInventoryKey: (key: string | null) => void
  onExitShowMode: () => void
}

function ActionCard({
  label,
  description,
  onClick,
}: {
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex min-h-[108px] w-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="mt-2 text-xs leading-5 text-slate-500">{description}</div>
      </div>
      <span className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-sky-600 transition-transform group-hover:translate-x-0.5">
        Open &gt;
      </span>
    </button>
  )
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
      <span>
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
      />
    </label>
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      {description && <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div>}
    </div>
  )
}

export default function ShowModeSidebar({
  onPrintShowSheet,
  onSaveFloorplanImage,
  onSaveVendorListImage,
  onExportVendorCsv,
  onPrintVendorChecklist,
  onPrintVendorTablesPdf,
  onPrintCaseRentals,
  showCaseHighlights,
  onToggleCaseHighlights,
  showSectionColors,
  onToggleSectionColors,
  inventoryOptions,
  selectedInventoryKey,
  selectedInventoryLabel,
  onSelectInventoryKey,
  onExitShowMode,
}: ShowModeSidebarProps) {
  const [showExports, setShowExports] = useState(false)
  const actionRows = [
    {
      label: 'Print / Save PDF',
      description: 'Floor map and vendor list using the active colors.',
      onClick: onPrintShowSheet,
    },
    {
      label: 'Table Assignment Flyers',
      description: 'One flyer per vendor with assignments and upcoming shows.',
      onClick: onPrintVendorTablesPdf,
    },
    {
      label: 'Print Vendor Checklist',
      description: 'Check in vendors with payment and table info.',
      onClick: onPrintVendorChecklist,
    },
    {
      label: 'Print Case Rentals',
      description: 'Checklist for vendors renting cases.',
      onClick: onPrintCaseRentals,
    },
    {
      label: 'Save Floorplan Image',
      description: 'Export the current floor view as a PNG.',
      onClick: onSaveFloorplanImage,
    },
    {
      label: 'Save Vendor List Image',
      description: 'Export the assigned vendor roster as an image.',
      onClick: onSaveVendorListImage,
    },
    {
      label: 'Export Vendor CSV',
      description: 'Download table assignments as a CSV.',
      onClick: onExportVendorCsv,
    },
  ]

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="border-b border-slate-200 bg-white/80 px-4 py-4">
        <SectionHeader title="Show day" description="Display controls and classic print layouts." />
        <button onClick={() => setShowExports(true)} className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Print &amp; share</button>
        <p className="mt-2 text-xs text-slate-500">Floor JPEG, vendor list, table signs, and social images.</p>
        {showExports && <ExportModal onClose={() => setShowExports(false)} />}
        <div className="mt-4 rounded-3xl bg-slate-950 px-4 py-3 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Current View</div>
              <div className="mt-2 text-sm font-semibold">
                {selectedInventoryLabel ? `${selectedInventoryLabel} inventory` : showSectionColors ? 'Section colors' : 'Vendor colors'}
              </div>
              <div className="mt-1 text-xs text-slate-300">
                {selectedInventoryLabel
                  ? 'Prints and images will use the selected inventory spotlight.'
                  : showSectionColors
                    ? 'Prints and images will use section coloring.'
                    : 'Prints and images will use assigned vendor coloring.'}
              </div>
            </div>
            <button
              onClick={onExitShowMode}
              className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div>
          <SectionHeader title="Exports" description="Most-used actions are grouped up front to cut down the scrolling." />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {actionRows.map(action => (
              <ActionCard
                key={action.label}
                label={action.label}
                description={action.description}
                onClick={action.onClick}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <SectionHeader title="Display" description="Quick toggles for how the floor is highlighted." />
          <div className="mt-3 grid grid-cols-1 gap-3">
            <ToggleCard
              title="Highlight Cases"
              description="Add orange case outlines and badges."
              checked={showCaseHighlights}
              onChange={onToggleCaseHighlights}
            />
            <ToggleCard
              title="Section Colors"
              description="Use section coloring when no inventory spotlight is active."
              checked={showSectionColors}
              onChange={onToggleSectionColors}
            />
          </div>
        </div>

        <div className="mt-5">
          <SectionHeader title="Inventory View" description="Spotlight one inventory type without letting this list take over the whole sidebar." />
          <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => onSelectInventoryKey(null)}
              className={`w-full border-b border-slate-200/80 px-3 py-3 text-left text-sm transition-colors ${
                selectedInventoryKey === null
                  ? 'bg-slate-950 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold">All inventory</div>
              <div className={`mt-1 text-xs ${selectedInventoryKey === null ? 'text-slate-300' : 'text-slate-500'}`}>
                Clears the spotlight and returns to vendor or section colors.
              </div>
            </button>
            <div className="max-h-[220px] overflow-y-auto">
              {inventoryOptions.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">
                  Import vendor inventory to unlock color-coded item views.
                </div>
              ) : (
                inventoryOptions.map(option => {
                  const selected = selectedInventoryKey === option.key
                  return (
                    <label
                      key={option.key}
                      className={`flex cursor-pointer items-center justify-between gap-3 border-t border-slate-200/80 px-3 py-3 text-sm transition-colors ${
                        selected
                          ? 'bg-slate-950 text-white'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="inventory-view"
                        checked={selected}
                        onChange={() => onSelectInventoryKey(option.key)}
                        className="sr-only"
                      />
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                        <span className="truncate font-medium">{option.label}</span>
                      </span>
                      <span className={`shrink-0 text-[11px] font-semibold ${selected ? 'text-slate-200' : 'text-slate-500'}`}>
                        {option.count}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/90 px-4 py-3">
        <div className="text-xs text-slate-500">
          Tip: use the download button inside table assignment flyers if you want a saved file without using the print dialog.
        </div>
      </div>
    </aside>
  )
}
