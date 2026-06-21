'use client'

import { useEffect, useState } from 'react'
import { useEditorStore } from '@floorplanner/store/index'
import { getPendingChangesMessage, hasPendingEditorChanges } from '@floorplanner/lib/editor-save-state'
import { extractDocumentSlice } from '@floorplanner/lib/persistence'
import {
  clearAllLayouts,
  deleteLayout,
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
  loginCloudSession,
  listCloudLayouts,
  loadCloudLayout,
  logoutCloudSession,
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
  return d.toISOString().slice(0, 10)
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

  const [cloudPassword, setCloudPassword] = useState('')
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

  async function handleCloudSignIn() {
    if (!cloudPassword.trim()) {
      setCloudError('Enter the cloud admin password first.')
      return
    }

    setCloudLoading(true)
    setCloudError(null)
    setCloudStatus(null)
    try {
      await loginCloudSession(cloudPassword)
      setCloudAuthenticated(true)
      setCloudPassword('')
      await refreshCloudLayouts(true)
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Failed to sign in to cloud save.')
    } finally {
      setCloudLoading(false)
    }
  }

  async function handleCloudSignOut() {
    setCloudLoading(true)
    setCloudError(null)
    setCloudStatus(null)
    try {
      await logoutCloudSession()
      setCloudAuthenticated(false)
      setCloudLayouts([])
      setCloudPassword('')
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Failed to sign out of cloud save.')
    } finally {
      setCloudLoading(false)
    }
  }

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

  async function handleCloudSave() {
    const name =
      cloudName.trim() ||
      title.trim() ||
      activeCloudLayoutName ||
      newName.trim() ||
      'Floor Plan'
    if (!cloudAuthenticated) {
      setCloudError('Sign in to cloud save first.')
      return
    }

    setCloudLoading(true)
    setCloudError(null)
    setCloudStatus(null)
    try {
      const saved = await saveCloudLayout({
        id: activeCloudLayoutId,
        name,
        data: extractDocumentSlice(useEditorStore.getState()),
        expectedRevision: activeCloudLayoutRevision,
      })
      markCloudSaved({ id: saved.id, name: saved.name, revision: saved.revision, savedAt: saved.savedAt })
      setCloudName(saved.name)
      setCloudStatus(`Saved "${saved.name}" to cloud.`)
      await refreshCloudLayouts()
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

  async function handleCloudLoad(id: string) {
    if (!cloudAuthenticated) {
      setCloudError('Sign in to cloud save first.')
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
      setCloudError('Sign in to cloud save first.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('browser')}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'browser'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
              ].join(' ')}
            >
              Browser Layouts
            </button>
            <button
              onClick={() => setActiveView('cloud')}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === 'cloud'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
              ].join(' ')}
            >
              Cloud Layouts
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-2">
          <div
            className={[
              'flex min-h-0 flex-col border-gray-700',
              activeView === 'cloud' ? 'hidden lg:flex' : 'border-b lg:border-b-0 lg:border-r',
            ].join(' ')}
          >
            <div className="border-b border-gray-800 px-5 py-3">
              <h3 className="text-sm font-semibold text-white">Browser Saves</h3>
              <p className="mt-1 text-xs text-gray-400">Stored only in this browser profile.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <button
                onClick={handleRecover}
                className="w-full mb-3 px-3 py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-900/20 rounded border border-amber-900/40 hover:border-amber-700/60 transition-colors"
              >
                Recover Saved Layouts
              </button>
              {recoveryMessage && (
                <p className="mb-3 text-xs text-amber-200 bg-amber-950/40 border border-amber-900/40 rounded px-3 py-2">
                  {recoveryMessage}
                </p>
              )}
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
          </div>

          <div className={[ 'flex min-h-0 flex-col', activeView === 'browser' ? 'hidden lg:flex' : '' ].join(' ')}>
            <div className="border-b border-gray-800 px-5 py-3">
              <h3 className="text-sm font-semibold text-white">Cloud Saves</h3>
              <p className="mt-1 text-xs text-gray-400">Stored in Neon and available outside this browser.</p>
            </div>
            <div className="border-b border-gray-800 p-4 space-y-3">
              {!cloudAvailable && (
                <p className="text-xs text-gray-400">
                  Cloud save is disabled on this deployment until the server is configured with a database, admin password, and session secret.
                </p>
              )}
              {cloudAvailable && !cloudAuthenticated && (
                <div className="flex gap-2">
                  <input
                    value={cloudPassword}
                    onChange={e => setCloudPassword(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleCloudSignIn()
                    }}
                    type="password"
                    placeholder="Cloud admin password..."
                    className={`flex-1 text-sm ${darkFieldClassName}`}
                  />
                  <button
                    onClick={() => void handleCloudSignIn()}
                    disabled={cloudLoading || !cloudPassword.trim()}
                    className="px-3 py-1.5 rounded border border-gray-600 text-sm text-gray-200 hover:border-gray-500 disabled:opacity-50"
                  >
                    Sign In
                  </button>
                </div>
              )}
              {cloudAvailable && cloudAuthenticated && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void refreshCloudLayouts()}
                      disabled={cloudLoading}
                      className="px-3 py-1.5 rounded border border-gray-600 text-sm text-gray-200 hover:border-gray-500 disabled:opacity-50"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => void handleCloudSignOut()}
                      disabled={cloudLoading}
                      className="px-3 py-1.5 rounded border border-gray-600 text-sm text-gray-200 hover:border-red-500 disabled:opacity-50"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="flex gap-2">
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
                      className={`flex-1 text-sm ${darkFieldClassName}`}
                    />
                    <button
                      onClick={() => void handleCloudSave()}
                      disabled={cloudLoading}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded"
                    >
                      {activeCloudLayoutId ? 'Update Cloud' : 'Save To Cloud'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Admin and moderator accounts can keep up to 10 cloud projects each.
                  </p>
                </>
              )}
              {cloudStatus && <p className="text-xs text-emerald-300">{cloudStatus}</p>}
              {cloudError && <p className="text-xs text-red-300">{cloudError}</p>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {cloudLoading && cloudAuthenticated && (
                <p className="py-6 text-center text-sm text-gray-500">Loading cloud layouts...</p>
              )}
              {cloudAvailable && !cloudAuthenticated && (
                <p className="text-gray-500 text-sm text-center py-6">Sign in to list server-backed layouts.</p>
              )}
              {cloudAvailable && cloudAuthenticated && !cloudLoading && cloudLayouts.length === 0 && !cloudError && (
                <p className="text-gray-500 text-sm text-center py-6">No cloud layouts saved yet.</p>
              )}
              {cloudLayouts.map(l => (
                <div
                  key={l.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    l.id === activeCloudLayoutId
                      ? 'bg-emerald-600/20 border border-emerald-500/40'
                      : 'bg-gray-800 border border-gray-700'
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
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => void handleCloudLoad(l.id)}
                      className="text-xs rounded border border-gray-600 px-2 py-1 text-gray-200 hover:border-blue-500"
                    >
                      load
                    </button>
                    <button
                      onClick={() => void handleCloudDelete(l.id, l.name)}
                      className="text-xs rounded border border-gray-600 px-2 py-1 text-gray-200 hover:border-red-500"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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
              placeholder={title.trim() ? `Use title: ${title.trim()}` : 'New browser layout name...'}
              className={`flex-1 text-sm ${darkFieldClassName}`}
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
