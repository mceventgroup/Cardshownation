// ─────────────────────────────────────────────────────────────────────────────
// EXPORT UTILITIES
//
// PNG  — Konva stage.toDataURL() → file download
// Print/PDF — SVG floor-plan rendered to a new browser window + print dialog
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Section, Vendor, VendorAssignment, CompositeRoom, BackgroundImage } from '@/domain/types'
import { getStage } from './stage'
import { computeRoomContour } from '@/domain/room-contour'
import { vendorColor } from './defaults'

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
  options: PrintOptions,
  backgroundImages?: Record<string, BackgroundImage>,
): void {
  const tableList = Object.values(tables)
  if (tableList.length === 0 && !room) {
    alert('Nothing to export — add some tables first.')
    return
  }

  const svg = buildSVG(tableList, sections, assignments, room, options, backgroundImages)
  const html = buildPrintHTML(svg, options.title)

  const win = window.open('', '_blank', 'width=900,height=700,noopener,noreferrer')
  if (!win) { alert('Popup blocked — please allow popups for this site.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  // Slight delay lets the browser finish layout before opening print dialog
  setTimeout(() => win.print(), 400)
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR MANIFEST / CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

export function printVendorManifest(
  tables: Record<string, TableObject>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  title: string,
): void {
  // Group assignments by vendor
  const vendorTableMap = new Map<string, { name: string; tables: string[]; payment: string; category: string }>()

  for (const a of Object.values(assignments)) {
    const table = tables[a.tableId]
    const label = table?.label ?? a.tableId
    const entry = vendorTableMap.get(a.vendorId)
    if (entry) {
      entry.tables.push(label)
    } else {
      vendorTableMap.set(a.vendorId, {
        name: a.vendorName,
        tables: [label],
        payment: a.paymentStatus,
        category: a.vendorCategory ?? '',
      })
    }
  }

  // Add unassigned vendors from roster
  for (const v of Object.values(vendors)) {
    if (!vendorTableMap.has(v.id)) {
      vendorTableMap.set(v.id, {
        name: v.name,
        tables: [],
        payment: v.paymentStatus,
        category: v.category ?? '',
      })
    }
  }

  // Sort by vendor name
  const rows = [...vendorTableMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  const payBadge = (s: string) => {
    const m: Record<string, string> = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', comped: 'Comped', unknown: '' }
    return m[s] ?? ''
  }
  const payBg = (s: string) => {
    const m: Record<string, string> = { paid: '#dcfce7', partial: '#fef3c7', unpaid: '#fee2e2', comped: '#ede9fe', unknown: '#f1f5f9' }
    return m[s] ?? '#f1f5f9'
  }

  const tableRows = rows.map((r, i) => {
    const sortedTables = r.tables.sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })
    return `<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 12px;font-size:13px;color:#374151">${i + 1}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b">${esc(r.name)}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151">${esc(r.category)}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151">${sortedTables.length > 0 ? esc(sortedTables.join(', ')) : '<span style="color:#9ca3af">—</span>'}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:center"><span style="background:${payBg(r.payment)};padding:2px 8px;border-radius:4px">${payBadge(r.payment)}</span></td>
      <td style="padding:8px 24px;width:80px;border-left:1px solid #e2e8f0"></td>
    </tr>`
  }).join('')

  const totalAssigned = rows.filter(r => r.tables.length > 0).length
  const totalTables = new Set(rows.flatMap(r => r.tables)).size

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} — Vendor Checklist</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; }
    @media print {
      .no-print { display: none !important; }
      @page { margin: 0.5in; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:2px solid #1e293b">
    <div>
      <div style="font-size:20px;font-weight:700;color:#1e293b">${esc(title || 'Floor Plan')} — Vendor Checklist</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px">${new Date().toLocaleDateString()} | ${rows.length} vendors, ${totalAssigned} assigned, ${totalTables} tables</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print</button>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-top:8px">
    <thead>
      <tr style="border-bottom:2px solid #cbd5e1;background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">#</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Vendor</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Category</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tables</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Payment</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-left:1px solid #e2e8f0">Check-in</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700,noopener,noreferrer')
  if (!win) { alert('Popup blocked — please allow popups.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const PAD = 60        // px padding around content
const PAGE_W = 1056   // 11 inches @ 96 dpi (landscape Letter)
const PAGE_H = 816    // 8.5 inches @ 96 dpi

/** Axis-aligned bounding box for a possibly-rotated table. */
function tableBounds(t: TableObject): { minX: number; minY: number; maxX: number; maxY: number } {
  if (t.rotation === 0) {
    return { minX: t.x, minY: t.y, maxX: t.x + t.width, maxY: t.y + t.height }
  }
  const cx = t.x + t.width / 2
  const cy = t.y + t.height / 2
  const hw = t.width / 2
  const hh = t.height / 2
  const r = (t.rotation * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const xs = [hw * cos - hh * sin, -hw * cos - hh * sin, -hw * cos + hh * sin, hw * cos + hh * sin].map(dx => cx + dx)
  const ys = [hw * sin + hh * cos, -hw * sin + hh * cos, -hw * sin - hh * cos, hw * sin - hh * cos].map(dy => cy + dy)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

function buildSVG(
  tables: TableObject[],
  sections: Record<string, Section>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  options: PrintOptions,
  backgroundImages?: Record<string, BackgroundImage>,
): string {
  // Assignment lookup: tableId → VendorAssignment
  const byTable = new Map<string, VendorAssignment>()
  for (const a of Object.values(assignments)) byTable.set(a.tableId, a)

  // Section lookup
  const sectionMap = new Map(Object.entries(sections))

  // Compute content bounding box accounting for rotation
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const t of tables) {
    const b = tableBounds(t)
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
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

  // ── Background images ─────────────────────────────────────────────────────
  if (backgroundImages) {
    const sortedBgs = Object.values(backgroundImages)
      .filter(bg => bg.visible)
      .sort((a, b) => a.order - b.order)
    for (const bg of sortedBgs) {
      parts.push(
        `<image href="${bg.dataUrl}" x="${tx(bg.x)}" y="${ty(bg.y)}" width="${ts(bg.width)}" height="${ts(bg.height)}" opacity="${bg.opacity}" />`
      )
    }
  }

  // ── Tables ────────────────────────────────────────────────────────────────
  for (const t of tables) {
    const assignment = byTable.get(t.id)
    const section = t.sectionId ? sectionMap.get(t.sectionId) : null
    const rawFill = assignment?.colorOverride ?? section?.color ?? (assignment ? vendorColor(assignment.vendorId) : '#e2e8f0')
    const fill = isSafeColor(rawFill) ? rawFill : '#e2e8f0'
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

/** Allow only hex colors and basic CSS color names — rejects url(), expression(), etc. */
function isSafeColor(c: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(c) || /^[a-zA-Z]{2,30}$/.test(c)
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
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
