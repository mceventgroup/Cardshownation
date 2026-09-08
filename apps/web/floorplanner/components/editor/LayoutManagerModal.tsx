'use client'

import { useEffect, useState } from 'react'
import { useEditorStore } from '@floorplanner/store/index'
import { hasPendingEditorChanges } from '@floorplanner/lib/editor-save-state'
import { keepCurrentDeviceShow, saveCurrentShow } from '@floorplanner/lib/save-show'
import { deleteLayout, getActiveLayoutId, listLayouts, recoverLayoutsFromStorage, type LayoutEntry } from '@floorplanner/lib/persistence'
import { deleteCloudLayout, getCloudSession, listCloudLayouts, loadCloudLayout, type CloudLayoutSummary } from '@floorplanner/lib/cloud-layouts'

export default function LayoutManagerModal({ onClose }: { onClose: () => void }) {
  const title = useEditorStore(s => s.settings.eventName)
  const cloudId = useEditorStore(s => s.activeCloudLayoutId)
  const [local, setLocal] = useState<LayoutEntry[]>([])
  const [account, setAccount] = useState<CloudLayoutSummary[]>([])
  const [accountReady, setAccountReady] = useState(false)
  const [accountNote, setAccountNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copyName, setCopyName] = useState(title + ' Copy')
  const [activeId, setActiveId] = useState<string | null>(null)

  function refreshDevice() { setLocal(listLayouts()); setActiveId(getActiveLayoutId()) }
  useEffect(() => {
    refreshDevice()
    let alive = true
    void getCloudSession().then(async session => {
      if (!alive) return
      setAccountReady(session.available && session.authenticated)
      if (session.available && session.authenticated) {
        const layouts = await listCloudLayouts()
        if (alive) setAccount(layouts)
      }
    }).catch(() => { if (alive) setAccountNote('Account saves could not be checked. Device saves are ready to open.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    function key(event: KeyboardEvent) { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [busy, onClose])

  async function perform(action: () => void | Promise<void>) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (err) { setError(err instanceof Error ? err.message : 'Could not complete that action. Please try again.') }
    finally { setBusy(false) }
  }
  function prepareToOpen() {
    const current = useEditorStore.getState()
    if (current.activeDocumentSource !== 'browser' && hasPendingEditorChanges(current) && !window.confirm('This show has changes that have not been saved to its account or file. Open another show anyway?')) return false
    keepCurrentDeviceShow()
    return true
  }
  async function open(id: string, source: 'device' | 'account') {
    if (!prepareToOpen()) return
    if (source === 'device') {
      if (!useEditorStore.getState().switchToLayout(id)) throw new Error('This saved show could not be opened. Try recovering device saves below.')
    } else {
      const saved = await loadCloudLayout(id)
      useEditorStore.getState().loadDocumentSlice(saved.data, { source: 'cloud', label: saved.name, cloudLayout: { id: saved.id, name: saved.name, revision: saved.revision } })
    }
    onClose()
  }
  const shows = [
    ...local.map(show => ({ ...show, source: 'device' as const, current: show.id === activeId })),
    ...account.map(show => ({ ...show, source: 'account' as const, current: show.id === cloudId })),
  ].filter(show => show.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  const button = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40'

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => { if (!busy) onClose() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="saved-shows-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="saved-shows-title" className="text-xl font-semibold">Open shows</h2><p className="mt-1 text-sm text-slate-500">Find a saved floor plan and pick Open to continue.</p></div>
          <button className={button} disabled={busy} onClick={onClose} aria-label="Close saved shows">×</button>
        </div>
        <label className="mt-4 block"><span className="sr-only">Search saved shows</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search shows…" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {loading && <p className="mb-3 text-xs text-slate-500">Checking account saves…</p>}
        {!loading && !accountReady && <p className="mb-3 text-xs text-slate-500">{accountNote || 'Account saving is unavailable here. Device saves work in this browser.'}</p>}
        {!shows.length && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{search ? 'No shows match your search.' : 'No saved shows yet. Use Save in the editor to keep your current show here.'}</div>}
        <div className="space-y-2">
          {shows.map(show => <div key={show.source + show.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
            <div className="min-w-0 flex-1"><div className="truncate font-semibold">{show.name}</div><p className="mt-1 text-xs text-slate-500">{show.source === 'device' ? 'This device' : 'Account'} · {show.tableCount} {show.tableCount === 1 ? 'table' : 'tables'} · {show.vendorCount} {show.vendorCount === 1 ? 'vendor' : 'vendors'} · {new Date(show.savedAt).toLocaleDateString()}</p></div>
            {show.current && show.source === 'device' ? <span className="text-xs font-medium text-blue-700">Currently open</span> : <button className={button} disabled={busy} aria-label={(show.current ? 'Reload ' : 'Open ') + show.name + ' from ' + show.source} onClick={() => void perform(() => open(show.id, show.source))}>{show.current ? 'Reload' : 'Open'}</button>}
            {!show.current && <details className="relative"><summary className="cursor-pointer px-2 text-sm text-slate-500" aria-label={'More options for ' + show.name}>More</summary><button className="mt-2 rounded-lg px-2 py-1 text-xs text-red-700" disabled={busy} onClick={() => void perform(async () => {
              if (!window.confirm('Delete “' + show.name + '” from ' + (show.source === 'device' ? 'this device' : 'your account') + '?')) return
              if (show.source === 'device') { deleteLayout(show.id); refreshDevice() }
              else { await deleteCloudLayout(show.id); setAccount(await listCloudLayouts()) }
            })}>Delete saved show</button></details>}
          </div>)}
        </div>
      </div>
      <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-5">
        <p className="text-xs text-slate-500">Device copies stay in this browser. Cloud autosave keeps account shows available on your other devices.</p>
        {accountReady && <button className={button} disabled={busy} onClick={() => void perform(async () => { setMessage(await saveCurrentShow(true)); setAccount(await listCloudLayouts()); refreshDevice() })}>{cloudId ? 'Save current show to account' : 'Copy current show to account'}</button>}
        <details><summary className="cursor-pointer text-sm font-medium text-slate-700">Make a copy for another show</summary><div className="mt-3 flex gap-2"><input aria-label="New show copy name" value={copyName} onChange={event => setCopyName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" /><button className={button} disabled={busy || !copyName.trim()} onClick={() => void perform(() => { if (!prepareToOpen()) return; useEditorStore.getState().saveCurrentLayoutAs(copyName.trim()); onClose() })}>Create copy</button></div><p className="mt-2 text-xs text-slate-500">Creates a separate device save and opens it. The original stays in your list.</p></details>
        <details><summary className="cursor-pointer text-xs text-slate-500">Missing an older device save?</summary><button className="mt-2 text-sm text-blue-700" disabled={busy} onClick={() => void perform(() => { const count = recoverLayoutsFromStorage(); refreshDevice(); setMessage(count ? 'Recovered ' + count + ' device saves.' : 'No older saves found in this browser.') })}>Recover device saves</button></details>
      </div>
    </div>
  </div>
}
