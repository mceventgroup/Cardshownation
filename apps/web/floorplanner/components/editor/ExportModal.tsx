'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '@floorplanner/store/index'
import { exportVendorAssignmentsCsv, printVendorManifest, printVendorTableAssignments } from '@floorplanner/lib/export'
import { buildDirectoryPages, buildFloorImage, buildSocialImage, buildTableFlyers } from '@floorplanner/lib/show-kit'
import { assignedVendors, assignmentText, buildShareDocument, downloadShareImage, downloadSharePdf, printShareDocuments } from '@floorplanner/lib/share-assignments'

export default function ExportModal({ onClose }: { onClose: () => void }) {
  // Snapshot the show when opening so a batch always represents the same plan.
  const [data] = useState(() => useEditorStore.getState())
  const vendors = useMemo(() => assignedVendors(data), [data])
  const [mode, setMode] = useState<'floor' | 'directory' | 'flyers' | 'social' | 'vendor' | 'all' | 'map'>('floor')
  const [page, setPage] = useState(0)
  const [headline, setHeadline] = useState(data.settings.eventName || 'Card Show')
  const [footer, setFooter] = useState('Find your favorite vendors. Plan your visit.')
  const [vendorKey, setVendorKey] = useState(vendors[0]?.key ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const selected = vendors.find(v => v.key === vendorKey)
  const pages = useMemo(() => mode === 'floor' ? [buildFloorImage(data)] : mode === 'directory' ? buildDirectoryPages(data) : mode === 'flyers' ? buildTableFlyers(data) : mode === 'social' ? [buildSocialImage(data, headline, footer)] : mode === 'all' ? vendors.map(v => buildShareDocument(data, v.key)) : [buildShareDocument(data, mode === 'map' ? undefined : vendorKey || undefined)], [data, mode, vendorKey, vendors, headline, footer])
  const preview = pages[Math.min(page, pages.length - 1)]
  const title = `${data.settings.eventName || 'Card Show'}-${mode === 'vendor' ? selected?.displayName || 'assignment' : mode}`
  const text = assignmentText(data, vendorKey)
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null
    const dialog = document.getElementById('print-share-dialog')!
    dialog.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
      if (event.key === 'Tab') {
        const elements = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, summary, [tabindex="0"]')).filter(el => el.getClientRects().length)
        const first = elements[0], last = elements[elements.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); prior?.focus() }
  }, [onClose, busy])
  function documents() { return pages }
  async function act(action: () => void | Promise<void>, success = '') {
    setError(''); setMessage(''); setBusy(true)
    try { await action(); setMessage(success) } catch (e) { setError(e instanceof Error ? e.message : 'Could not finish. Please try again.') } finally { setBusy(false) }
  }
  const button = 'rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50'
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">
    <div id="print-share-dialog" role="dialog" aria-modal="true" aria-labelledby="print-share-title" tabIndex={-1} className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white text-slate-900 shadow-xl">
      <header className="flex items-center justify-between border-b p-5">
        <div><h2 id="print-share-title" className="text-lg font-bold">Print &amp; share</h2><p className="text-sm text-slate-500">Email vendors → set up tables → promote your show.</p></div>
        <button aria-label="Close print and share" disabled={busy} onClick={onClose} className={button}>Close</button>
      </header>
      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-semibold">What do you need?
            <select aria-label="What to print or share" value={mode} onChange={e => { setMode(e.target.value as typeof mode); setPage(0); setMessage(''); setError('') }} disabled={busy} className="mt-2 w-full rounded-xl border p-3">
              <option value="floor">Floor image — email JPEG</option>
              <option value="directory">Vendor list — email JPEG</option>
              <option value="flyers" disabled={!vendors.length}>Table flyers — one sign per table</option>
              <option value="social">Social media — portrait image</option>
              <option value="vendor" disabled={!vendors.length}>One vendor’s assignment</option>
              <option value="all" disabled={!vendors.length}>All vendors — one page each</option>
              <option value="map">Full show map + vendor directory</option>
            </select>
          </label>
          {!vendors.length && <p className="text-sm text-slate-600">Assign tables to a vendor to create their personal assignment map.</p>}
          {mode === 'vendor' && <label className="block text-sm font-semibold">Vendor
            <select aria-label="Vendor to share" value={vendorKey} disabled={busy} onChange={e => { setVendorKey(e.target.value); setMessage(''); setError('') }} className="mt-2 w-full rounded-xl border p-3">
              {vendors.map(v => <option key={v.key} value={v.key}>{v.displayName} ({v.tables.length} tables)</option>)}
            </select>
          </label>}
          <p className="text-sm text-slate-600">{mode === 'floor' ? 'A separate numbered floor image. Download this and the vendor list to attach to your vendor email.' : mode === 'directory' ? 'An alphabetical vendor list with table numbers and rooms. Longer lists are split into readable pages.' : mode === 'flyers' ? 'Large vendor names and table numbers. Print one sign for each assigned table and place it before setup.' : mode === 'social' ? 'A 4:5 portrait graphic with your show floor, title, date, and invitation.' : mode === 'all' ? `${vendors.length} pages, with each vendor’s tables highlighted on their own map.` : mode === 'vendor' ? 'Their name, table numbers, room, and highlighted spots on the show map.' : 'One complete map with numbered, color-coded tables and a matching vendor directory.'}</p>
          {mode === 'social' && <div className="space-y-3"><label className="block text-sm font-semibold">Headline<input value={headline} maxLength={90} onChange={e => setHeadline(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm font-semibold">Invitation<input value={footer} maxLength={110} onChange={e => setFooter(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label></div>}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void act(() => downloadSharePdf(documents(), title), 'PDF downloaded. Attach it to your email or print it.')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Download PDF</button>
            <button disabled={busy} onClick={() => void act(() => printShareDocuments(documents(), title))} className={button}>Print</button>
            {preview && <>
              <button disabled={busy} onClick={() => void act(() => downloadShareImage(preview, title + (pages.length > 1 ? `-page-${page + 1}` : ''), 'jpg'), 'JPG downloaded. Attach it to email or upload it to Facebook.')} className={button}>Download JPG</button>
              <button disabled={busy} onClick={() => void act(() => downloadShareImage(preview, title, 'png'), 'PNG downloaded. Attach it to your message or post.')} className={button}>Download PNG</button>
            </>}
          </div>
          {mode === 'flyers' && <button disabled={busy} className={button} onClick={() => void act(() => printVendorTableAssignments(data.tables, data.sections, data.vendors, data.vendorAssignments, data.settings))}>Print classic vendor flyers</button>}
          {mode === 'vendor' && <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <label className="block text-sm font-semibold" htmlFor="vendor-share-text">Message for email or Facebook</label>
            <textarea id="vendor-share-text" readOnly value={text} rows={6} className="w-full rounded-lg border bg-white p-2 text-sm" />
            <button disabled={busy} onClick={() => void act(() => navigator.clipboard.writeText(text), 'Message copied. Paste it into your email or Facebook post and attach the downloaded image.')} className={button}>Copy message</button>
            <p className="text-xs text-slate-500">Download the PDF for email, or the image for email and Facebook. Then attach it to your message or post.</p>
          </div>}
          {busy && <p role="status" className="text-sm">Preparing your file…</p>}
          {message && <p role="status" className="text-sm text-green-700">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Organizer tools</summary><div className="mt-3 flex flex-wrap gap-2">
            <button className={button} disabled={busy} onClick={() => void act(() => printVendorManifest(data.tables, data.vendors, data.vendorAssignments, data.settings.eventName))}>Print check-in list</button>
            <button className={button} disabled={busy} onClick={() => void act(() => printVendorManifest(data.tables, data.vendors, data.vendorAssignments, data.settings.eventName, { casesOnly: true }))}>Print case rentals</button>
            <button className={button} disabled={busy} onClick={() => void act(() => exportVendorAssignmentsCsv(data.tables, data.vendors, data.vendorAssignments, data.room, data.settings.eventName))}>Download assignment spreadsheet</button>
          </div></details>
        </div>
        <div className="min-w-0 rounded-xl bg-slate-100 p-3"><p className="mb-2 text-xs font-semibold text-slate-500">Preview • {pages.length} {pages.length === 1 ? 'page' : 'pages'}</p>
          {pages.length > 1 && <div className="mb-3 flex items-center justify-between gap-2"><button className={button} disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous</button><span className="text-xs">{page + 1} / {pages.length}</span><button className={button} disabled={busy || page >= pages.length - 1} onClick={() => setPage(page + 1)}>Next</button></div>}
          {/* SVG generated from escaped public display data only. */}
          {preview && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG preview is already the final export asset */}
              <img alt="Assignment map preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`} className="w-full bg-white shadow" />
            </>
          )}
          {pages.length > 1 && <p className="mt-3 text-xs text-slate-600">PDF and Print include every page. Image downloads save the page shown above.</p>}
        </div>
      </div>
    </div>
  </div>, document.body)
}
