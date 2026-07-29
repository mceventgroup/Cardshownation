'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@floorplanner/store/index'
import { createBackgroundImageId, createTableId } from '@floorplanner/lib/id'
import { getNextLabelNumberForRoom } from '@floorplanner/lib/labels'
import { getDefaultRoomId, getRoomIdForPoint } from '@floorplanner/domain/room-numbering'
import type { BackgroundImage, TableObject } from '@floorplanner/domain/types'
import {
  detectTableRectangles,
  medianLongSide,
  type FloorplanRectangle,
} from '@floorplanner/lib/floorplan-detection'
import FloorplanPageReview from './FloorplanPageReview'

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

interface Props {
  onClose: () => void
}

type Arrangement = 'side-by-side' | 'stacked' | 'separate'

interface PendingImage {
  name: string
  dataUrl: string
  naturalWidth: number
  naturalHeight: number
  rectangles: FloorplanRectangle[]
}

interface PageLayout {
  image: PendingImage
  x: number
  y: number
  width: number
  height: number
  scaleX: number
  scaleY: number
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const PAGE_GAP = 24
const PLAN_MARGIN = 24

export default function BackgroundImageModal({ onClose }: Props) {
  const addBackgroundImage = useEditorStore(state => state.addBackgroundImage)
  const dispatch = useEditorStore(state => state.dispatch)
  const setSelected = useEditorStore(state => state.setSelected)
  const setActiveTool = useEditorStore(state => state.setActiveTool)
  const settings = useEditorStore(state => state.settings)

  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [arrangement, setArrangement] = useState<Arrangement>('side-by-side')
  const [opacity, setOpacity] = useState(0.45)
  const [targetTableLength, setTargetTableLength] = useState(settings.defaultTableWidth)
  const [error, setError] = useState('')
  const [loadingMessage, setLoadingMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const analyzeImage = useCallback(async (
    image: Omit<PendingImage, 'rectangles'>,
  ): Promise<PendingImage> => {
    const rectangles = await detectRectanglesInDataUrl(
      image.dataUrl,
      image.naturalWidth,
      image.naturalHeight,
    )
    return { ...image, rectangles }
  }, [])

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError('')
    setLoadingMessage('Reading floor plan...')

    try {
      const results: PendingImage[] = []

      for (const file of Array.from(files)) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        if (!isPdf && !ALLOWED_TYPES.includes(file.type)) {
          throw new Error(`Unsupported file type: ${file.name}. Use PNG, JPEG, WebP, or PDF.`)
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File too large: ${file.name}. Maximum size is 20 MB per file.`)
        }

        const renderedImages = isPdf
          ? await renderPdfToImages(file)
          : [await renderImageFile(file)]

        for (const renderedImage of renderedImages) {
          setLoadingMessage(`Finding table rectangles on ${renderedImage.name}...`)
          results.push(await analyzeImage(renderedImage))
        }
      }

      setPendingImages(current => [...current, ...results])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The floor plan could not be read.')
    } finally {
      setLoadingMessage('')
    }
  }, [analyzeImage])

  const resetDetection = useCallback(async (index: number) => {
    const image = pendingImages[index]
    if (!image) return
    setError('')
    setLoadingMessage(`Finding table rectangles on ${image.name}...`)
    try {
      const rectangles = await detectRectanglesInDataUrl(
        image.dataUrl,
        image.naturalWidth,
        image.naturalHeight,
      )
      setPendingImages(current => current.map((entry, entryIndex) => (
        entryIndex === index ? { ...entry, rectangles } : entry
      )))
    } catch {
      setError('Automatic detection could not read this page. You can still trace the tables manually.')
    } finally {
      setLoadingMessage('')
    }
  }, [pendingImages])

  function updateRectangles(index: number, rectangles: FloorplanRectangle[]) {
    setPendingImages(current => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, rectangles } : entry
    )))
  }

  function removePage(index: number) {
    setPendingImages(current => current.filter((_, entryIndex) => entryIndex !== index))
  }

  function buildPageLayouts(): PageLayout[] {
    const allRectangles = pendingImages.flatMap(image => image.rectangles)
    const typicalTableLength = medianLongSide(allRectangles)
    const calibratedScale = typicalTableLength
      ? Math.max(0.05, Math.min(20, targetTableLength / typicalTableLength))
      : null

    const baseSizes = pendingImages.map(image => {
      if (calibratedScale) {
        return {
          image,
          width: image.naturalWidth * calibratedScale,
          height: image.naturalHeight * calibratedScale,
        }
      }

      const fitScale = Math.min(
        (settings.canvasWidth - PLAN_MARGIN * 2) / image.naturalWidth,
        (settings.canvasHeight - PLAN_MARGIN * 2) / image.naturalHeight,
        1,
      )
      return {
        image,
        width: image.naturalWidth * fitScale,
        height: image.naturalHeight * fitScale,
      }
    })

    let nextX = PLAN_MARGIN
    let nextY = PLAN_MARGIN

    return baseSizes.map((size, index) => {
      const x = nextX
      const y = nextY

      if (arrangement === 'side-by-side') {
        nextX += size.width + PAGE_GAP
      } else if (arrangement === 'stacked') {
        nextY += size.height + PAGE_GAP
      } else {
        nextX = PLAN_MARGIN + (index + 1) * PAGE_GAP
        nextY = PLAN_MARGIN + (index + 1) * PAGE_GAP
      }

      return {
        ...size,
        x,
        y,
        scaleX: size.width / size.image.naturalWidth,
        scaleY: size.height / size.image.naturalHeight,
      }
    })
  }

  function handleImport() {
    if (pendingImages.length === 0) return

    const state = useEditorStore.getState()
    const pageLayouts = buildPageLayouts()
    const existingBackgroundCount = Object.keys(state.backgroundImages).length
    const maxX = Math.max(...pageLayouts.map(page => page.x + page.width)) + PLAN_MARGIN
    const maxY = Math.max(...pageLayouts.map(page => page.y + page.height)) + PLAN_MARGIN

    if (maxX > settings.canvasWidth || maxY > settings.canvasHeight) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        prev: {
          canvasWidth: settings.canvasWidth,
          canvasHeight: settings.canvasHeight,
        },
        next: {
          canvasWidth: Math.max(settings.canvasWidth, Math.ceil(maxX / 12) * 12),
          canvasHeight: Math.max(settings.canvasHeight, Math.ceil(maxY / 12) * 12),
        },
        timestamp: Date.now(),
      })
    }

    pageLayouts.forEach((page, index) => {
      const backgroundImage: BackgroundImage = {
        id: createBackgroundImageId(),
        name: page.image.name,
        dataUrl: page.image.dataUrl,
        x: page.x,
        y: page.y,
        width: page.width,
        height: page.height,
        opacity,
        locked: true,
        visible: true,
        order: existingBackgroundCount + index,
      }
      addBackgroundImage(backgroundImage)
    })

    const existingTables = state.tables
    const currentRoom = state.room
    const defaultRoomId = getDefaultRoomId(currentRoom) ?? 'R1'
    const nextNumberByRoom = new Map<string, number>()
    const importedTables: TableObject[] = []

    for (const page of pageLayouts) {
      const rectangles = [...page.image.rectangles].sort((a, b) => {
        const rowTolerance = Math.max(4, Math.min(a.height, b.height) * 0.6)
        return Math.abs(a.y - b.y) <= rowTolerance ? a.x - b.x : a.y - b.y
      })

      for (const rectangle of rectangles) {
        const x = page.x + rectangle.x * page.scaleX
        const y = page.y + rectangle.y * page.scaleY
        const width = Math.max(6, rectangle.width * page.scaleX)
        const height = Math.max(6, rectangle.height * page.scaleY)
        const roomId = getRoomIdForPoint(currentRoom, {
          x: x + width / 2,
          y: y + height / 2,
        }) ?? defaultRoomId
        const nextNumber = nextNumberByRoom.get(roomId)
          ?? getNextLabelNumberForRoom(existingTables, roomId)
        nextNumberByRoom.set(roomId, nextNumber + 1)
        const label = `${roomId}-${nextNumber}`

        importedTables.push({
          id: createTableId(),
          roomId,
          tableNumber: nextNumber,
          displayId: label,
          x,
          y,
          width,
          height,
          rotation: rectangle.rotation,
          shape: 'rectangle',
          label,
          labelOverridden: false,
          rowId: null,
          sectionId: null,
          order: importedTables.length,
          premium: false,
        })
      }
    }

    if (importedTables.length > 0) {
      dispatch({
        type: 'PLACE_TABLES',
        tables: importedTables,
        timestamp: Date.now(),
      })
      setSelected(importedTables.map(table => table.id))
      setActiveTool('select')
    }

    onClose()
  }

  const selectedTableCount = pendingImages.reduce(
    (total, image) => total + image.rectangles.length,
    0,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-[960px] max-w-[96vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Set Up Floor Plan from PDF</h2>
            <p className="mt-1 text-sm text-slate-500">
              The app finds rectangular tables, then lets you correct the result before anything is added.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close floor plan import"
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div
            onDrop={event => {
              event.preventDefault()
              if (event.dataTransfer.files.length > 0) processFiles(event.dataTransfer.files)
            }}
            onDragOver={event => event.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/60 px-5 py-5 text-center transition-colors hover:border-blue-500 hover:bg-blue-50"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={event => {
                if (event.target.files?.length) processFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <p className="text-sm font-semibold text-blue-900">Drop the hotel PDF here or click to choose it</p>
            <p className="mt-1 text-xs text-blue-700">PDF, PNG, JPEG, or WebP up to 20 MB per file</p>
          </div>

          {loadingMessage && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              {loadingMessage}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {pendingImages.length > 0 && (
            <>
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Known table length
                  </label>
                  <div className="mt-2 flex gap-2">
                    {[
                      [72, '6 ft'],
                      [96, '8 ft'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTargetTableLength(value as number)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                          targetTableLength === value
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    This calibrates the PDF so one canvas unit equals one inch.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Background strength
                  </label>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="range"
                      min={0.1}
                      max={0.9}
                      step={0.05}
                      value={opacity}
                      onChange={event => setOpacity(Number(event.target.value))}
                      className="min-w-0 flex-1"
                    />
                    <span className="w-10 text-right text-sm font-semibold text-slate-700">
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    The imported plan is locked behind the editable tables.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Result
                  </label>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedTableCount}</p>
                  <p className="text-xs text-slate-500">
                    editable table{selectedTableCount === 1 ? '' : 's'} will be created
                  </p>
                </div>
              </div>

              {pendingImages.length > 1 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Page arrangement
                  </label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {([
                      ['side-by-side', 'Side by Side'],
                      ['stacked', 'Top to Bottom'],
                      ['separate', 'Separate Pages'],
                    ] as Array<[Arrangement, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setArrangement(value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                          arrangement === value
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {pendingImages.map((image, index) => (
                  <FloorplanPageReview
                    key={`${image.name}-${index}`}
                    image={image}
                    onChange={rectangles => updateRectangles(index, rectangles)}
                    onResetDetection={() => resetDetection(index)}
                    onRemovePage={() => removePage(index)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs text-slate-500">
            Green boxes were found automatically. Blue boxes were traced manually.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={pendingImages.length === 0 || Boolean(loadingMessage)}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedTableCount > 0
                ? `Import Plan + ${selectedTableCount} Tables`
                : 'Import Plan Only'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
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

async function renderImageFile(file: File): Promise<Omit<PendingImage, 'rectangles'>> {
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

async function renderPdfToImages(file: File): Promise<Array<Omit<PendingImage, 'rectangles'>>> {
  const pdfjsLib = await getPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const results: Array<Omit<PendingImage, 'rectangles'>> = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The browser could not render this PDF page.')

    await page.render({ canvasContext: context, viewport }).promise
    const rawDataUrl = canvas.toDataURL('image/png')
    const dataUrl = await compressImage(rawDataUrl, viewport.width, viewport.height)

    results.push({
      name: pdf.numPages > 1 ? `${file.name} - page ${pageNumber}` : file.name,
      dataUrl,
      naturalWidth: viewport.width,
      naturalHeight: viewport.height,
    })
  }

  return results
}

async function detectRectanglesInDataUrl(
  dataUrl: string,
  naturalWidth: number,
  naturalHeight: number,
): Promise<FloorplanRectangle[]> {
  const image = await loadImage(dataUrl)
  const analysisScale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * analysisScale))
  const height = Math.max(1, Math.round(image.naturalHeight * analysisScale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  context.drawImage(image, 0, 0, width, height)
  const detected = detectTableRectangles(context.getImageData(0, 0, width, height))
  const scaleX = naturalWidth / width
  const scaleY = naturalHeight / height

  return detected.map(rectangle => ({
    ...rectangle,
    x: rectangle.x * scaleX,
    y: rectangle.y * scaleY,
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
