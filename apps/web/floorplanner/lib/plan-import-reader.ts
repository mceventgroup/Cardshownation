import type { ReviewImage } from '../components/editor/BuildingPlanReview'
import type { PlanStructure } from '../domain/types'
import { detectPlanStructures, parsePlanDimension } from './plan-structure'
import { readPlanDxf } from './plan-dxf'
let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null

function getPdfJs() {
  if (!pdfjsReady) {
    pdfjsReady = import('pdfjs-dist').then(lib => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).toString()
      return lib
    })
  }
  return pdfjsReady
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the floor plan image.'))
    image.src = dataUrl
  })
}

export async function renderImageFile(file: File): Promise<Omit<ReviewImage, 'structures'>> {
  const rawDataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(rawDataUrl)
  const dataUrl = await compressImage(rawDataUrl, image.naturalWidth, image.naturalHeight)
  return {
    name: file.name,
    dataUrl,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  }
}

const PDF_RENDER_SCALE = 2
const MAX_DIMENSION = 2400
const JPEG_QUALITY = 0.82

export async function renderPdfToImages(file: File): Promise<Array<Omit<ReviewImage, 'structures'>>> {
  const pdfjsLib = await getPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const results: Array<Omit<ReviewImage, 'structures'>> = []

  try {
  if (pdf.numPages > 20) throw new Error('Choose a PDF with up to 20 pages. Export just the floor-plan pages from a larger drawing set.')
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const rawViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(PDF_RENDER_SCALE, MAX_DIMENSION / Math.max(rawViewport.width, rawViewport.height)) })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The browser could not render this PDF page.')

    await page.render({ canvasContext: context, viewport }).promise
    const rawDataUrl = canvas.toDataURL('image/png')
    const dataUrl = await compressImage(rawDataUrl, viewport.width, viewport.height)
    const text = await page.getTextContent()
    const dimensionLabels = [...new Set(text.items.flatMap(item => 'str' in item && parsePlanDimension(item.str) ? [item.str.trim()] : []))].slice(0, 100)

    results.push({
      name: pdf.numPages > 1 ? `${file.name} - page ${pageNumber}` : file.name,
      dataUrl,
      naturalWidth: viewport.width,
      naturalHeight: viewport.height,
      dimensionLabels,
    })
    canvas.width = 0; canvas.height = 0; page.cleanup()
  }

  return results
  } finally { await pdf.destroy() }
}

export async function renderDxfFile(file: File): Promise<ReviewImage> {
  const drawing = readPlanDxf(await file.text())
  const points = drawing.lines.flatMap(l => [l.start, l.end]).concat(drawing.circles.flatMap(c => [{ x: c.center.x - c.radius, y: c.center.y - c.radius }, { x: c.center.x + c.radius, y: c.center.y + c.radius }]))
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y))
  const extent = Math.max(maxX - minX, maxY - minY)
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('The DXF has no usable drawing area.')
  const scale = 2200 / extent, width = Math.max(100, Math.ceil((maxX - minX) * scale + 80)), height = Math.max(100, Math.ceil((maxY - minY) * scale + 80))
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not render CAD drawing.')
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#111827'; ctx.lineWidth = 2
  const structures: PlanStructure[] = []
  const convert = (p: { x: number; y: number }) => ({ x: 40 + (p.x - minX) * scale, y: 40 + (maxY - p.y) * scale })
  for (const line of drawing.lines) {
    const start = convert(line.start), end = convert(line.end)
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
    if (/wall/i.test(line.layer) && Math.hypot(end.x - start.x, end.y - start.y) > 0) structures.push({ id: `dxf-${structures.length}`, kind: 'wall', source: 'auto', ...start, width: Math.hypot(end.x - start.x, end.y - start.y), height: 2, rotation: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI })
  }
  for (const circle of drawing.circles) {
    const center = convert(circle.center), radius = circle.radius * scale
    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.stroke()
    if (/column|pillar|colu/i.test(circle.layer)) structures.push({ id: `dxf-${structures.length}`, kind: 'pillar', shape: 'ellipse', source: 'auto', x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2, rotation: 0 })
  }
  if (!structures.length) structures.push(...detectPlanStructures(ctx.getImageData(0, 0, width, height)))
  if (structures.length > 2000) throw new Error('Too many wall segments. Simplify the CAD floor-plan layers or export a PDF.')
  return { name: file.name, dataUrl: canvas.toDataURL('image/png'), naturalWidth: width, naturalHeight: height, structures, inchesPerPixel: drawing.inchesPerUnit ? drawing.inchesPerUnit / scale : undefined }
}

export async function detectStructuresInDataUrl(
  dataUrl: string,
  naturalWidth: number,
  naturalHeight: number,
  options: Pick<ReviewImage, 'detectionArea' | 'contrast'> = {},
): Promise<PlanStructure[]> {
  const image = await loadImage(dataUrl)
  const area = options.detectionArea || { x: 0, y: 0, width: naturalWidth, height: naturalHeight }
  const analysisScale = Math.min(1, 1400 / Math.max(area.width, area.height))
  const width = Math.max(1, Math.round(area.width * analysisScale))
  const height = Math.max(1, Math.round(area.height * analysisScale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  context.drawImage(image, area.x * image.naturalWidth / naturalWidth, area.y * image.naturalHeight / naturalHeight, area.width * image.naturalWidth / naturalWidth, area.height * image.naturalHeight / naturalHeight, 0, 0, width, height)
  const detected = detectPlanStructures(context.getImageData(0, 0, width, height), options.contrast)
  const scaleX = area.width / width
  const scaleY = area.height / height

  return detected.map(rectangle => ({
    ...rectangle,
    id: crypto.randomUUID(),
    x: area.x + rectangle.x * scaleX,
    y: area.y + rectangle.y * scaleY,
    width: rectangle.width * scaleX,
    height: rectangle.height * scaleY,
  }))
}

function compressImage(dataUrl: string, naturalWidth: number, naturalHeight: number): Promise<string> {
  return new Promise(resolve => {
    if (naturalWidth <= MAX_DIMENSION && naturalHeight <= MAX_DIMENSION && dataUrl.length < 350_000) {
      resolve(dataUrl)
      return
    }

    const image = new window.Image()
    image.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / naturalWidth, MAX_DIMENSION / naturalHeight)
      const width = Math.max(1, Math.round(naturalWidth * scale))
      const height = Math.max(1, Math.round(naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(dataUrl)
        return
      }
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}
