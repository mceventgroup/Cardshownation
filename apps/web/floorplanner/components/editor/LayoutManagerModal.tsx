'use client'

import { useEffect, useState } from 'react'
import { useEditorStore } from '@floorplanner/store/index'
import { getPendingChangesMessage, hasPendingEditorChanges } from '@floorplanner/lib/editor-save-state'
import { extractDocumentSlice } from '@floorplanner/lib/persistence'
import {
  clearAllLayouts,
  deleteLayout,
  duplicateLayout,
  getActiveLayoutId,
  listLayouts,
  recoverLayoutsFromStorage,
  renameLayout,
  type LayoutEntry,
} from '@floorplanner/lib/persistence'
import {
  CloudQuotaExceededError,
  CloudRevisionConflictError,
  deleteCloudLayout,
  getCloudSession,
  listCloudLayouts,
  loadCloudLayout,
  saveCloudLayout,
  type CloudLayoutSummary,
} from '@floorplanner/lib/cloud-layouts'

interface Props {
  onClose: () => void
  initialView?: 'browser' | 'cloud'
}

function formatSavedAt(savedAt: string): string {
  const d = new Date(savedAt)
  if (Number.isNaN(d.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export default function LayoutManagerModal({ onClose, initialView = 'browser' }: Props) {
  const darkFieldClassName =
    'bg-gray-800 border border-gray-600 text-gray-100 placeholder:text-gray-400 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500'
  const saveAs = useEditorStore(s => s.saveCurrentLayoutAs)
  const switchTo = useEditorStore(s => s.switchToLayout)
  const loadDocumentSlice = useEditorStore(s => s.loadDocumentSlice)
  const markCloudSaved = useEditorStore(s => s.markCloudSaved)
  const title = useEditorStore(s => s.settings.eventName)
  const activeCloudLayoutId = useEditorStore(s => s.activeCloudLayoutId)
  const activeCloudLayoutName = useEditorStore(s => s.activeCloudLayoutName)
  const activeCloudLayoutRevision = useEditorStore(s => s.activeCloudLayoutRevision)

  const [layouts, setLayouts] = useState<LayoutEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)

  const [cloudLayouts, setCloudLayouts] = useState<CloudLayoutSummary[]>([])
  const [cloudName, setCloudName] = useState('')
  const [cloudStatus, setCloudStatus] = useState<string | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudAvailable, setCloudAvailable] = useState(false)
  const [cloudAuthenticated, setCloudAuthenticated] = useState(false)
  const [activeView, setActiveView] = useState<'browser' | 'cloud'>(initialView)

  function confirmDiscardCurrentWork(action: string) {
    const state = useEditorStore.getState()
    if (!hasPendingEditorChanges({
      saveStatus: state.saveStatus,
      saveError: state.saveError,
      activeDocumentSource: state.activeDocumentSource,
      currentDocumentHash: state.currentDocumentHash,
      lastCloudSyncHash: state.lastCloudSyncHash,
      lastFileSyncHash: state.lastFileSyncHash,
    })) {
      return true
    }
    return window.confirm(getPendingChangesMessage(action))
  }

  function refresh() {
    setLayouts(listLayouts())
    setActiveId(getActiveLayoutId())
  }

  async function refreshCloudLayouts(authenticated = cloudAuthenticated) {
    if (!authenticated) {
      setCloudLayouts([])
      return
    }

    setCloudLoading(true)
    setCloudError(null)
    try {
      setCloudLayouts(await listCloudLayouts())
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Failed to list cloud layouts.')
    } finally {
      setCloudLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    void getCloudSession()
      .then(session => {
        setCloudAvailable(session.available)
        setCloudAuthenticated(session.authenticated)
        if (session.authenticated) {
          void refreshCloudLayouts(true)
        }
      })
      .catch(error => {
        setCloudError(error instanceof Error ? error.message : 'Failed to check cloud session.')
      })

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSaveNew() {
    const name = newName.trim() || title.trim() || 'Floor Plan'
    if (!name) return
    saveAs(name)
    setNewName('')
    refresh()
  }

  function handleSwitch(id: string) {
    if (id === activeId) return
    if (!confirmDiscardCurrentWork('Open another browser layout')) return
    switchTo(id)
    refresh()
    onClose()
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete layout "${name}"? This cannot be undone.`)) return
    deleteLayout(id)
    refresh()
  }

  function handleDuplicate(id: string, name: string) {
    if (!confirmDiscardCurrentWork('Duplicate another browser layout')) return
    const duplicateId = duplicateLayout(id, `${name} Copy`)
    if (!duplicateId) {
      setRecoveryMessage(`Could not duplicate "${name}".`)
      return
    }
    switchTo(duplicateId)
    refresh()
    setRecoveryMessage(`Created and opened "${name} Copy".`)
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

  function handleRecover() {
    const recoveredCount = recoverLayoutsFromStorage()
    refresh()
    setRecoveryMessage(
      recoveredCount > 0
        ? `Recovered ${recoveredCount} saved layout${recoveredCount === 1 ? '' : 's'}.`
        : 'No recoverable saved layouts were found in this browser profile.',
    )
  }

  async function persistCloudLayout(input: {
    id: string | null
    name: string
    expectedRevision: number | null
    successVerb: 'Saved' | 'Overwrote'
  }) {
    const saved = await saveCloudLayout({
      id: input.id,
      name: input.name,
      data: extractDocumentSlice(useEditorStore.getState()),
      expectedRevision: input.expectedRevision,
    })
    markCloudSaved({ id: saved.id, name: saved.name, revision: saved.revision, savedAt: saved.savedAt })
    setCloudName(saved.name)
    setCloudStatus(`${input.successVerb} "${saved.name}" ${input.successVerb === 'Saved' ? 'to' : 'in'} cloud.`)
    await refreshCloudLayouts()
  }

  async function handleCloudSave(saveAsNew = false) {
    const name =
      cloudName.trim() ||
      title.trim() ||
      activeCloudLayoutName ||
      newName.trim() ||
      'Floor Plan'
    if (!cloudAuthenticated) {
      setCloudError('Your cloud session is not active. Refresh the page and try again.')
      return
    }

    setCloudLoading(true)
    setCloudError(null)
    setCloudStatus(null)
    try {
      await persistCloudLayout({
        id: saveAsNew ? null : activeCloudLayoutId,
        name,
        expectedRevision: saveAsNew ? null : activeCloudLayoutRevision,
        successVerb: saveAsNew || !activeCloudLayoutId ? 'Saved' : 'Overwrote',
      })
    } catch (error) {
      if (error instanceof CloudRevisionConflictError) {
        setCloudError(error.message)
      } else if (error instanceof CloudQuotaExceededError) {
        setCloudError(error.message)
      } else {
        setCloudError(error instanceof Error ? error.message : 'Failed to save cloud layout.')
      }
    } finally {
      setCloudLoading(false)
    }
  }

  async function handleCloudOverwrite(layout: CloudLayoutSummary) {
    if (!cloudAuthenticated) {
      setCloudError('Your cloud session is not active. Refresh the page and try again.')
      return
    }
    if (!window.confirm(
      `Overwrite cloud layout "${layout.name}" with the floor plan currently on the canvas?`,
    )) return

    setCloudLoading(true)
    setCloudError(null)
    setCloudStatus(null)
    try {
      await persistCloudLayout({
        id: layout.id,
        name: layout.name,
        expectedRevision: layout.revision,
        successVerb: 'Overwrote',
      })
    } catch (error) {
      if (error instanceof CloudRevisionConflictError) {
        setCloudError(`${error.message} Refresh the cloud list before overwriting again.`)
      } else {
        setCloudError(error instanceof Error ? error.message : 'Failed to overwrite cloud layout.')
      }
    } finally {
      setCloudLoading(false)
    }
  }

  async function handleCloudLoad(id: string) {
    if (!cloudAuthenticated) {
      setCloudError('Your cloud session is not active. Refresh the page and try again.')
      return
    }
    if (!confirmDiscardCurrentWork('Load a cloud layout')) return

    setCloudLoading(true)
    setCloudError(null)
    setCloudStatus(null)
    try {
      const layout = await loadCloudLayout(id)
      loadDocumentSlice(layout.data, {
        source: 'cloud',
        label: layout.name,
        cloudLayout: { id: layout.id, name: layout.name, revision: layout.revision },
      })
      setCloudName(layout.name)
      setCloudStatus(`Loaded "${layout.name}" from cloud.`)
      refresh()
      onClose()
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Failed to load cloud layout.')
    } finally {
      setCloudLoading(false)
    }
  }

  async function handleCloudDelete(id: string, name: string) {
    if (!cloudAuthenticated) {
      setCloudError('Your cloud session is not active. Refresh the page and try again.')
      return
    }
    if (!window.confirm(`Delete cloud layout "${name}"? This cannot be undone.`)) return

    setCloudLoading(true)
    setCloudError(null)
    setCloudStatus(null)
    try {
      await deleteCloudLayout(id)
      if (activeCloudLayoutId === id) {
        useEditorStore.getState().setActiveCloudLayout(null)
      }
      setCloudStatus(`Deleted "${name}" from cloud.`)
      await refreshCloudLayouts()
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Failed to delete cloud layout.')
    } finally {
      setCloudLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-manager-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-slate-700 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="project-manager-title" className="text-lg font-semibold text-white">Projects</h2>
              <p className="mt-1 text-xs text-slate-400">Your work saves in this browser automatically. Use cloud sync when you need it on another device.</p>
            </div>
            <button onClick={onClose} aria-label="Close projects" className="rounded-lg p-1 text-2xl leading-none text-slate-400 hover:bg-slate-800 hover:text-white">&times;</button>
          </div>
          <div className="mt-4 inline-flex rounded-xl bg-slate-800 p-1">
            <button
              onClick={() => setActiveView('browser')}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'browser'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700',
              ].join(' ')}
            >
              This device
            </button>
            <button
              onClick={() => setActiveView('cloud')}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'cloud'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700',
              ].join(' ')}
            >
              Cloud sync
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <div
            className={[
              'h-full min-h-0 flex-col',
              activeView === 'cloud' ? 'hidden' : 'flex',
            ].join(' ')}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Saved on this device</h3>
                <p className="mt-1 text-xs text-slate-400">The active project is continuously autosaved.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRecover} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">Recover</button>
                {layouts.length > 0 && (
                  <button onClick={handleClearAll} className="rounded-lg border border-red-900/60 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/40">Clear all</button>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">
              {recoveryMessage && (
                <p className="mb-3 text-xs text-amber-200 bg-amber-950/40 border border-amber-900/40 rounded px-3 py-2">
                  {recoveryMessage}
                </p>
              )}
              {layouts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-300">No named projects yet</p>
                  <p className="mt-1 text-xs text-slate-500">Name the current floor plan below to keep it in your project list.</p>
                </div>
              )}
              {layouts.map(l => (
                <div
                  key={l.id}
                  className={`group flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    l.id === activeId
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/70 hover:border-slate-600'
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
                        className="w-full rounded px-2 py-0.5 text-sm text-white placeholder:text-gray-400 bg-gray-700 border border-blue-500 focus:outline-none"
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
                          {' - '}
                          {formatSavedAt(l.savedAt)}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setRenamingId(l.id)
                        setRenameText(l.name)
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-blue-300"
                    >
                      Rename
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDuplicate(l.id, l.name) }}
                      className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
                    >
                      Duplicate
                    </button>
                    {layouts.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(l.id, l.name) }}
                        className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-950/50 hover:text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={[ 'h-full min-h-0 flex-col', activeView === 'browser' ? 'hidden' : 'flex' ].join(' ')}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Cloud sync</h3>
                <p className="mt-1 text-xs text-slate-400">Keep one current project available across your devices.</p>
              </div>
              {cloudAvailable && cloudAuthenticated && (
                <button
                  onClick={() => void refreshCloudLayouts()}
                  disabled={cloudLoading}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Refresh
                </button>
              )}
            </div>
            <div className="space-y-3 border-b border-slate-800 p-4 sm:p-5">
              {!cloudAvailable && (
                <p className="text-xs text-gray-400">
                  Cloud save is disabled on this deployment until the server is configured with a database and floor-planner session secret.
                </p>
              )}
              {cloudAvailable && !cloudAuthenticated && (
                <p className="text-xs text-amber-300">
                  Your cloud session could not be started. Refresh the page and try again.
                </p>
              )}
              {cloudAvailable && cloudAuthenticated && (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={cloudName}
                      onChange={e => setCloudName(e.target.value)}
                      placeholder={
                        activeCloudLayoutName
                          ? `Current: ${activeCloudLayoutName}`
                          : title.trim()
                            ? `Use title: ${title.trim()}`
                            : 'Cloud layout name...'
                      }
                      className={`min-w-0 flex-1 text-sm ${darkFieldClassName}`}
                    />
                    <button
                      onClick={() => void handleCloudSave(false)}
                      disabled={cloudLoading}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {activeCloudLayoutId ? 'Sync changes' : 'Save to cloud'}
                    </button>
                    {activeCloudLayoutId && (
                      <button
                        onClick={() => void handleCloudSave(true)}
                        disabled={cloudLoading}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-emerald-500 disabled:opacity-50"
                      >
                        Save As New
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Cloud sync never replaces a newer revision without warning you first.
                  </p>
                </>
              )}
              {cloudStatus && <p className="text-xs text-emerald-300">{cloudStatus}</p>}
              {cloudError && <p className="text-xs text-red-300">{cloudError}</p>}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">
              {cloudLoading && cloudAuthenticated && (
                <p className="py-6 text-center text-sm text-gray-500">Loading cloud layouts...</p>
              )}
              {cloudAvailable && !cloudAuthenticated && (
                <p className="text-gray-500 text-sm text-center py-6">Cloud layouts are unavailable for this session.</p>
              )}
              {cloudAvailable && cloudAuthenticated && !cloudLoading && cloudLayouts.length === 0 && !cloudError && (
                <p className="text-gray-500 text-sm text-center py-6">No cloud layouts saved yet.</p>
              )}
              {cloudLayouts.map(l => (
                <div
                  key={l.id}
                  className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 transition-colors sm:flex-row sm:items-center ${
                    l.id === activeCloudLayoutId
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/70'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{l.name}</span>
                      {l.id === activeCloudLayoutId && (
                        <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {l.tableCount} tables, {l.vendorCount} vendors
                      {' - '}
                      {formatSavedAt(l.savedAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      onClick={() => void handleCloudOverwrite(l)}
                      disabled={cloudLoading}
                      className="text-xs rounded border border-emerald-700 px-2 py-1 text-emerald-300 hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-50"
                    >
                      Sync here
                    </button>
                    <button
                      onClick={() => void handleCloudLoad(l.id)}
                      disabled={cloudLoading}
                      className="text-xs rounded border border-gray-600 px-2 py-1 text-gray-200 hover:border-blue-500"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => void handleCloudDelete(l.id, l.name)}
                      disabled={cloudLoading}
                      className="text-xs rounded border border-gray-600 px-2 py-1 text-gray-200 hover:border-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {activeView === 'browser' && (
        <div className="space-y-2 border-t border-slate-700 px-5 py-4 sm:px-6">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Name this project</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveNew()
                e.stopPropagation()
              }}
              placeholder={title.trim() ? title.trim() : 'Floor plan name'}
              className={`min-w-0 flex-1 text-sm ${darkFieldClassName}`}
            />
            <button
              onClick={handleSaveNew}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Save named copy
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
