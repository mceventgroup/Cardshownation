'use client'

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS LEGEND
//
// Modal overlay showing all available keyboard shortcuts.
// Toggled via ? key or the ? button in the toolbar.
// ─────────────────────────────────────────────────────────────────────────────

interface ShortcutsLegendProps {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'Tools',
    shortcuts: [
      { keys: 'S', desc: 'Select tool' },
      { keys: 'T', desc: 'Place single table' },
      { keys: 'R', desc: 'Place row of tables' },
      { keys: 'M', desc: 'Measure between two points' },
      { keys: 'B', desc: 'Draw room rectangle (repeat for multiple rooms)' },
      { keys: 'C', desc: 'Draw circular room from a drag box' },
      { keys: 'F', desc: 'Freehand room polygon' },
      { keys: 'Esc', desc: 'Back to select tool' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: 'Click', desc: 'Select table' },
      { keys: 'Shift+Click', desc: 'Range select in row / toggle' },
      { keys: 'Ctrl+A', desc: 'Select all tables' },
      { keys: 'Click empty', desc: 'Clear selection' },
      { keys: 'Drag empty', desc: 'Box select' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: 'Delete', desc: 'Delete selected tables' },
      { keys: 'Ctrl+C', desc: 'Copy selected tables' },
      { keys: 'Ctrl+V', desc: 'Paste tables' },
      { keys: 'Ctrl+Z', desc: 'Undo' },
      { keys: 'Ctrl+Y', desc: 'Redo' },
      { keys: 'Dbl-click', desc: 'Rename table label' },
    ],
  },
  {
    title: 'Panels',
    shortcuts: [
      { keys: 'N', desc: 'Renumber selected tables (2+)' },
      { keys: 'V', desc: 'Toggle vendor roster' },
      { keys: 'W', desc: 'Toggle warnings panel' },
      { keys: '?', desc: 'Toggle this legend' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'Scroll', desc: 'Zoom in/out' },
      { keys: 'Space+Drag', desc: 'Pan canvas' },
      { keys: 'Middle Drag', desc: 'Pan canvas' },
    ],
  },
]

export default function ShortcutsLegend({ onClose }: ShortcutsLegendProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-lg w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map(s => (
                  <div key={s.keys} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{s.desc}</span>
                    <kbd className="text-xs font-mono bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 whitespace-nowrap">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Press <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-1 py-0.5">?</kbd> to close
        </p>
      </div>
    </div>
  )
}
