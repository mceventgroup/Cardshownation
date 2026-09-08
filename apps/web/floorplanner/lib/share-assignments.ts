import type { DocumentSlice } from './persistence'
import { buildSVG, openPrintWindow, sanitizeColor, type ExportDocument } from './export'
import { resolveVendorBuckets } from './vendor-resolution'
import { vendorColor } from './defaults'
import { getRoomLabel } from '../domain/room-numbering'

type ShowData = Pick<DocumentSlice, 'tables' | 'sections' | 'vendors' | 'vendorAssignments' | 'room' | 'doors' | 'settings' | 'backgroundImages' | 'measurements'>
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))

export function assignedVendors(data: ShowData) {
  return resolveVendorBuckets(data.vendors, data.vendorAssignments)
    .map(bucket => ({ ...bucket, tables: bucket.assignments.map(a => data.tables[a.tableId]).filter(Boolean) }))
    .filter(bucket => bucket.tables.length > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function assignmentText(data: ShowData, vendorKey: string) {
  const vendor = assignedVendors(data).find(v => v.key === vendorKey)
  if (!vendor) return ''
  const rooms = [...new Set(vendor.tables.map(t => getRoomLabel(data.room, t.roomId)))].join(', ')
  const labels = vendor.tables.map(t => t.displayId || t.label || String(t.tableNumber)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ')
  return `${vendor.displayName} — ${data.settings.eventName || 'Card Show'}${data.settings.eventDate ? `\n${data.settings.eventDate}` : ''}\nTables: ${labels}\nLocation: ${rooms}\nFind us at the highlighted tables on the map!`
}

function wrap(text: string, limit: number) {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line + ' ' + word).length > limit) { lines.push(line); line = '' }
      line += (line ? ' ' : '') + word
    }
    lines.push(line)
  }
  return lines
}

/** Only public assignment details enter these documents. */
export function buildShareDocument(data: ShowData, vendorKey?: string): ExportDocument {
  const vendor = vendorKey ? assignedVendors(data).find(v => v.key === vendorKey) : undefined
  if (vendorKey && !vendor) throw new Error('This vendor has no assigned tables. Assign tables before sharing.')
  const map = buildSVG(Object.values(data.tables), data.sections, {}, vendor ? {} : data.vendorAssignments, data.room, Object.values(data.doors), {
    title: vendor ? 'Highlighted tables are your spots' : 'Show floor map',
    metadata: { eventName: '', date: '' },
    measurements: vendor ? undefined : data.measurements,
    hideHeader: true, showVendorNames: false, showPaymentStatus: false,
    highlightTableIds: vendor?.tables.map(t => t.id),
  }, data.backgroundImages)
  const lines = wrap(vendor ? assignmentText(data, vendor.key) : `${data.settings.eventName || 'Card Show'}${data.settings.eventDate ? `\n${data.settings.eventDate}` : ''}\nShow floor map`, 78)
  const headerHeight = 36 + lines.length * 29
  const mapWidth = 1200, mapHeight = map.height * mapWidth / map.width
  const directoryWidth = vendor ? 0 : 440
  let directoryHeight = 80
  let directory = ''
  if (!vendor) {
    directory = '<text x="24" y="34" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#0f172a">Vendor directory</text>'
    const entries = assignedVendors(data)
    if (!entries.length) directory += '<text x="24" y="70" font-family="Arial, sans-serif" font-size="18" fill="#475569">No vendor assignments yet</text>'
    for (const entry of entries) {
      const nameLines = wrap(entry.displayName, 30)
      for (const line of nameLines) {
        directory += `<text x="24" y="${directoryHeight}" font-family="Arial, sans-serif" font-size="21" font-weight="700" fill="#0f172a">${escape(line)}</text>`
        directoryHeight += 27
      }
      const colorGroups = new Map<string, string[]>()
      for (const assignment of entry.assignments) {
        const table = data.tables[assignment.tableId]
        if (!table) continue
        const color = sanitizeColor(assignment.colorOverride ?? vendorColor(assignment.vendorId))
        const labels = colorGroups.get(color) ?? []
        labels.push(table.displayId || table.label || String(table.tableNumber))
        colorGroups.set(color, labels)
      }
      for (const [color, labels] of colorGroups) {
        const labelLines = wrap('Tables: ' + labels.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', '), 31)
        directory += `<rect x="24" y="${directoryHeight - 16}" width="18" height="18" rx="3" fill="${color}" stroke="#475569"/>`
        for (const line of labelLines) {
          directory += `<text x="52" y="${directoryHeight}" font-family="Arial, sans-serif" font-size="18" fill="#334155">${escape(line)}</text>`
          directoryHeight += 24
        }
      }
      directoryHeight += 18
      directory += `<path d="M24 ${directoryHeight - 10} H416" stroke="#e2e8f0"/>`
    }
  }
  const width = mapWidth + directoryWidth
  const height = headerHeight + Math.max(mapHeight, vendor ? 0 : directoryHeight + 24)
  const content = `<rect width="${width}" height="${height}" fill="white"/>` + lines.map((line, i) => `<text x="28" y="${35 + i * 29}" font-family="Arial, sans-serif" font-size="${i === 0 ? 25 : 20}" font-weight="${i === 0 ? 700 : 400}" fill="#0f172a">${escape(line)}</text>`).join('') + `<svg x="0" y="${headerHeight}" width="${mapWidth}" height="${mapHeight}" viewBox="0 0 ${map.width} ${map.height}">${map.content}</svg>` + (vendor ? '' : `<g transform="translate(${mapWidth} ${headerHeight})"><path d="M0 0 V${height - headerHeight}" stroke="#cbd5e1"/>${directory}</g>`)

  return { content, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`, width, height, orientation: width > height ? 'landscape' : 'portrait' }
}

export function printShareDocuments(documents: ExportDocument[], title: string) {
  const landscape = documents[0]?.orientation === 'landscape'
  const paperHeight = landscape ? '7.7in' : '10.2in'
  openPrintWindow(`<!doctype html><html><head><title>${escape(title)}</title><style>
    body{margin:0;background:#e2e8f0;font-family:Arial,sans-serif}header{padding:16px}button{padding:12px 24px}section{margin:20px auto;background:white;max-width:1000px}svg{display:block;width:100%;height:auto}
    @media print{@page{size:letter ${landscape ? 'landscape' : 'portrait'};margin:.35in}header{display:none}body{background:white}section{margin:0;break-after:page;height:${paperHeight};display:flex;align-items:center}section:last-child{break-after:auto}svg{max-height:${paperHeight};width:100%;height:100%;object-fit:contain}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><header><button>Print / Save PDF</button></header>${documents.map(doc => `<section>${doc.svg}</section>`).join('')}</body></html>`, 1000, 900, true)
}

async function render(document: ExportDocument) {
  const url = URL.createObjectURL(new Blob([document.svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(2, 6000 / document.width, 6000 / document.height)
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.ceil(document.width * scale)
    canvas.height = Math.ceil(document.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image creation is unavailable in this browser.')
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally { URL.revokeObjectURL(url) }
}

export function shareFilename(title: string) { return title.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 100) || 'table-assignment' }

export async function downloadShareImage(document: ExportDocument, title: string) {
  const canvas = await render(document)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image could not be created.')), 'image/png'))
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url; link.download = shareFilename(title) + '.png'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export async function downloadSharePdf(documents: ExportDocument[], title: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: documents[0]?.orientation ?? 'portrait' })
  pdf.setProperties({ title })
  for (let index = 0; index < documents.length; index++) {
    const doc = documents[index]
    if (index) pdf.addPage('letter', doc.orientation)
    const canvas = await render(doc)
    const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight()
    const scale = Math.min((pageWidth - 48) / doc.width, (pageHeight - 48) / doc.height)
    const width = doc.width * scale, height = doc.height * scale
    pdf.addImage(canvas.toDataURL('image/jpeg', .94), 'JPEG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height)
    canvas.width = 0; canvas.height = 0
  }
  pdf.save(shareFilename(title) + '.pdf')
}
