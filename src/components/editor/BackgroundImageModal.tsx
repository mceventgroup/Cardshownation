'use client'
// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE MODAL
//
// Upload one or more floor plan images to use as a reference layer behind
// tables. Supports multiple images that can be positioned side-by-side
// (e.g. two halves of a hotel ballroom).
//
// Flow:
//   1. Upload images (file picker or drag-drop)
//   2. Set positioning: side-by-side or stacked
//   3. Adjust opacity and confirm
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react'
import NextImage from 'next/image'
import { useEditorStore } from '@/store'
import { createBackgroundImageId } from '@/lib/id'
import type { BackgroundImage } from '@/domain/types'
// pdfjs-dist is loaded dynamically to avoid SSR issues
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

type Arrangement = 'side-by-side' | 'stacked' | 'manual'

interface PendingImage {
  name: string
  dataUrl: string
  naturalWidth: number
  naturalHeight: number
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB per file (PDFs can be larger)
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export default function BackgroundImageModal({ onClose }: Props) {
  const addBackgroundImage = useEditorStore(s => s.addBackgroundImage)
  const settings = useEditorStore(s => s.settings)

  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [arrangement, setArrangement] = useState<Arrangement>('side-by-side')
  const [opacity, setOpacity] = useState(0.7)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError('')
    setLoading(true)
    const results: PendingImage[] = []

    for (const file of Array.from(files)) {
      // Allow PDF or common image types; also accept empty type for drag-drop PDFs
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf && !ALLOWED_TYPES.includes(file.type)) {
        setError(`Unsupported file type: ${file.name}. Use PNG, JPEG, WebP, or PDF.`)
        setLoading(false)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large: ${file.name}. Max 20 MB per file.`)
        setLoading(false)
        return
      }

      if (isPdf) {
        const pdfImages = await renderPdfToImages(file)
        results.push(...pdfImages)
      } else {
        const rawDataUrl = await readFileAsDataUrl(file)
        const { width, height } = await loadImageDimensions(rawDataUrl)
        const dataUrl = await compressImage(rawDataUrl, width, height)
        results.push({ name: file.name, dataUrl, naturalWidth: width, naturalHeight: height })
      }
    }

    setPendingImages(prev => [...prev, ...results])
    setLoading(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  function removePending(index: number) {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }

  function handleImport() {
    if (pendingImages.length === 0) return

    // Compute positions based on arrangement
    const canvasW = settings.canvasWidth
    const canvasH = settings.canvasHeight
    const existingCount = Object.keys(useEditorStore.getState().backgroundImages).length

    let xOffset = 0
    let yOffset = 0

    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i]

      // Scale image to fit within canvas while preserving aspect ratio
      const aspect = img.naturalWidth / img.naturalHeight
      let displayW: number
      let displayH: number

      if (arrangement === 'side-by-side' && pendingImages.length > 1) {
        // Split canvas width among images
        displayW = canvasW / pendingImages.length
        displayH = displayW / aspect
        xOffset = displayW * i
        yOffset = 0
      } else if (arrangement === 'stacked' && pendingImages.length > 1) {
        // Stack vertically
        displayH = canvasH / pendingImages.length
        displayW = displayH * aspect
        xOffset = 0
        yOffset = displayH * i
      } else {
        // Manual or single image — fit to canvas
        const scaleW = canvasW / img.naturalWidth
        const scaleH = canvasH / img.naturalHeight
        const scale = Math.min(scaleW, scaleH, 1)
        displayW = img.naturalWidth * scale
        displayH = img.naturalHeight * scale
        xOffset = 0
        yOffset = 0
      }

      const bgImage: BackgroundImage = {
        id: createBackgroundImageId(),
        name: img.name,
        dataUrl: img.dataUrl,
        x: xOffset,
        y: yOffset,
        width: displayW,
        height: displayH,
        opacity,
        locked: false,
        visible: true,
        order: existingCount + i,
      }
      addBackgroundImage(bgImage)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">Import Floor Plan Images</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files?.length) processFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <div className="text-gray-500 text-sm">
              <p className="font-medium">Drop floor plan images or PDFs here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse. PNG, JPEG, WebP, or PDF up to 20 MB each.</p>
            </div>
          </div>

          {loading && <p className="text-sm text-blue-600">Loading image...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Preview of pending images */}
          {pendingImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {pendingImages.length} image{pendingImages.length > 1 ? 's' : ''} ready
              </p>
              {pendingImages.map((img, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <NextImage
                    src={img.dataUrl}
                    alt={img.name}
                    width={64}
                    height={48}
                    unoptimized
                    className="w-16 h-12 object-cover rounded border border-gray-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{img.name}</p>
                    <p className="text-xs text-gray-400">{img.naturalWidth} x {img.naturalHeight} px</p>
                  </div>
                  <button
                    onClick={() => removePending(i)}
                    className="text-gray-400 hover:text-red-500 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Arrangement (only if >1 image) */}
          {pendingImages.length > 1 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
                Arrangement
              </label>
              <p className="text-xs text-gray-400 mb-2">
                These images are connected in real life. Choose how to place them:
              </p>
              <div className="flex gap-2">
                {([
                  ['side-by-side', 'Side by Side (left-right)'],
                  ['stacked', 'Stacked (top-bottom)'],
                  ['manual', 'Separate (position later)'],
                ] as [Arrangement, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setArrangement(val)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      arrangement === val
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opacity slider */}
          {pendingImages.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                Opacity: {Math.round(opacity * 100)}%
              </label>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={opacity}
                onChange={e => setOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-400">
                Lower opacity makes it easier to see tables on top of the image.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={pendingImages.length === 0}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Import {pendingImages.length > 0 ? `${pendingImages.length} Image${pendingImages.length > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

const PDF_RENDER_SCALE = 2 // Render PDF pages at 2x for clarity
const MAX_DIM = 2048
const JPEG_QUALITY = 0.7

/** Render all pages of a PDF file to images. */
async function renderPdfToImages(file: File): Promise<PendingImage[]> {
  const pdfjsLib = await getPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const results: PendingImage[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise

    const natW = viewport.width
    const natH = viewport.height
    // Compress the rendered page
    const rawDataUrl = canvas.toDataURL('image/png')
    const dataUrl = await compressImage(rawDataUrl, natW, natH)

    const pageName = pdf.numPages > 1
      ? `${file.name} (page ${pageNum})`
      : file.name

    results.push({ name: pageName, dataUrl, naturalWidth: natW, naturalHeight: natH })
  }

  return results
}

/** Resize image to fit within MAX_DIM and re-encode as JPEG to save localStorage space. */
function compressImage(dataUrl: string, natW: number, natH: number): Promise<string> {
  return new Promise((resolve) => {
    // Skip compression if already small
    if (natW <= MAX_DIM && natH <= MAX_DIM && dataUrl.length < 200_000) {
      resolve(dataUrl)
      return
    }

    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / natW, MAX_DIM / natH)
      const w = Math.round(natW * scale)
      const h = Math.round(natH * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => resolve(dataUrl) // fallback to original
    img.src = dataUrl
  })
}
