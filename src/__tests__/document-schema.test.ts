import { DEFAULT_SETTINGS } from '@/lib/defaults'
import { validateDocumentSlice } from '@/lib/document-schema'
import type { DocumentSlice } from '@/lib/persistence'

function createValidSlice(): DocumentSlice {
  return {
    tables: {
      t1: {
        id: 't1' as never,
        roomId: 'room-a',
        tableNumber: 1,
        displayId: '1',
        x: 10,
        y: 20,
        width: 96,
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
    vendors: {},
    vendorAssignments: {},
    room: {
      segments: [],
      circles: [],
      freehandVertices: null,
      roomLabels: {},
    },
    doors: {},
    settings: DEFAULT_SETTINGS,
    backgroundImages: {},
  }
}

describe('validateDocumentSlice', () => {
  it('accepts a valid document slice', () => {
    const slice = createValidSlice()
    expect(validateDocumentSlice(slice)).toEqual(slice)
  })

  it('rejects malformed table payloads', () => {
    const slice = createValidSlice() as unknown as { tables: Record<string, { width: string }> }
    slice.tables.t1.width = 'wide'

    expect(() => validateDocumentSlice(slice)).toThrow('Layout data.tables.t1.width must be a finite number.')
  })
})
