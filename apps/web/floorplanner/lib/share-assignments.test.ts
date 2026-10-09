import test from 'node:test'
import assert from 'node:assert/strict'
import type { DocumentSlice } from './persistence'
import { DEFAULT_SETTINGS } from './defaults'
import type { TableId, VendorId, VendorAssignmentId, LayoutId, RoomSegmentId } from '../domain/types'
import { buildShareDocument, assignedVendors, assignmentText } from './share-assignments'
import { buildDirectoryPages, buildFloorImage, buildSocialImage, buildTableFlyers } from './show-kit'

test('show kit creates one flyer per vendor with all tables and upcoming shows', () => {
  const data = makeProject()
  const original = Object.values(data.tables)[0]
  const assignment = Object.values(data.vendorAssignments)[0]
  const secondId = 'table-2' as TableId
  data.tables[secondId] = { ...original, id: secondId, tableNumber: 2, displayId: '2' }
  data.vendorAssignments['assignment-2'] = { ...assignment, id: 'assignment-2' as VendorAssignmentId, tableId: secondId }
  data.settings.upcomingShow1Date = 'October 24'
  data.settings.upcomingShow1Location = 'Wichita & Friends'
  data.settings.upcomingShow2Date = 'November 14'
  data.settings.upcomingShow2Location = '<Topeka>'
  data.settings.upcomingShow3Date = 'December 12'
  data.settings.upcomingShow3Location = 'Kansas City'
  const floor = buildFloorImage(data)
  assert.ok(!floor.svg.includes('Vendor directory'))
  const directory = buildDirectoryPages(data)
  assert.equal(directory.length, 1)
  assert.ok(directory[0].svg.includes('Test Vendor'))
  const flyers = buildTableFlyers(data)
  assert.equal(flyers.length, 1)
  assert.ok(flyers[0].svg.includes('THESE TABLES BELONG TO'))
  assert.ok(flyers[0].svg.includes('>1, 2</text>'))
  for (const value of ['UPCOMING SHOWS', 'October 24', 'Wichita &amp; Friends', 'November 14', '&lt;Topeka&gt;', 'December 12', 'Kansas City']) {
    assert.ok(flyers[0].svg.includes(value), value)
  }
  const social = buildSocialImage(data, '<Show & shop>', 'Come visit')
  assert.equal(social.width / social.height, 4 / 5)
  assert.ok(social.svg.includes('&lt;Show &amp; shop&gt;'))
  for (const doc of [floor, ...directory, ...flyers, social]) {
    assert.ok(!doc.svg.includes('private-note'))
    assert.ok(!doc.svg.includes('private@example.com'))
  }
})

test('flyers keep vendors separate and include assignments in every room in natural order', () => {
  const data = makeProject()
  const original = data.tables['table-1']
  const assignment = data.vendorAssignments['table-1']
  data.tables['table-1'] = { ...original, displayId: 'B10' }
  data.room = {
    segments: [
      { id: 's1' as RoomSegmentId, x: 0, y: 0, width: 100, height: 100 },
      { id: 's2' as RoomSegmentId, x: 200, y: 0, width: 100, height: 100 },
    ],
    circles: [], freehandVertices: null, roomLabels: { R1: 'Ballroom', R2: 'Annex' },
  }
  data.tables['table-2'] = { ...original, id: 'table-2' as TableId, displayId: 'B2', roomId: 'R2' }
  data.vendorAssignments['table-2'] = { ...assignment, id: 'a2' as VendorAssignmentId, tableId: 'table-2' as TableId }
  data.vendors['vendor-2'] = { ...data.vendors['vendor-1'], id: 'vendor-2' as VendorId, companyName: 'Other Vendor' }
  data.tables['table-3'] = { ...original, id: 'table-3' as TableId, displayId: 'C1' }
  data.vendorAssignments['table-3'] = { ...assignment, id: 'a3' as VendorAssignmentId, vendorId: 'vendor-2' as VendorId, tableId: 'table-3' as TableId }
  data.settings.upcomingShow1Date = '   '
  data.settings.upcomingShow1Location = '  Wichita  '
  data.settings.upcomingShow2Date = 'November 14'
  const flyers = buildTableFlyers(data)
  assert.equal(flyers.length, 2)
  const first = flyers.find(f => f.svg.includes('Test Vendor Co.'))!
  assert.ok(first.svg.includes('>B2, B10</text>'))
  assert.ok(first.svg.includes('Ballroom, Annex'))
  assert.ok(!first.svg.includes('>C1</text>'))
  const second = flyers.find(f => f.svg.includes('Other Vendor'))!
  assert.ok(second.svg.includes('THIS TABLE BELONGS TO'))
  assert.ok(second.svg.includes('>C1</text>'))
  for (const flyer of flyers) {
    assert.ok(flyer.svg.includes('>Wichita</text>'))
    assert.ok(flyer.svg.includes('>November 14</text>'))
  }
})

test('flyers follow natural table sequence using each vendor’s first table without reordering the directory', () => {
  const data = makeProject()
  const table = data.tables['table-1']
  const vendor = data.vendors['vendor-1']
  const assignment = data.vendorAssignments['table-1']
  data.tables = {}
  data.vendors = {}
  data.vendorAssignments = {}
  const entries = [
    { name: 'Alpha', displayId: 'A11', label: '', tableNumber: 11 },
    { name: 'Zulu', displayId: 'A10', label: '', tableNumber: 10 },
    { name: 'Middle', displayId: 'B1', label: '', tableNumber: 1 },
    { name: 'Zulu', displayId: 'A2', label: '', tableNumber: 2 },
    { name: 'Number Ten', displayId: '', label: '', tableNumber: 10 },
    { name: 'Number Two', displayId: '', label: '2', tableNumber: 2 },
  ]
  entries.forEach((entry, index) => {
    const id = `t-${index}` as TableId
    const vendorId = entry.name as VendorId
    data.tables[id] = { ...table, id, displayId: entry.displayId, label: entry.label, tableNumber: entry.tableNumber }
    data.vendors[vendorId] = { ...vendor, id: vendorId, name: entry.name, companyName: entry.name }
    data.vendorAssignments[id] = { ...assignment, id: `a-${index}` as VendorAssignmentId, tableId: id, vendorId, vendorName: entry.name }
  })
  const before = JSON.stringify(data)
  const directoryBefore = buildDirectoryPages(data)
  const flyers = buildTableFlyers(data)
  const expected = ['Number Two', 'Number Ten', 'Zulu', 'Alpha', 'Middle']
  assert.equal(flyers.length, expected.length)
  expected.forEach((name, index) => assert.ok(flyers[index].svg.includes(`>${name}</text>`), `${name} should be flyer ${index + 1}`))
  assert.ok(flyers[2].svg.includes('>A2, A10</text>'))
  assert.deepEqual(buildDirectoryPages(data), directoryBefore)
  assert.equal(JSON.stringify(data), before)
})

test('large assignments retain every table on one flyer and empty settings have an honest fallback', () => {
  const data = makeProject()
  const original = data.tables['table-1']
  const assignment = data.vendorAssignments['table-1']
  for (let i = 2; i <= 50; i++) {
    const id = `table-${i}` as TableId
    data.tables[id] = { ...original, id, displayId: `B${i}` }
    data.vendorAssignments[id] = { ...assignment, id: `a${i}` as VendorAssignmentId, tableId: id }
  }
  const flyers = buildTableFlyers(data)
  assert.equal(flyers.length, 1)
  assert.equal(flyers[0].height, 1100)
  assert.ok(flyers[0].svg.includes('No upcoming shows listed'))
  for (let i = 2; i <= 50; i++) assert.match(flyers[0].svg, new RegExp(`\\bB${i}\\b`))
  assert.deepEqual(buildTableFlyers({ ...data, vendorAssignments: {} }), [])
})

test('large vendor directories paginate instead of shrinking onto one page', () => {
  const data = makeProject()
  const vendor = Object.values(data.vendors)[0]
  const assignment = Object.values(data.vendorAssignments)[0]
  const table = Object.values(data.tables)[0]
  for (let i = 2; i <= 80; i++) {
    const id = `vendor-${i}` as VendorId, tid = `table-${i}` as TableId
    data.vendors[id] = { ...vendor, id, name: `Vendor ${i}`, companyName: null }
    data.tables[tid] = { ...table, id: tid, displayId: String(i) }
    data.vendorAssignments[`a-${i}`] = { ...assignment, id: `a-${i}` as VendorAssignmentId, vendorId: id, tableId: tid, vendorName: `Vendor ${i}` }
  }
  const pages = buildDirectoryPages(data)
  assert.ok(pages.length > 1)
  assert.ok(pages.every(p => p.height <= 1294))
  assert.ok(pages.some(p => p.svg.includes('Vendor 80')))
})
function makeProject(): DocumentSlice {
  const tableId = 'table-1' as TableId
  const vendorId = 'vendor-1' as VendorId
  return {
    tables: {
      [tableId]: {
        id: tableId,
        roomId: 'R1',
        tableNumber: 1,
        displayId: '1',
        x: 48,
        y: 48,
        width: 72,
        height: 30,
        rotation: 0,
        shape: 'rectangle',
        label: '1',
        labelOverridden: false,
        rowId: null,
        sectionId: null,
        order: 0,
        premium: false,
      },
    },
    rows: {},
    sections: {},
    vendors: {
      [vendorId]: {
        id: vendorId,
        name: 'Test Vendor',
        firstName: null,
        lastName: null,
        companyName: 'Test Vendor Co.',
        email: 'vendor@example.com',
        tablesNeeded: 1,
        tableSize: '6 ft',
        inventory: 'Sports cards',
        category: 'Standard',
        paymentStatus: 'paid',
        notes: null,
        premium: false,
        cases: 0,
      },
    },
    vendorAssignments: { 'table-1': {
      id: 'a1' as VendorAssignmentId, layoutId: 'layout' as LayoutId, tableId,
      vendorId, vendorName: 'Test Vendor', vendorCategory: null,
      importSessionId: null, paymentStatus: 'paid', notes: 'private-note', colorOverride: null,
    } },
    room: null,
    doors: {},
    settings: { ...DEFAULT_SETTINGS, eventName: 'Workflow Test Show' },
    backgroundImages: {},
  }
}


test('shared vendor pages escape display text and exclude private data', () => {
  const data = makeProject()
  const vendor = data.vendors['vendor-1']
  vendor.companyName = '<Alpha & Cards>'
  vendor.notes = 'private-note-never-share'
  data.vendorAssignments['table-1'] = {
    id: 'a1' as VendorAssignmentId, layoutId: 'layout' as LayoutId, tableId: 'table-1' as TableId,
    vendorId: vendor.id, vendorName: vendor.companyName, vendorCategory: null,
    importSessionId: null, paymentStatus: 'unpaid', notes: 'private-assignment-note', colorOverride: null,
  }
  data.vendorAssignments['table-1'].colorOverride = '#aabbcc'
  const full = buildShareDocument(data)
  assert.ok(full.svg.includes('Vendor directory'))
  assert.ok(full.svg.includes('&lt;Alpha &amp; Cards&gt;'))
  assert.ok(full.svg.includes('Tables: 1'))
  assert.equal(full.svg.match(/fill="#aabbcc"/g)?.length, 2)
  for (const privateValue of [vendor.email!, vendor.notes, 'private-assignment-note', 'unpaid']) assert.ok(!full.svg.includes(privateValue))
  const doc = buildShareDocument(data, vendor.id)
  assert.ok(doc.svg.includes('&lt;Alpha &amp; Cards&gt;'))
  for (const privateValue of [vendor.email!, vendor.notes, 'private-assignment-note', 'unpaid']) assert.ok(!doc.svg.includes(privateValue))
  assert.ok(assignmentText(data, vendor.id).includes('Tables: 1'))
  assert.equal(assignedVendors(data).length, 1)
  assert.throws(() => buildShareDocument(data, 'missing'), /no assigned tables/)
})
