import type { DocumentSlice } from './persistence'
import { buildSVG, type ExportDocument } from './export'
import { assignedVendors } from './share-assignments'
import { getRoomLabel } from '../domain/room-numbering'

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))
function lines(value: string, length: number): string[] {
  return value.split('\n').flatMap(part => {
    const result: string[] = []
    let line = ''
    for (const word of part.split(/\s+/)) {
      if (line && line.length + word.length + 1 > length) { result.push(line); line = '' }
      for (const chunk of word.match(new RegExp(`.{1,${length}}`, 'gu')) ?? ['']) {
        if (line && line.length + chunk.length + 1 > length) { result.push(line); line = '' }
        line += (line ? ' ' : '') + chunk
      }
    }
    if (line || !result.length) result.push(line)
    return result
  })
}
const text = (value: string, x: number, y: number, size = 24, color = '#0f172a', weight = 400) => `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(value)}</text>`
function document(width: number, height: number, content: string): ExportDocument {
  content = `<rect width="${width}" height="${height}" fill="white"/>${content}`
  return { width, height, content, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`, orientation: width > height ? 'landscape' : 'portrait' }
}

export function buildFloorImage(data: DocumentSlice): ExportDocument {
  return buildSVG(Object.values(data.tables), data.sections, {}, data.vendorAssignments, data.room, Object.values(data.doors), {
    title: 'Show floor', metadata: { eventName: data.settings.eventName, date: data.settings.eventDate },
    showVendorNames: false, showPaymentStatus: false,
  }, data.backgroundImages)
}

/** A paginated public directory: no contact, payment, or organizer notes. */
export function buildDirectoryPages(data: DocumentSlice): ExportDocument[] {
  const pages: ExportDocument[] = []
  let content = '', y = 200
  const header = () => lines(data.settings.eventName || 'Card Show', 48).slice(0, 2).map((line, i) => text(line, 48, 56 + i * 38, 34, '#0f172a', 700)).join('') + text('Vendor list • ' + (data.settings.eventDate || 'Table directory'), 48, 142, 22, '#475569')
  const finish = () => { const height = Math.max(350, y + 64); pages.push(document(1000, height, header() + content + text(`Vendor directory • Page ${pages.length + 1}`, 48, height - 28, 18, '#64748b'))); content = ''; y = 200 }
  for (const vendor of assignedVendors(data)) {
    const name = lines(vendor.displayName, 35)
    const locations = lines(vendor.tables.map(t => `${t.displayId || t.label || t.tableNumber} (${getRoomLabel(data.room, t.roomId)})`).join(', '), 33)
    const height = Math.max(name.length, locations.length) * 30 + 28
    // Split very large assignments across pages without shrinking the entire roster.
    const count = Math.max(name.length, locations.length)
    for (let offset = 0; offset < count;) {
      if (y + Math.min(height, 100) > 1210) finish()
      const take = Math.min(count - offset, Math.floor((1210 - y - 28) / 30))
      content += `<rect x="36" y="${y - 24}" width="928" height="${take * 30 + 16}" rx="8" fill="#f1f5f9"/>`
      for (let i = 0; i < take; i++) content += text(name[offset + i] || '', 48, y + i * 30, 23, '#0f172a', 700) + text(locations[offset + i] || '', 510, y + i * 30, 22)
      y += take * 30 + 28; offset += take
    }
  }
  if (!assignedVendors(data).length) content = text('Assign vendors to tables to create your directory.', 48, y)
  finish()
  return pages
}

export function buildTableFlyers(data: DocumentSlice): ExportDocument[] {
  return assignedVendors(data).flatMap(vendor => vendor.tables.map(table => {
    const label = table.displayId || table.label || String(table.tableNumber)
    const name = lines(vendor.displayName, 27)
    const labels = lines(label, 15)
    return document(850, 1100,
      lines(data.settings.eventName || 'Card Show', 44).slice(0, 2).map((line, i) => text(line, 50, 70 + i * 36, 30, '#334155', 700)).join('') +
      text('THIS TABLE BELONGS TO', 50, 205, 20, '#64748b', 700) +
      name.map((line, i) => text(line, 50, 275 + i * Math.min(56, 170 / name.length), Math.min(46, 150 / name.length), '#0f172a', 700)).join('') +
      `<rect x="50" y="480" width="750" height="300" rx="20" fill="#f1f5f9"/>` + text('TABLE', 85, 530, 24, '#475569', 700) +
      labels.map((line, i) => text(line, 85, 645 + i * Math.min(80, 150 / labels.length), Math.min(82, 150 / labels.length), '#0f172a', 700)).join('') +
      lines(getRoomLabel(data.room, table.roomId), 42).slice(0, 3).map((line, i) => text(line, 50, 860 + i * 36, 30)).join('') +
      text(data.settings.eventDate || 'Welcome to the show', 50, 1030, 24, '#475569'))
  }))
}

export function buildSocialImage(data: DocumentSlice, headline: string, footer: string): ExportDocument {
  const map = buildFloorImage(data)
  const heading = lines(headline || data.settings.eventName || 'Card Show', 30).slice(0, 3)
  return document(1080, 1350, `<rect width="1080" height="1350" fill="#0f172a"/><rect x="48" y="50" width="70" height="8" rx="4" fill="#38bdf8"/>` +
    text('EXPLORE THE SHOW FLOOR', 48, 105, 23, '#7dd3fc', 700) +
    heading.map((line, i) => text(line, 48, 180 + i * 60, 54, 'white', 700)).join('') +
    text(data.settings.eventDate || '', 48, 355, 28, '#cbd5e1') +
    `<rect x="36" y="390" width="1008" height="780" rx="24" fill="white"/><svg x="56" y="410" width="968" height="740" viewBox="0 0 ${map.width} ${map.height}" preserveAspectRatio="xMidYMid meet">${map.content}</svg>` +
    lines(footer || 'Find your favorite vendors. Plan your visit.', 55).slice(0, 2).map((line, i) => text(line, 48, 1235 + i * 36, 28, 'white')).join(''))
}
