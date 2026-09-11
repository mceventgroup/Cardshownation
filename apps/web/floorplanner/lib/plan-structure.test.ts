import test from 'node:test'
import assert from 'node:assert/strict'
import { detectPlanStructures, parsePlanDimension, polygonsOverlap, scaleFromReference, structurePolygon } from './plan-structure'
import { readPlanDxf } from './plan-dxf'
import { validateDocumentSlice } from './document-schema'
import { DEFAULT_SETTINGS } from './defaults'
import { buildSVG } from './export'

test('detects building walls and a solid pillar while excluding repeated outlined tables', () => {
  const width = 800, height = 600, data = new Uint8ClampedArray(width * height * 4).fill(255)
  function fill(x: number, y: number, w: number, h: number) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const p = (yy * width + xx) * 4; data[p] = data[p + 1] = data[p + 2] = 20 } }
  fill(20, 20, 750, 6); fill(20, 570, 750, 6); fill(20, 20, 6, 550); fill(764, 20, 6, 550)
  fill(380, 270, 18, 18)
  for (let i = 0; i < 6; i++) { const x = 70 + i * 110; fill(x, 100, 65, 2); fill(x, 125, 65, 2); fill(x, 100, 2, 27); fill(x + 63, 100, 2, 27) }
  const result = detectPlanStructures({ width, height, data })
  assert.equal(result.filter(s => s.kind === 'pillar').length, 1)
  assert.equal(result.filter(s => s.kind === 'wall').length, 4)
  assert.ok(result.every(s => s.y < 30 || s.y > 560 || s.x < 30 || s.x > 760 || s.kind === 'pillar'))
})

test('scale uses real lengths with explicit units and rejects invalid calibration', () => {
  assert.equal(parsePlanDimension(`40'-6"`), 486)
  assert.equal(parsePlanDimension(`40' 6 1/2"`), 486.5)
  assert.equal(parsePlanDimension('6½ in'), 6.5)
  assert.equal(parsePlanDimension('1/2 in'), .5)
  assert.equal(parsePlanDimension('2 1/0 in'), null)
  assert.equal(parsePlanDimension('Infinity ft'), null)
  assert.equal(parsePlanDimension('3048 mm'), 120)
  assert.equal(parsePlanDimension('40'), null)
  assert.equal(scaleFromReference({ x: 0, y: 0 }, { x: 300, y: 400 }, 1000), 2)
  assert.throws(() => scaleFromReference({ x: 0, y: 0 }, { x: 0, y: 0 }, 10))
  assert.throws(() => scaleFromReference({ x: 0, y: 0 }, { x: 100, y: 0 }, -10))
})

test('faint scan mode detects light walls without recognizing furniture outlines', () => {
  const width = 800, height = 600, data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let y = 40; y < 46; y++) for (let x = 30; x < 740; x++) { const p = (y * width + x) * 4; data[p] = data[p + 1] = data[p + 2] = 170 }
  assert.equal(detectPlanStructures({ width, height, data }).length, 0)
  assert.equal(detectPlanStructures({ width, height, data }, 'faint').filter(s => s.kind === 'wall').length, 1)
})

test('building structures and scale survive validation and appear in monochrome exports', () => {
  const plan = { sourceWidth: 500, sourceHeight: 400, calibrated: true, structures: [{ id: 'w', kind: 'wall', source: 'manual', x: 40, y: 50, width: 100, height: 5, rotation: 45 }] }
  const data = { tables: {}, rows: {}, sections: {}, vendors: {}, vendorAssignments: {}, room: null, doors: {}, settings: DEFAULT_SETTINGS, backgroundImages: { image: { id: 'image', name: 'Drawing', dataUrl: '', x: 10, y: 20, width: 1000, height: 800, opacity: 0, locked: true, visible: true, order: 0, plan } } }
  const parsed = validateDocumentSlice(JSON.parse(JSON.stringify(data)))
  assert.deepEqual(parsed.backgroundImages.image.plan, plan)
  assert.equal(Object.keys(parsed.tables).length, 0)
  const image = parsed.backgroundImages.image, polygon = structurePolygon(image, image.plan!.structures[0])
  assert.deepEqual(polygon[0], { x: 90, y: 120 })
  assert.ok(polygonsOverlap(polygon, polygon))
  const output = buildSVG([], {}, {}, {}, null, [], { colorMode: 'bw', showVendorNames: false, showPaymentStatus: false, title: 'Building' }, parsed.backgroundImages)
  assert.ok(output.svg.includes('fill="#333333"'))
  assert.throws(() => validateDocumentSlice({ ...data, backgroundImages: { image: { ...data.backgroundImages.image, plan: { ...plan, sourceWidth: 0 } } } }))
})

test('DXF preserves linework and units, excludes furniture layers, and rejects unsupported geometry', () => {
  const dxf = ['0','SECTION','2','HEADER','9','$INSUNITS','70','2','0','ENDSEC','0','SECTION','2','ENTITIES','0','LINE','8','A-WALL','10','0','20','0','11','40','21','0','0','LINE','8','TABLES','10','5','20','5','11','8','21','5','0','ENDSEC','0','EOF'].join('\n')
  const result = readPlanDxf(dxf)
  assert.equal(result.inchesPerUnit, 12)
  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0].end.x, 40)
  assert.throws(() => readPlanDxf(dxf.replace('LINE', 'INSERT')), /INSERT/)
  assert.throws(() => readPlanDxf('AutoCAD Binary DXF'), /Binary/)
})
