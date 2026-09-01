import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_SETTINGS } from './defaults'
import {
  MAX_BACKGROUND_IMAGE_DATA_BYTES,
  validateDocumentSlice,
} from './document-schema'

function documentWithImage(dataUrl: string) {
  return {
    tables: {},
    rows: {},
    sections: {},
    vendors: {},
    vendorAssignments: {},
    room: null,
    doors: {},
    settings: { ...DEFAULT_SETTINGS },
    backgroundImages: {
      image: {
        id: 'image',
        name: 'Floor plan',
        dataUrl,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        opacity: 1,
        locked: false,
        visible: true,
        order: 0,
      },
    },
  }
}

test('accepts safe raster data URLs and detached browser image placeholders', () => {
  assert.equal(
    validateDocumentSlice(documentWithImage('data:image/png;base64,iVBORw0KGgo=')).backgroundImages.image.dataUrl,
    'data:image/png;base64,iVBORw0KGgo=',
  )
  assert.equal(
    validateDocumentSlice(documentWithImage('')).backgroundImages.image.dataUrl,
    '',
  )
})

test('rejects remote and executable background image sources', () => {
  assert.throws(
    () => validateDocumentSlice(documentWithImage('https://attacker.example/tracker.png')),
    /must be a PNG, JPEG, or WebP data URL/,
  )
  assert.throws(
    () => validateDocumentSlice(documentWithImage('data:image/svg+xml;base64,PHN2Zz4=')),
    /must be a PNG, JPEG, or WebP data URL/,
  )
})

test('rejects oversized decoded background images', () => {
  const encoded = 'A'.repeat(Math.ceil((MAX_BACKGROUND_IMAGE_DATA_BYTES + 1) * 4 / 3 / 4) * 4)
  assert.throws(
    () => validateDocumentSlice(documentWithImage(`data:image/webp;base64,${encoded}`)),
    /is too large/,
  )
})
