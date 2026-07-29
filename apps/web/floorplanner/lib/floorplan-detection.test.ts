import test from 'node:test'
import assert from 'node:assert/strict'

import {
  detectTableRectangles,
  medianLongSide,
  orderFloorplanRectangles,
  type FloorplanRectangle,
  type PixelImage,
} from './floorplan-detection'

function createImage(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  return { width, height, data }
}

function setPixel(image: PixelImage, x: number, y: number, value = 20): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  const offset = (y * image.width + x) * 4
  image.data[offset] = value
  image.data[offset + 1] = value
  image.data[offset + 2] = value
  image.data[offset + 3] = 255
}

function drawRectangle(
  image: PixelImage,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness = 2,
): void {
  for (let offset = 0; offset < thickness; offset++) {
    for (let px = x; px < x + width; px++) {
      setPixel(image, px, y + offset)
      setPixel(image, px, y + height - 1 - offset)
    }
    for (let py = y; py < y + height; py++) {
      setPixel(image, x + offset, py)
      setPixel(image, x + width - 1 - offset, py)
    }
  }
}

function fillRectangle(
  image: PixelImage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number],
): void {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue
      const offset = (py * image.width + px) * 4
      image.data[offset] = color[0]
      image.data[offset + 1] = color[1]
      image.data[offset + 2] = color[2]
      image.data[offset + 3] = 255
    }
  }
}

test('detects repeated table rectangles and ignores a large room outline', () => {
  const image = createImage(640, 420)

  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 4; column++) {
      drawRectangle(image, 55 + column * 120, 55 + row * 95, 70, 26)
    }
  }

  drawRectangle(image, 15, 15, 600, 370, 3)

  const rectangles = detectTableRectangles(image)

  assert.equal(rectangles.length, 12)
  assert.ok(rectangles.every(rectangle => Math.abs(rectangle.width - 70) <= 2))
  assert.ok(rectangles.every(rectangle => Math.abs(rectangle.height - 26) <= 2))
})

test('keeps the dominant repeated rectangle size when labels contain boxes', () => {
  const image = createImage(520, 320)

  for (let index = 0; index < 8; index++) {
    drawRectangle(image, 40 + (index % 4) * 115, 45 + Math.floor(index / 4) * 120, 68, 24)
  }
  drawRectangle(image, 25, 270, 32, 18)
  drawRectangle(image, 75, 270, 35, 18)

  const rectangles = detectTableRectangles(image)

  assert.equal(rectangles.length, 8)
  assert.equal(medianLongSide(rectangles), 68)
})

test('separates touching gray table cells by their shared dark borders', () => {
  const image = createImage(520, 240)
  const cellWidth = 52
  const cellHeight = 24

  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 5; column++) {
      const x = 45 + column * cellWidth
      const y = 45 + row * 90
      fillRectangle(image, x, y, cellWidth, cellHeight, [232, 236, 239])
      drawRectangle(image, x, y, cellWidth + 1, cellHeight, 2)
      // Simulate a dark printed table number inside the shaded cell.
      fillRectangle(image, x + 24, y + 7, 4, 10, [20, 20, 20])
    }
  }

  const rectangles = detectTableRectangles(image)

  assert.equal(rectangles.length, 10)
  assert.ok(rectangles.every(rectangle => rectangle.width >= 48 && rectangle.width <= 55))
  assert.ok(rectangles.every(rectangle => rectangle.height >= 20 && rectangle.height <= 26))
})

test('orders imported tables in stable visual rows before numbering', () => {
  const rectangle = (
    id: string,
    x: number,
    y: number,
    rotation = 0,
  ): FloorplanRectangle => ({
    id,
    x,
    y,
    width: 60,
    height: 24,
    rotation,
    confidence: 1,
    source: 'auto',
  })
  const rectangles = [
    rectangle('bottom-right', 220, 150),
    rectangle('top-right', 220, 50),
    rectangle('bottom-left', 40, 150),
    rectangle('top-left', 40, 50),
  ]

  assert.deepEqual(
    orderFloorplanRectangles(rectangles).map(item => item.id),
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  )
})
