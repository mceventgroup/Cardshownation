// ─────────────────────────────────────────────────────────────────────────────
// EXPORT UTILITIES
//
// PNG  — Konva stage.toDataURL() → file download
// Print/PDF — SVG floor-plan rendered to a new browser window + print dialog
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Section, VendorAssignment, CompositeRoom, LayoutSettings } from '@/domain/types'
import { getStage } from './stage'
import { computeRoomContour } from '@/domain/room-contour'

// ─────────────────────────────────────────────────────────────────────────────
// PNG EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/** Export the Konva canvas as a PNG download at 2× pixel ratio. */
export function exportPNG(filename = 'floorplan.png'): void {
  const stage = getStage()
  if (!stage) { alert('Canvas not ready.'); return }

  const dataURL = stage.toDataURL({ pixelRatio: 2 })
  const a = document.createElement('a')
  a.href = dataURL
  a.download = filename
  a.click()
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT / PDF EXPORT
// Opens an SVG floor-plan in a new window and triggers the browser print dialog.
// ─────────────────────────────────────────────────────────────────────────────

export interface PrintOptions {
  showVendorNames: boolean   // organizer view
  showPaymentStatus: boolean
  title: string
}

export function printLayout(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  settings: LayoutSettings,
  options: PrintOptions,
): void {
  const tableList = Object.values(tables)
  if (tableList.length === 0 && !room) {
    alert('Nothing to export — add some tables first.')
    return
  }

  const svg = buildSVG(tableList, sections, assignments, room, settings, options)
  const html = buildPrintHTML(svg, options.title)

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Popup blocked — please allow popups for this site.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  // Slight delay lets the browser finish layout before opening print dialog
  setTimeout(() => win.print(), 400)
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const PAD = 60        // px padding around content
const PAGE_W = 1056   // 11 inches @ 96 dpi (landscape Letter)
const PAGE_H = 816    // 8.5 inches @ 96 dpi

function buildSVG(
  tables: TableObject[],
  sections: Record<string, Section>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  _settings: LayoutSettings,
  options: PrintOptions,
): string {
  // Assignment lookup: tableId → VendorAssignment
  const byTable = new Map<string, VendorAssignment>()
  for (const a of Object.values(assignments)) byTable.set(a.tableId, a)

  // Section lookup
  const sectionMap = new Map(Object.entries(sections))

  // Compute content bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const t of tables) {
    minX = Math.min(minX, t.x)
    minY = Math.min(minY, t.y)
    maxX = Math.max(maxX, t.x + t.width)
    maxY = Math.max(maxY, t.y + t.height)
  }

  if (room) {
    for (const seg of room.segments) {
      minX = Math.min(minX, seg.x)
      minY = Math.min(minY, seg.y)
      maxX = Math.max(maxX, seg.x + seg.width)
      maxY = Math.max(maxY, seg.y + seg.height)
    }
    if (room.freehandVertices) {
      for (const v of room.freehandVertices) {
        minX = Math.min(minX, v.x)
        minY = Math.min(minY, v.y)
        maxX = Math.max(maxX, v.x)
        maxY = Math.max(maxY, v.y)
      }
    }
  }

  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1200; maxY = 1200 }

  const contentW = maxX - minX
  const contentH = maxY - minY
  const availW = PAGE_W - PAD * 2
  const availH = PAGE_H - PAD * 2
  const scale = Math.min(availW / contentW, availH / contentH, 1)

  const svgW = PAGE_W
  const svgH = PAGE_H
  const offsetX = PAD + (availW - contentW * scale) / 2 - minX * scale
  const offsetY = PAD + (availH - contentH * scale) / 2 - minY * scale

  function tx(x: number) { return (offsetX + x * scale).toFixed(2) }
  function ty(y: number) { return (offsetY + y * scale).toFixed(2) }
  function ts(v: number) { return (v * scale).toFixed(2) }

  const parts: string[] = []

  // ── Room outline ──────────────────────────────────────────────────────────
  if (room) {
    if (room.freehandVertices && room.freehandVertices.length >= 3) {
      const pts = room.freehandVertices.map(v => `${tx(v.x)},${ty(v.y)}`).join(' ')
      parts.push(`<polygon points="${pts}" fill="#f8fafc" stroke="#475569" stroke-width="2" />`)
    } else if (room.segments.length > 0) {
      const contours = computeRoomContour(room)
      for (const contour of contours) {
        if (contour.length < 3) continue
        const pts = contour.map(v => `${tx(v.x)},${ty(v.y)}`).join(' ')
        parts.push(`<polygon points="${pts}" fill="#f8fafc" stroke="#475569" stroke-width="2" />`)
      }
    }
  }

  // ── Tables ────────────────────────────────────────────────────────────────
  for (const t of tables) {
    const assignment = byTable.get(t.id)
    const section = t.sectionId ? sectionMap.get(t.sectionId) : null
    const fill = assignment?.colorOverride ?? section?.color ?? '#e2e8f0'
    const cx = tx(t.x + t.width / 2)
    const cy = ty(t.y + t.height / 2)
    const w = ts(t.width)
    const h = ts(t.height)
    const rot = t.rotation

    const groupOpen = `<g transform="translate(${cx},${cy}) rotate(${rot})">`
    const groupClose = `</g>`

    let shape: string
    if (t.shape === 'round') {
      const rx = ts(t.width / 2)
      const ry = ts(t.height / 2)
      shape = `<ellipse rx="${rx}" ry="${ry}" fill="${fill}" stroke="#64748b" stroke-width="1" />`
    } else {
      shape = `<rect x="${(-parseFloat(w) / 2).toFixed(2)}" y="${(-parseFloat(h) / 2).toFixed(2)}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="#64748b" stroke-width="1" />`
    }

    // Label: table number
    const fontSize = Math.max(7, Math.min(14, parseFloat(ts(t.height)) * 0.35))
    const vendorAssignment = assignment && options.showVendorNames ? assignment : null

    let textContent: string
    if (vendorAssignment) {
      const vName = vendorAssignment.vendorName.slice(0, 20)
      const payBadge = options.showPaymentStatus
        ? paymentBadge(vendorAssignment.paymentStatus)
        : ''
      textContent = [
        `<text text-anchor="middle" dominant-baseline="middle" y="${-(fontSize * 0.7).toFixed(1)}" font-size="${fontSize}" font-family="sans-serif" fill="#1e293b" font-weight="700">${esc(t.label)}</text>`,
        `<text text-anchor="middle" dominant-baseline="middle" y="${(fontSize * 0.5).toFixed(1)}" font-size="${(fontSize * 0.8).toFixed(1)}" font-family="sans-serif" fill="#374151">${esc(vName)}</text>`,
        payBadge ? `<text text-anchor="middle" dominant-baseline="middle" y="${(fontSize * 1.7).toFixed(1)}" font-size="${(fontSize * 0.7).toFixed(1)}" font-family="sans-serif" fill="${payColor(vendorAssignment.paymentStatus)}">${payBadge}</text>` : '',
      ].join('')
    } else {
      textContent = `<text text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-family="sans-serif" fill="#1e293b" font-weight="700">${esc(t.label)}</text>`
    }

    parts.push(`${groupOpen}${shape}${textContent}${groupClose}`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${parts.join('')}</svg>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function paymentBadge(status: string): string {
  const map: Record<string, string> = {
    paid: '✓ Paid', partial: '~ Partial', unpaid: '✗ Unpaid',
    comped: '♦ Comped', unknown: '',
  }
  return map[status] ?? ''
}

function payColor(status: string): string {
  const map: Record<string, string> = {
    paid: '#16a34a', partial: '#d97706', unpaid: '#dc2626',
    comped: '#7c3aed', unknown: '#6b7280',
  }
  return map[status] ?? '#6b7280'
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT HTML WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function buildPrintHTML(svgContent: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title || 'Floor Plan')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; font-family: sans-serif; }
    .header { padding: 12px 24px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
    .title { font-size: 18px; font-weight: 700; color: #1e293b; }
    .subtitle { font-size: 12px; color: #94a3b8; }
    .canvas { display: flex; justify-content: center; padding: 16px; }
    svg { max-width: 100%; height: auto; }
    @media print {
      .no-print { display: none !important; }
      @page { size: landscape; margin: 0.4in; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${esc(title || 'Floor Plan')}</div>
      <div class="subtitle">Generated ${new Date().toLocaleDateString()}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:6px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save PDF</button>
  </div>
  <div class="canvas">${svgContent}</div>
</body>
</html>`
}
