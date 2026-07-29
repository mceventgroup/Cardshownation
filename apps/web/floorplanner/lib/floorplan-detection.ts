export interface FloorplanRectangle {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  confidence: number
  source: 'auto' | 'manual'
}

export interface PixelImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

interface ComponentCandidate extends FloorplanRectangle {
  longSide: number
  shortSide: number
}

const MAX_RESULTS = 300

function percentileFromHistogram(histogram: Uint32Array, total: number, percentile: number): number {
  const target = Math.max(1, Math.round(total * percentile))
  let seen = 0
  for (let value = 0; value < histogram.length; value++) {
    seen += histogram[value]
    if (seen >= target) return value
  }
  return 255
}

function buildDarkMask(image: PixelImage): Uint8Array {
  const { width, height, data } = image
  const histogram = new Uint32Array(256)
  const pixelCount = width * height

  for (let index = 0; index < pixelCount; index++) {
    const offset = index * 4
    if (data[offset + 3] < 48) continue
    const luminance = Math.round(
      data[offset] * 0.2126 +
      data[offset + 1] * 0.7152 +
      data[offset + 2] * 0.0722,
    )
    histogram[luminance]++
  }

  const background = percentileFromHistogram(histogram, pixelCount, 0.88)
  const threshold = Math.max(85, Math.min(215, background - 42))
  const mask = new Uint8Array(pixelCount)

  for (let index = 0; index < pixelCount; index++) {
    const offset = index * 4
    if (data[offset + 3] < 48) continue
    const luminance =
      data[offset] * 0.2126 +
      data[offset + 1] * 0.7152 +
      data[offset + 2] * 0.0722
    if (luminance <= threshold) mask[index] = 1
  }

  return mask
}

function buildShadedMask(image: PixelImage): Uint8Array {
  const { width, height, data } = image
  const mask = new Uint8Array(width * height)

  for (let index = 0; index < width * height; index++) {
    const offset = index * 4
    if (data[offset + 3] < 48) continue
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
    const distanceFromWhite = Math.max(255 - red, 255 - green, 255 - blue)

    // Hotel plans commonly use a light gray or colored fill for tables. Keep
    // those fill pixels while excluding black labels and white page space.
    if (luminance >= 145 && luminance <= 246 && distanceFromWhite >= 12) {
      mask[index] = 1
    }
  }

  return mask
}

function buildWallMask(image: PixelImage): Uint8Array {
  const { width, height, data } = image
  const mask = new Uint8Array(width * height)

  for (let index = 0; index < width * height; index++) {
    const offset = index * 4
    if (data[offset + 3] < 48) continue
    const luminance =
      data[offset] * 0.2126 +
      data[offset + 1] * 0.7152 +
      data[offset + 2] * 0.0722
    if (luminance <= 205) mask[index] = 1
  }

  return mask
}

function sideCoverage(
  mask: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  side: 'top' | 'bottom' | 'left' | 'right',
  band: number,
): number {
  let hits = 0
  let total = 0

  if (side === 'top' || side === 'bottom') {
    const edgeY = side === 'top' ? minY : maxY
    for (let x = minX; x <= maxX; x++) {
      total++
      let found = false
      for (let delta = -band; delta <= band && !found; delta++) {
        const y = edgeY + delta
        if (y >= 0 && y < imageHeight && mask[y * imageWidth + x]) found = true
      }
      if (found) hits++
    }
  } else {
    const edgeX = side === 'left' ? minX : maxX
    for (let y = minY; y <= maxY; y++) {
      total++
      let found = false
      for (let delta = -band; delta <= band && !found; delta++) {
        const x = edgeX + delta
        if (x >= 0 && x < imageWidth && mask[y * imageWidth + x]) found = true
      }
      if (found) hits++
    }
  }

  return total === 0 ? 0 : hits / total
}

function intersectionOverUnion(a: FloorplanRectangle, b: FloorplanRectangle): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width, b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  if (intersection === 0) return 0
  const union = a.width * a.height + b.width * b.height - intersection
  return union === 0 ? 0 : intersection / union
}

function removeDuplicates(candidates: ComponentCandidate[]): ComponentCandidate[] {
  const ordered = [...candidates].sort((a, b) => b.confidence - a.confidence)
  const kept: ComponentCandidate[] = []

  for (const candidate of ordered) {
    if (kept.some(existing => intersectionOverUnion(existing, candidate) >= 0.72)) continue
    kept.push(candidate)
  }

  return kept
}

function keepDominantTableSizes(candidates: ComponentCandidate[]): ComponentCandidate[] {
  if (candidates.length < 4) return candidates

  let bestCluster: ComponentCandidate[] = []
  let bestScore = -1

  for (const seed of candidates) {
    const cluster = candidates.filter(candidate => {
      const longRatio = candidate.longSide / seed.longSide
      const shortRatio = candidate.shortSide / seed.shortSide
      return longRatio >= 0.68 && longRatio <= 1.47 && shortRatio >= 0.62 && shortRatio <= 1.62
    })
    const score = cluster.length + cluster.reduce((sum, candidate) => sum + candidate.confidence, 0) * 0.15
    if (score > bestScore) {
      bestScore = score
      bestCluster = cluster
    }
  }

  return bestCluster.length >= 3 ? bestCluster : candidates
}

function detectShadedTableRectangles(image: PixelImage): ComponentCandidate[] {
  const { width, height } = image
  const shadedMask = buildShadedMask(image)
  const wallMask = buildWallMask(image)
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  const candidates: ComponentCandidate[] = []
  const minShort = Math.max(3, Math.round(Math.min(width, height) * 0.002))
  const maxLong = Math.max(40, Math.round(Math.max(width, height) * 0.18))
  const maxArea = width * height * 0.02

  for (let start = 0; start < wallMask.length; start++) {
    if (wallMask[start] || visited[start]) continue

    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1

    let pixelCount = 0
    let shadedPixelCount = 0
    let sumX = 0
    let sumY = 0
    let sumXX = 0
    let sumYY = 0
    let sumXY = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      pixelCount++
      if (shadedMask[index]) shadedPixelCount++
      sumX += x
      sumY += y
      sumXX += x * x
      sumYY += y * y
      sumXY += x * y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      // Four-neighbor connectivity keeps adjacent table fills separate even
      // when two corners touch diagonally.
      const neighbors = [
        index - 1,
        index + 1,
        index - width,
        index + width,
      ]
      for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex++) {
        const nextIndex = neighbors[neighborIndex]
        if (nextIndex < 0 || nextIndex >= wallMask.length) continue
        if (neighborIndex === 0 && x === 0) continue
        if (neighborIndex === 1 && x === width - 1) continue
        if (wallMask[nextIndex] || visited[nextIndex]) continue
        visited[nextIndex] = 1
        queue[tail++] = nextIndex
      }
    }

    const preliminaryWidth = maxX - minX + 1
    const preliminaryHeight = maxY - minY + 1
    if (
      pixelCount < 8 ||
      shadedPixelCount < 6 ||
      shadedPixelCount / pixelCount < 0.16 ||
      preliminaryWidth * preliminaryHeight > maxArea ||
      Math.max(preliminaryWidth, preliminaryHeight) > maxLong
    ) {
      continue
    }

    const centerX = sumX / pixelCount
    const centerY = sumY / pixelCount
    const covarianceXX = sumXX / pixelCount - centerX * centerX
    const covarianceYY = sumYY / pixelCount - centerY * centerY
    const covarianceXY = sumXY / pixelCount - centerX * centerY
    const angle = 0.5 * Math.atan2(2 * covarianceXY, covarianceXX - covarianceYY)
    const axisX = Math.cos(angle)
    const axisY = Math.sin(angle)
    const perpendicularX = -axisY
    const perpendicularY = axisX

    let minAlong = Infinity
    let maxAlong = -Infinity
    let minAcross = Infinity
    let maxAcross = -Infinity
    for (let queueIndex = 0; queueIndex < tail; queueIndex++) {
      const index = queue[queueIndex]
      const x = index % width
      const y = Math.floor(index / width)
      const along = x * axisX + y * axisY
      const across = x * perpendicularX + y * perpendicularY
      if (along < minAlong) minAlong = along
      if (along > maxAlong) maxAlong = along
      if (across < minAcross) minAcross = across
      if (across > maxAcross) maxAcross = across
    }

    const padding = Math.max(1, Math.min(3, Math.sqrt(pixelCount) * 0.035))
    const candidateWidth = maxAlong - minAlong + 1 + padding * 2
    const candidateHeight = maxAcross - minAcross + 1 + padding * 2
    const longSide = Math.max(candidateWidth, candidateHeight)
    const shortSide = Math.min(candidateWidth, candidateHeight)
    const area = candidateWidth * candidateHeight
    const aspect = longSide / Math.max(1, shortSide)
    const fillRatio = shadedPixelCount / Math.max(1, pixelCount)

    if (
      shortSide < minShort ||
      longSide > maxLong ||
      area > maxArea ||
      aspect < 1.12 ||
      aspect > 8.5 ||
      fillRatio < 0.16
    ) {
      continue
    }

    let widthAlong = candidateWidth
    let heightAcross = candidateHeight
    let rotation = angle
    if (heightAcross > widthAlong) {
      const previousWidth = widthAlong
      widthAlong = heightAcross
      heightAcross = previousWidth
      rotation += Math.PI / 2
    }

    const orientedCenterAlong = (minAlong + maxAlong) / 2
    const orientedCenterAcross = (minAcross + maxAcross) / 2
    const orientedCenterX = orientedCenterAlong * axisX + orientedCenterAcross * perpendicularX
    const orientedCenterY = orientedCenterAlong * axisY + orientedCenterAcross * perpendicularY
    const rotationAxisX = Math.cos(rotation)
    const rotationAxisY = Math.sin(rotation)
    const rotationPerpendicularX = -rotationAxisY
    const rotationPerpendicularY = rotationAxisX
    const topLeftX =
      orientedCenterX -
      rotationAxisX * widthAlong / 2 -
      rotationPerpendicularX * heightAcross / 2
    const topLeftY =
      orientedCenterY -
      rotationAxisY * widthAlong / 2 -
      rotationPerpendicularY * heightAcross / 2
    const rotationDegrees = (rotation * 180 / Math.PI + 360) % 360

    candidates.push({
      id: `shade-${Math.round(topLeftX)}-${Math.round(topLeftY)}-${Math.round(widthAlong)}-${Math.round(heightAcross)}`,
      x: topLeftX,
      y: topLeftY,
      width: widthAlong,
      height: heightAcross,
      rotation: rotationDegrees,
      confidence: Math.min(1, 0.62 + Math.min(0.25, fillRatio * 0.35) + (aspect >= 1.5 ? 0.1 : 0.03)),
      source: 'auto',
      longSide,
      shortSide,
    })
  }

  return keepDominantTableSizes(removeDuplicates(candidates))
}

/**
 * Finds repeated, axis-aligned rectangular outlines in a raster floor plan.
 * Hotel tables are normally isolated outlines, so connected components plus
 * border coverage is both fast and predictable. The review UI remains the
 * source of truth: users can remove false matches and trace missed tables.
 */
export function detectTableRectangles(image: PixelImage): FloorplanRectangle[] {
  const { width, height } = image
  if (width < 16 || height < 16 || image.data.length < width * height * 4) return []

  const shadedCandidates = detectShadedTableRectangles(image)
  if (shadedCandidates.length >= 3) {
    return shadedCandidates
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .slice(0, MAX_RESULTS)
      .map(({ longSide: _longSide, shortSide: _shortSide, ...rectangle }) => rectangle)
  }

  const mask = buildDarkMask(image)
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  const candidates: ComponentCandidate[] = []
  const minShort = Math.max(5, Math.round(Math.min(width, height) * 0.004))
  const maxLong = Math.max(40, Math.round(Math.max(width, height) * 0.24))
  const maxArea = width * height * 0.035

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue

    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1

    let pixelCount = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      pixelCount++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      for (let dy = -1; dy <= 1; dy++) {
        const nextY = y + dy
        if (nextY < 0 || nextY >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nextX = x + dx
          if (nextX < 0 || nextX >= width) continue
          const nextIndex = nextY * width + nextX
          if (!mask[nextIndex] || visited[nextIndex]) continue
          visited[nextIndex] = 1
          queue[tail++] = nextIndex
        }
      }
    }

    const candidateWidth = maxX - minX + 1
    const candidateHeight = maxY - minY + 1
    const longSide = Math.max(candidateWidth, candidateHeight)
    const shortSide = Math.min(candidateWidth, candidateHeight)
    const area = candidateWidth * candidateHeight
    const aspect = longSide / Math.max(1, shortSide)

    if (
      pixelCount < Math.max(12, minShort * 2) ||
      shortSide < minShort ||
      longSide > maxLong ||
      area > maxArea ||
      aspect < 1.18 ||
      aspect > 8.5
    ) {
      continue
    }

    const band = Math.max(1, Math.min(3, Math.round(shortSide * 0.08)))
    const coverage = [
      sideCoverage(mask, width, height, minX, minY, maxX, maxY, 'top', band),
      sideCoverage(mask, width, height, minX, minY, maxX, maxY, 'bottom', band),
      sideCoverage(mask, width, height, minX, minY, maxX, maxY, 'left', band),
      sideCoverage(mask, width, height, minX, minY, maxX, maxY, 'right', band),
    ]
    const minimumCoverage = Math.min(...coverage)
    const averageCoverage = coverage.reduce((sum, value) => sum + value, 0) / coverage.length

    if (minimumCoverage < 0.42 || averageCoverage < 0.58) continue

    const perimeter = Math.max(1, 2 * (candidateWidth + candidateHeight))
    const confidence = Math.min(
      1,
      averageCoverage * 0.72 +
      Math.min(1, pixelCount / perimeter) * 0.18 +
      (aspect >= 1.7 && aspect <= 4.8 ? 0.1 : 0.04),
    )

    candidates.push({
      id: `auto-${minX}-${minY}-${candidateWidth}-${candidateHeight}`,
      x: minX,
      y: minY,
      width: candidateWidth,
      height: candidateHeight,
      rotation: 0,
      confidence,
      source: 'auto',
      longSide,
      shortSide,
    })
  }

  return keepDominantTableSizes(removeDuplicates(candidates))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, MAX_RESULTS)
    .map(({ longSide: _longSide, shortSide: _shortSide, ...rectangle }) => rectangle)
}

export function medianLongSide(rectangles: ReadonlyArray<FloorplanRectangle>): number | null {
  if (rectangles.length === 0) return null
  const values = rectangles
    .map(rectangle => Math.max(rectangle.width, rectangle.height))
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
  if (values.length === 0) return null
  const middle = Math.floor(values.length / 2)
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle]
}
