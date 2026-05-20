'use client'

import { useEditorStore, selectSettings, selectGridVisible } from '@/store/index'
import CollapsibleSection from './CollapsibleSection'

export default function SettingsPanel() {
  const settings = useEditorStore(selectSettings)
  const gridVisible = useEditorStore(selectGridVisible)
  const dispatch = useEditorStore(s => s.dispatch)
  const setGridVisible = useEditorStore(s => s.setGridVisible)

  const wallSetbackFt = Math.round(settings.wallSetback / 12 * 10) / 10
  const wallThicknessIn = Math.round(settings.wallThickness)
  const tableLengthFt = Math.round(settings.defaultTableWidth / 12 * 10) / 10
  const canvasWidthFt = Math.round(settings.canvasWidth / 12 * 10) / 10
  const canvasHeightFt = Math.round(settings.canvasHeight / 12 * 10) / 10

  function updateSetting<T extends keyof typeof settings>(key: T, value: (typeof settings)[T]) {
    dispatch({
      type: 'UPDATE_SETTINGS',
      prev: { [key]: settings[key] },
      next: { [key]: value },
      timestamp: Date.now(),
    })
  }

  return (
    <div className="text-sm">
      <CollapsibleSection title="Canvas" panelId="settings-canvas">
        <div className="space-y-3 bg-white px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Map Width</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={1}
                  value={canvasWidthFt}
                  onChange={e => updateSetting('canvasWidth', Math.max(120, (parseFloat(e.target.value) || canvasWidthFt) * 12))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <span className="text-xs text-slate-500">ft</span>
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Map Height</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={1}
                  value={canvasHeightFt}
                  onChange={e => updateSetting('canvasHeight', Math.max(120, (parseFloat(e.target.value) || canvasHeightFt) * 12))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <span className="text-xs text-slate-500">ft</span>
              </div>
            </label>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-3 py-2">
            <span>
              <span className="block font-medium text-slate-800">Show Grid</span>
              <span className="block text-xs text-slate-500">Keep spacing visible on the floor.</span>
            </span>
            <input
              type="checkbox"
              checked={gridVisible}
              onChange={e => setGridVisible(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-3 py-2">
            <span>
              <span className="block font-medium text-slate-800">Snap to Grid</span>
              <span className="block text-xs text-slate-500">Keep rows and aisle spacing tidy.</span>
            </span>
            <input
              type="checkbox"
              checked={settings.snapToGrid}
              onChange={e => updateSetting('snapToGrid', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Spacing" panelId="settings-spacing">
        <div className="space-y-3 bg-white px-4 py-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Grid Size</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={6}
                max={48}
                step={6}
                value={settings.gridSize}
                onChange={e => updateSetting('gridSize', Math.max(6, parseInt(e.target.value, 10) || 12))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-500">in</span>
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Wall Thickness</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={24}
                step={1}
                value={wallThicknessIn}
                onChange={e => updateSetting('wallThickness', Math.max(1, parseInt(e.target.value, 10) || 6))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-500">in</span>
            </div>
            <span className="mt-1 block text-xs text-slate-500">Rendered as a physical wall band outside the usable room footprint.</span>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Wall Setback</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={wallSetbackFt}
                onChange={e => updateSetting('wallSetback', Math.max(0, (parseFloat(e.target.value) || 0) * 12))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-500">ft</span>
            </div>
            <span className="mt-1 block text-xs text-slate-500">Keep tables away from room walls.</span>
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-3 py-2">
            <span>
              <span className="block font-medium text-slate-800">Show Wall Setback</span>
              <span className="block text-xs text-slate-500">Display the setback band on the map background.</span>
            </span>
            <input
              type="checkbox"
              checked={settings.showWallSetback}
              onChange={e => updateSetting('showWallSetback', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Table Defaults" panelId="settings-table-defaults">
        <div className="grid grid-cols-2 gap-3 bg-white px-4 py-4">
          <label>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Length</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={4}
                max={12}
                step={0.5}
                value={tableLengthFt}
                onChange={e => updateSetting('defaultTableWidth', Math.max(48, (parseFloat(e.target.value) || 6) * 12))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-500">ft</span>
            </div>
          </label>
          <label>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Depth</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={24}
                max={48}
                step={6}
                value={settings.defaultTableHeight}
                onChange={e => updateSetting('defaultTableHeight', Math.max(24, parseInt(e.target.value, 10) || 30))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-500">in</span>
            </div>
          </label>
        </div>
      </CollapsibleSection>
    </div>
  )
}
