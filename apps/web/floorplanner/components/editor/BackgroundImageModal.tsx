'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '@floorplanner/store/index'
import { createBackgroundImageId } from '@floorplanner/lib/id'
import type { BackgroundImage } from '@floorplanner/domain/types'
import { detectStructuresInDataUrl, renderDxfFile, renderImageFile, renderPdfToImages } from '@floorplanner/lib/plan-import-reader'
import { parsePlanMetadata } from '@floorplanner/lib/plan-metadata'
import { mergeDetection, referenceError } from '@floorplanner/lib/plan-editing'
import { planDraft, type PlanDraft } from '@floorplanner/lib/plan-draft'
import { getFloorplannerStorageNamespace } from '@floorplanner/lib/runtime'
import { getActiveLayoutEntry } from '@floorplanner/lib/persistence'
import BuildingPlanReview, { type ReviewImage } from './BuildingPlanReview'

export default function BackgroundImageModal({ onClose, existingImage }: { onClose: () => void; existingImage?: BackgroundImage }) {
  const [pages, setPages] = useState<ReviewImage[]>(() => existingImage ? [{ ...existingImage.plan, name: existingImage.name, dataUrl: existingImage.dataUrl, naturalWidth: existingImage.plan?.sourceWidth || existingImage.width, naturalHeight: existingImage.plan?.sourceHeight || existingImage.height, structures: existingImage.plan?.structures || [], inchesPerPixel: existingImage.plan?.calibrated ? existingImage.width / existingImage.plan.sourceWidth : undefined }] : [])
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  const [opacity, setOpacity] = useState(existingImage?.opacity ?? .3)
  const [arrangement, setArrangement] = useState('side-by-side')
  const [reviewed, setReviewed] = useState(false)
  const [activePage, setActivePage] = useState(0)
  const [draftKey] = useState(() => getFloorplannerStorageNamespace() + ':' + (getActiveLayoutEntry()?.id || 'current') + ':' + (existingImage?.id || 'new'))
  const [recovery, setRecovery] = useState<PlanDraft | null>(null), [draftReady, setDraftReady] = useState(false), [draftStatus, setDraftStatus] = useState('')
  const saved = useRef(false), draftVersion = useRef(0)
  const [reviewVersion, setReviewVersion] = useState(0)
  useEffect(() => { let active = true; void planDraft('read', draftKey).then(draft => { if (active) { if (draft?.pages.length) setRecovery(draft); setDraftReady(true) } }).catch(() => { if (active) { setDraftStatus('Draft recovery unavailable in this browser.'); setDraftReady(true) } }); return () => { active = false } }, [draftKey])
  useEffect(() => {
    if (!draftReady || recovery || saved.current) return
    if (!pages.length) { void planDraft('delete', draftKey).catch(() => setDraftStatus('Could not clear the draft.')); return }
    const version = ++draftVersion.current
    setDraftStatus('Saving review draft…')
    void planDraft('write', draftKey, { pages, opacity, arrangement, activePage, savedAt: Date.now() }).then(() => { if (!saved.current && version === draftVersion.current) setDraftStatus('Review draft saved on this device.') }).catch(() => setDraftStatus('Draft could not be saved. Keep this window open until you import.'))
  }, [pages, opacity, arrangement, activePage, draftKey, draftReady, recovery])
  const currentPage = Math.min(activePage, Math.max(0, pages.length - 1))
  const fileRef = useRef<HTMLInputElement>(null), dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
      if (event.key === 'Tab') {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || []).filter(e => e.getClientRects().length)
        const first = elements[0], last = elements[elements.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', listener)
    return () => { window.removeEventListener('keydown', listener); prior?.focus() }
  }, [onClose, busy])
  async function processFiles(files: FileList | File[]) {
    if (busy || recovery || !draftReady) return
    setError(''); setBusy('Reading drawing…'); setReviewed(false)
    try {
      const result: ReviewImage[] = []
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) throw new Error('Use files smaller than 20 MB.')
        const pdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
        if (/\.dxf$/i.test(file.name)) { result.push(await renderDxfFile(file)); continue }
        if (!pdf && !/image\/(png|jpeg|webp)/.test(file.type)) throw new Error('Use PDF, JPG, PNG, WebP, or a flat 2D DXF. Export DWG drawings as a PDF with dimensions.')
        const rendered = pdf ? await renderPdfToImages(file) : [await renderImageFile(file)]
        for (const page of rendered) {
          setBusy(`Finding walls and pillars on ${page.name}…`)
          result.push({ ...page, structures: await detectStructuresInDataUrl(page.dataUrl, page.naturalWidth, page.naturalHeight) })
        }
      }
      if (pages.length + result.length + Object.keys(useEditorStore.getState().backgroundImages).length > 25) throw new Error('A show supports up to 25 drawing pages. Choose only the pages you need.')
      setPages(current => [...current, ...result])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the drawing.') } finally { setBusy('') }
  }
  async function detect(index: number) {
    setBusy('Finding walls and pillars…'); setError(''); setReviewed(false)
    try {
      const page = pages[index], structures = await detectStructuresInDataUrl(page.dataUrl, page.naturalWidth, page.naturalHeight, page)
      setPages(current => current.map((p, i) => i === index ? { ...p, structures: mergeDetection(structures, p.structures, p.rejected) } : p))
    } catch (e) { setError(e instanceof Error ? e.message : 'Detection failed. Trace the drawing manually.') } finally { setBusy('') }
  }
  async function save() {
    if (busy || recovery || !draftReady || !pages.length || !reviewed || pages.some(p => !p.inchesPerPixel)) return
    try { for (const page of pages) parsePlanMetadata(page) } catch (e) { setError((e as Error).message); return }
    const state = useEditorStore.getState()
    if (pages.some(p => p.structures.length > 2000)) { setError('A page supports up to 2,000 wall and pillar marks. Remove unnecessary marks.'); return }
    let x = existingImage?.x ?? 24, y = existingImage?.y ?? 24
    const images = pages.map((p, i): BackgroundImage => {
      const width = p.naturalWidth * p.inchesPerPixel!, height = p.naturalHeight * p.inchesPerPixel!
      const { dataUrl: _url, name: _name, naturalWidth: _w, naturalHeight: _h, inchesPerPixel: _scale, structures: _structures, ...metadata } = p
      const image = { id: existingImage?.id || createBackgroundImageId(), name: p.name, dataUrl: p.dataUrl, x, y, width, height, opacity, locked: existingImage?.locked ?? true, visible: existingImage?.visible ?? true, order: existingImage?.order ?? Object.keys(state.backgroundImages).length + i, plan: { ...metadata, sourceWidth: p.naturalWidth, sourceHeight: p.naturalHeight, calibrated: true, structures: p.structures } }
      if (arrangement === 'stacked') y += height + 24; else x += width + 24
      return image
    })
    const maxX = Math.max(state.settings.canvasWidth, ...images.map(i => i.x + i.width + 24)), maxY = Math.max(state.settings.canvasHeight, ...images.map(i => i.y + i.height + 24))
    if (!Number.isFinite(maxX + maxY) || maxX > 100000 || maxY > 100000) { setError('This scale makes the drawing too large. Check the distance and units.'); return }
    setBusy('Saving building…')
    images.forEach(image => existingImage ? state.updateBackgroundImage(image.id, image) : state.addBackgroundImage(image))
    if (maxX !== state.settings.canvasWidth || maxY !== state.settings.canvasHeight) state.dispatch({ type: 'UPDATE_SETTINGS', prev: { canvasWidth: state.settings.canvasWidth, canvasHeight: state.settings.canvasHeight }, next: { canvasWidth: Math.ceil(maxX), canvasHeight: Math.ceil(maxY) }, timestamp: Date.now() })
    saved.current = true
    try { await planDraft('delete', draftKey) } catch { saved.current = false; setBusy(''); setError('Building saved, but the review draft could not be cleared. Discard it when reopening.'); return }
    onClose()
  }
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3"><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="plan-import-title" className="flex max-h-[94dvh] w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
    <header className="flex items-center justify-between gap-3 border-b p-4"><div><h2 id="plan-import-title" className="text-lg font-bold">Import &amp; trace building</h2><p className="text-sm text-slate-500">1. Choose drawing → 2. Set scale → 3. Trace rooms &amp; openings → 4. Import</p></div><button disabled={!!busy} aria-label="Close floor plan import" onClick={onClose} className="rounded-lg border p-2">Close</button></header>
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {recovery && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">An unfinished drawing review is saved from {new Date(recovery.savedAt).toLocaleString()}. <button className="rounded border bg-white p-2" onClick={() => { setReviewVersion(v => v + 1); setPages(recovery.pages); setOpacity(recovery.opacity); setArrangement(recovery.arrangement); setActivePage(recovery.activePage); setRecovery(null); setReviewed(false) }}>Resume review</button> <button className="rounded border bg-white p-2" onClick={async () => { try { await planDraft('delete', draftKey); setRecovery(null) } catch { setError('Could not discard the draft.') } }}>Discard draft</button></div>}
      {!existingImage && !recovery && <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void processFiles(e.dataTransfer.files) }} className={pages.length ? "rounded-xl border bg-blue-50 p-2 text-sm" : "rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-5 text-center"}><button disabled={!!busy || !draftReady} onClick={() => fileRef.current?.click()} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Choose drawing</button><input ref={fileRef} aria-label="Floor plan drawing files" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.dxf" multiple hidden disabled={!!busy} onChange={e => { if (e.target.files) void processFiles(e.target.files); e.target.value = '' }} />{!pages.length && <p className="mt-2 text-sm">Drop a PDF, JPG, PNG, or flat 2D DXF here. For DWG or complex CAD, export a dimensioned PDF.</p>}{!pages.length && <p className="mt-1 text-xs text-slate-500">Up to 20 MB per file. No tables will be created.</p>}</div>}
      <details className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><summary className="cursor-pointer font-medium">Tips for a clean building outline</summary><p className="mt-2">Use Detection area to exclude title blocks and borders. Try Faint / gray scan for light linework, then detect again. Review candidates and trace missing walls manually. No tables are created.</p></details>
      {busy && <p role="status" className="text-sm text-blue-700">{busy}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {pages.length > 1 && <nav aria-label="Drawing pages" className="flex gap-2 overflow-x-auto pb-1">{pages.map((page, index) => <button key={`${page.name}-${index}`} disabled={!!busy} aria-current={currentPage === index ? 'page' : undefined} onClick={() => setActivePage(index)} className={`min-w-40 rounded-xl border p-3 text-left text-sm ${currentPage === index ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}><span className="block font-semibold">Page {index + 1}</span><span className="block max-w-48 truncate text-xs">{page.name}</span><span className={`mt-1 block text-xs ${page.inchesPerPixel ? 'text-green-700' : 'text-amber-700'}`}>{page.inchesPerPixel ? 'Scale ready' : 'Needs scale'}</span></button>)}</nav>}
      {pages.map((page, index) => <div key={`${reviewVersion}-${page.name}-${index}`} hidden={index !== currentPage}><BuildingPlanReview image={page} disabled={!!busy || !!recovery} onChange={value => { setReviewed(false); setPages(current => current.map((p, i) => i === index ? value : p)) }} onResetDetection={() => void detect(index)} onRemovePage={() => { setReviewed(false); setActivePage(Math.max(0, index - 1)); setPages(current => current.filter((_, i) => i !== index)) }} /></div>)}
      {draftStatus && <p role="status" className="text-xs text-slate-500">{draftStatus}</p>}
      {!!pages.length && pages.some(p => p.verification && p.inchesPerPixel && referenceError(p.verification, p.inchesPerPixel) > 2) && <p className="text-sm text-amber-800">A scale check differs by more than 2%. Recheck that page before confirming the import.</p>}
      {!!pages.length && <p role="status" className="text-sm text-slate-600">{pages.filter(p => p.inchesPerPixel).length} of {pages.length} pages scaled.{pages.some(p => !p.inchesPerPixel) ? ' Set scale on each page to enable import.' : ' Review your marks, then confirm below.'}{existingImage ? ' After rescaling, recheck existing table placement.' : ''}</p>}
      {!!pages.length && <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-3"><label className="text-sm">Drawing opacity <input aria-label="Drawing opacity" type="range" min="0" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>{pages.length > 1 && <label className="text-sm">Arrange pages <select value={arrangement} onChange={e => setArrangement(e.target.value)}><option value="side-by-side">Side by side</option><option value="stacked">Top to bottom</option></select></label>}<p className="text-xs text-slate-500">Traced walls and pillars stay visible when drawing opacity is zero. Reopen from Space → Plan to edit traces or scale.</p></div>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 p-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={!!busy || !pages.length} onChange={e => setReviewed(e.target.checked)} />I checked the walls, pillars, and scale.</label><button disabled={!!busy || !!recovery || !draftReady || !reviewed || !pages.length || pages.some(p => !p.inchesPerPixel)} onClick={() => void save()} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-40">{existingImage ? 'Save building changes' : 'Import scaled building'}</button></footer>
  </div></div>, document.body)
}
