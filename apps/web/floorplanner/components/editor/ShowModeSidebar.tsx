'use client'

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

function ShowModeActionButton({
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
      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="text-sm font-semibold text-slate-800">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </button>
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
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] backdrop-blur-sm">
      <div className="border-b border-slate-200 bg-white/85 px-4 py-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Print</div>
        <div className="mt-1 text-sm text-slate-600">Print exports and display options for the live floor.</div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-3 text-white shadow-sm">
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Print & Export</div>
          <div className="mt-3 space-y-2">
            <ShowModeActionButton label="Print / Save PDF" description="Floor map and vendor list using the active show colors." onClick={onPrintShowSheet} />
            <ShowModeActionButton label="Save Floorplan Image" description="Export the current floor view as a PNG." onClick={onSaveFloorplanImage} />
            <ShowModeActionButton label="Save Vendor List Image" description="Export the assigned vendor roster as an image." onClick={onSaveVendorListImage} />
            <ShowModeActionButton label="Export Vendor CSV" description="Download table assignments as a spreadsheet-ready CSV." onClick={onExportVendorCsv} />
            <ShowModeActionButton label="Print Vendor Checklist" description="Check in vendors with payment and table info." onClick={onPrintVendorChecklist} />
            <ShowModeActionButton label="Table Assignment Flyers" description="Print one flyer per vendor with their table assignment." onClick={onPrintVendorTablesPdf} />
            <ShowModeActionButton label="Print Case Rentals" description="Print a checklist for vendors renting cases." onClick={onPrintCaseRentals} />
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Display</div>
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700">
              <span>
                <span className="block font-semibold text-slate-800">Highlight Cases</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Add orange case outlines and badges.</span>
              </span>
              <input
                type="checkbox"
                checked={showCaseHighlights}
                onChange={e => onToggleCaseHighlights(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700">
              <span>
                <span className="block font-semibold text-slate-800">Section Colors</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Use section coloring when no inventory spotlight is active.</span>
              </span>
              <input
                type="checkbox"
                checked={showSectionColors}
                onChange={e => onToggleSectionColors(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory View</div>
          <div className="mt-1 text-sm text-slate-600">Pick an item type to spotlight matching vendors on the floor.</div>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => onSelectInventoryKey(null)}
              className={`w-full rounded-2xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                selectedInventoryKey === null
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold">All inventory</div>
              <div className={`mt-1 text-xs ${selectedInventoryKey === null ? 'text-slate-300' : 'text-slate-500'}`}>
                Clears the spotlight and returns to vendor or section colors.
              </div>
            </button>
            {inventoryOptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                Import vendor inventory to unlock color-coded item views.
              </div>
            ) : (
              inventoryOptions.map(option => {
                const selected = selectedInventoryKey === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onSelectInventoryKey(option.key)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                      <span className="truncate font-medium">{option.label}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {option.count}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/90 px-4 py-4">
        <button
          onClick={onExitShowMode}
          className="w-full rounded-2xl border border-slate-200 bg-slate-900 px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Back to Edit
        </button>
      </div>
    </aside>
  )
}
