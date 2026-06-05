/** @jest-environment jsdom */

import type { BackgroundImage, CompositeRoom, Door, Section, TableObject, Vendor, VendorAssignment } from '@/domain/types'
import { exportVendorAssignmentsCsv, printShowModeSheet } from '@/lib/export'

function makeTable(id: string, overrides: Partial<TableObject> = {}): TableObject {
  return {
    id: id as any,
    roomId: 'room-1',
    tableNumber: 1,
    displayId: 'A-1',
    x: 0,
    y: 0,
    width: 40,
    height: 30,
    rotation: 0,
    shape: 'rectangle',
    label: 'A-1',
    labelOverridden: false,
    rowId: null,
    sectionId: null,
    order: 0,
    premium: false,
    ...overrides,
  }
}

function makeVendor(id: string, overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: id as any,
    name: id,
    firstName: null,
    lastName: null,
    companyName: null,
    email: null,
    tablesNeeded: 1,
    tableSize: null,
    category: null,
    paymentStatus: 'unknown',
    notes: null,
    premium: false,
    ...overrides,
  }
}

function makeAssignment(id: string, vendorId: string, vendorName: string, overrides: Partial<VendorAssignment> = {}): VendorAssignment {
  return {
    id: id as any,
    tableId: `${id}-table` as any,
    layoutId: 'draft' as any,
    vendorId: vendorId as any,
    vendorName,
    vendorCategory: null,
    colorOverride: null,
    notes: null,
    paymentStatus: 'unknown',
    importSessionId: null,
    ...overrides,
  }
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(blob)
  })
}

describe('export safety', () => {
  const originalOpen = window.open
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  let createObjectUrlMock: jest.Mock<string, [Blob | MediaSource]>
  let revokeObjectUrlMock: jest.Mock<void, [string]>
  let clickSpy: jest.SpyInstance<void, [], HTMLAnchorElement>

  beforeEach(() => {
    createObjectUrlMock = jest.fn((blob: Blob | MediaSource) => {
      void blob
      return 'blob:mock'
    }) as jest.Mock<string, [Blob | MediaSource]>
    revokeObjectUrlMock = jest.fn((url: string) => {
      void url
    }) as jest.Mock<void, [string]>
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    })
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    window.open = jest.fn(() => ({ focus: jest.fn(), print: jest.fn() } as unknown as Window))
  })

  afterEach(() => {
    window.open = originalOpen
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    })
    clickSpy.mockRestore()
    jest.clearAllMocks()
  })

  it('prefixes dangerous CSV cell values before CSV escaping', async () => {
    const tables = {
      t1: makeTable('t1', { roomId: '@room', displayId: '-42', label: '-42' }),
      t2: makeTable('t2', { roomId: 'room-2', displayId: 'B-2', label: 'B-2', order: 1 }),
    }
    const vendors = {
      v1: makeVendor('v1', { companyName: '=HYPERLINK("http://x","y")' }),
      v2: makeVendor('v2', { companyName: '+cmd' }),
    }
    const assignments = {
      a1: makeAssignment('a1', 'v1', 'ignored', { tableId: 't1' as any, notes: '\tTabbed note' }),
      a2: makeAssignment('a2', 'v2', 'ignored', { tableId: 't2' as any, notes: '\rCarriage note' }),
    }

    exportVendorAssignmentsCsv(tables, vendors, assignments, null, 'Vendor Export')

    const csvBlob = createObjectUrlMock.mock.calls[0][0] as Blob
    const csv = await readBlobText(csvBlob)

    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""y"")","'@room","'-42","No","'\tTabbed note"`)
    expect(csv).toContain(`"'+cmd","room-2","B-2","No","'\rCarriage note"`)
    expect(clickSpy).toHaveBeenCalled()
  })

  it('escapes background image data URLs inside exported SVG while preserving valid data URLs', async () => {
    const tables = {
      t1: makeTable('t1'),
    }
    const vendors = {
      v1: makeVendor('v1', { companyName: 'Vendor One' }),
    }
    const assignments = {
      a1: makeAssignment('a1', 'v1', 'Vendor One', { tableId: 't1' as any }),
    }
    const room: CompositeRoom = {
      segments: [{ id: 'seg-1' as any, x: 0, y: 0, width: 200, height: 120 }],
      circles: [],
      freehandVertices: null,
      roomLabels: { 'room-1': 'Main Room' },
    }
    const doors: Record<string, Door> = {}
    const sections: Record<string, Section> = {}
    const backgroundImages: Record<string, BackgroundImage> = {
      img1: {
        id: 'img1' as any,
        name: 'floor.png',
        dataUrl: 'data:image/png;base64,QUJD" onload="alert(1)',
        x: 10,
        y: 10,
        width: 80,
        height: 40,
        opacity: 0.4,
        locked: false,
        visible: true,
        order: 0,
      },
      img2: {
        id: 'img2' as any,
        name: 'ok.png',
        dataUrl: 'data:image/png;base64,QUJD+/=',
        x: 20,
        y: 60,
        width: 50,
        height: 30,
        opacity: 0.5,
        locked: false,
        visible: true,
        order: 1,
      },
    }

    printShowModeSheet(tables, sections, vendors, assignments, room, 'Show Sheet', doors, backgroundImages)

    const htmlBlob = createObjectUrlMock.mock.calls[0][0] as Blob
    const html = await readBlobText(htmlBlob)

    expect(html).toContain('href="data:image/png;base64,QUJD&quot; onload=&quot;alert(1)"')
    expect(html).not.toContain('href="data:image/png;base64,QUJD" onload="alert(1)"')
    expect(html).toContain('href="data:image/png;base64,QUJD+/="')
  })
})
