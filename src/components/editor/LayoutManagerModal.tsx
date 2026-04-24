'use client'

import { useState, useEffect } from 'react'
import { useEditorStore } from '@/store'
import {
  listLayouts, deleteLayout, renameLayout, getActiveLayoutId, clearAllLayouts,
  type LayoutEntry,
} from '@/lib/persistence'

interface Props {
  onClose: () => void
}

export default function LayoutManagerModal({ onClose }: Props) {
  const saveAs = useEditorStore(s => s.saveCurrentLayoutAs)
  const switchTo = useEditorStore(s => s.switchToLayout)

  const [layouts, setLayouts] = useState<LayoutEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')

  function refresh() {
    setLayouts(listLayouts())
    setActiveId(getActiveLayoutId())
  }

  useEffect(() => {
    refresh()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSaveNew() {
    const name = newName.trim()
    if (!name) return
    saveAs(name)
    setNewName('')
    refresh()
  }

  function handleSwitch(id: string) {
    if (id === activeId) return
    if (!window.confirm('Switch layout? Unsaved changes to the current layout are auto-saved.')) return
    switchTo(id)
    refresh()
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete layout "${name}"? This cannot be undone.`)) return
    deleteLayout(id)
    refresh()
  }

  function handleClearAll() {
    if (!window.confirm('Delete all saved layouts? This cannot be undone.')) return
    clearAllLayouts()
    refresh()
  }

  function handleRename(id: string) {
    const name = renameText.trim()
    if (!name) return
    renameLayout(id, name)
    setRenamingId(null)
    refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-base">Saved Layouts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Layout list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {layouts.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">No saved layouts yet. Save your current layout below.</p>
          )}
          {layouts.map(l => (
            <div
              key={l.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${
                l.id === activeId
                  ? 'bg-blue-600/20 border border-blue-500/40'
                  : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => handleSwitch(l.id)}
            >
              <div className="flex-1 min-w-0">
                {renamingId === l.id ? (
                  <input
                    autoFocus
                    value={renameText}
                    onChange={e => setRenameText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(l.id)
                      if (e.key === 'Escape') setRenamingId(null)
                      e.stopPropagation()
                    }}
                    onBlur={() => handleRename(l.id)}
                    onClick={e => e.stopPropagation()}
                    className="bg-gray-700 border border-blue-500 text-white text-sm rounded px-2 py-0.5 w-full focus:outline-none"
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{l.name}</span>
                      {l.id === activeId && (
                        <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {l.tableCount} tables, {l.vendorCount} vendors
                      {' — '}
                      {new Date(l.savedAt).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setRenamingId(l.id)
                    setRenameText(l.name)
                  }}
                  className="text-xs text-gray-400 hover:text-blue-400 px-1"
                >
                  rename
                </button>
                {layouts.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(l.id, l.name) }}
                    className="text-xs text-gray-400 hover:text-red-400 px-1"
                  >
                    delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Save as new */}
        <div className="px-5 py-3 border-t border-gray-700 space-y-2">
          {layouts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="w-full px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded border border-red-900/40 hover:border-red-700/60 transition-colors"
            >
              Clear All Layouts
            </button>
          )}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveNew()
                e.stopPropagation()
              }}
              placeholder="New layout name..."
              className="flex-1 bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSaveNew}
              disabled={!newName.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded"
            >
              Save As
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
