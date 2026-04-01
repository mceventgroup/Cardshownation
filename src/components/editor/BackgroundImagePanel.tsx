'use client'
// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE PANEL
//
// Sidebar panel that lists imported background images with controls for
// visibility, opacity, lock, and removal.
// ─────────────────────────────────────────────────────────────────────────────

import { useEditorStore, selectBackgroundImages } from '@/store/index'
import type { BackgroundImageId } from '@/domain/types'

export default function BackgroundImagePanel() {
  const bgImages = useEditorStore(selectBackgroundImages)
  const updateBg = useEditorStore(s => s.updateBackgroundImage)
  const removeBg = useEditorStore(s => s.removeBackgroundImage)

  const images = Object.values(bgImages).sort((a, b) => a.order - b.order)

  if (images.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Background Images ({images.length})
      </h3>
      {images.map(img => (
        <div key={img.id} className="p-2 bg-gray-50 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 truncate flex-1">{img.name}</span>
            <button
              onClick={() => updateBg(img.id as BackgroundImageId, { visible: !img.visible })}
              title={img.visible ? 'Hide' : 'Show'}
              className={`text-xs px-1.5 py-0.5 rounded ${img.visible ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}
            >
              {img.visible ? 'Visible' : 'Hidden'}
            </button>
            <button
              onClick={() => updateBg(img.id as BackgroundImageId, { locked: !img.locked })}
              title={img.locked ? 'Unlock' : 'Lock position'}
              className={`text-xs px-1.5 py-0.5 rounded ${img.locked ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}
            >
              {img.locked ? 'Locked' : 'Unlocked'}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Remove "${img.name}"?`)) {
                  removeBg(img.id as BackgroundImageId)
                }
              }}
              title="Remove image"
              className="text-xs text-gray-400 hover:text-red-500"
            >
              &times;
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-14">Opacity</label>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={img.opacity}
              onChange={e => updateBg(img.id as BackgroundImageId, { opacity: parseFloat(e.target.value) })}
              className="flex-1 h-1"
            />
            <span className="text-xs text-gray-400 w-8 text-right">{Math.round(img.opacity * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}
