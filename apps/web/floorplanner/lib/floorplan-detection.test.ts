import test from 'node:test'
import assert from 'node:assert/strict'

import { detectTableRectangles, medianLongSide, type PixelImage } from './floorplan-detection'

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
