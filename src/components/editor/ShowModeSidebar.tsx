'use client'

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
  onExitShowMode: () => void
}

function ShowModeActionButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
      {label}
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
  onExitShowMode,
}: ShowModeSidebarProps) {
  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/95 backdrop-blur-sm">
      <div className="border-b border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Show Mode</div>
        <div className="mt-1 text-sm text-slate-600">Print exports and display options for the live floor.</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Print & Export</div>
          <div className="mt-3 space-y-2">
            <ShowModeActionButton label="Print / Save PDF" onClick={onPrintShowSheet} />
            <ShowModeActionButton label="Save Floorplan Image" onClick={onSaveFloorplanImage} />
            <ShowModeActionButton label="Save Vendor List Image" onClick={onSaveVendorListImage} />
            <ShowModeActionButton label="Export Vendor CSV" onClick={onExportVendorCsv} />
            <ShowModeActionButton label="Print Vendor Checklist" onClick={onPrintVendorChecklist} />
            <ShowModeActionButton label="Vendor Tables PDF" onClick={onPrintVendorTablesPdf} />
            <ShowModeActionButton label="Print Case Rentals" onClick={onPrintCaseRentals} />
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Display</div>
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <span>Highlight Cases</span>
              <input
                type="checkbox"
                checked={showCaseHighlights}
                onChange={e => onToggleCaseHighlights(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <span>Section Colors</span>
              <input
                type="checkbox"
                checked={showSectionColors}
                onChange={e => onToggleSectionColors(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/90 px-4 py-4">
        <button
          onClick={onExitShowMode}
          className="w-full rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Exit Show Mode
        </button>
      </div>
    </aside>
  )
}
