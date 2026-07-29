'use client'

import { useRef, useState } from 'react'
import {
  getClickDropTableBounds,
  type FloorplanRectangle,
} from '@floorplanner/lib/floorplan-detection'

interface ReviewImage {
  name: string
  dataUrl: string
  naturalWidth: number
  naturalHeight: number
  rectangles: FloorplanRectangle[]
}

interface Props {
  image: ReviewImage
  onChange: (rectangles: FloorplanRectangle[]) => void
  onResetDetection: () => void
  onRemovePage: () => void
}

interface DraftRectangle {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

function normalizeDraft(draft: DraftRectangle): Omit<FloorplanRectangle, 'id' | 'rotation' | 'confidence' | 'source'> {
  return {
    x: Math.min(draft.startX, draft.currentX),
    y: Math.min(draft.startY, draft.currentY),
    width: Math.abs(draft.currentX - draft.startX),
    height: Math.abs(draft.currentY - draft.startY),
  }
}

export default function FloorplanPageReview({
  image,
  onChange,
  onResetDetection,
  onRemovePage,
}: Props) {
  const [draft, setDraft] = useState<DraftRectangle | null>(null)
  const nextManualId = useRef(1)

  function pointFromEvent(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(image.naturalWidth, (event.clientX - bounds.left) * image.naturalWidth / bounds.width)),
      y: Math.max(0, Math.min(image.naturalHeight, (event.clientY - bounds.top) * image.naturalHeight / bounds.height)),
    }
  }

  function startTrace(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const point = pointFromEvent(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraft({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    })
  }

  function moveTrace(event: React.PointerEvent<SVGSVGElement>) {
    if (!draft) return
    const point = pointFromEvent(event)
    setDraft(current => current ? { ...current, currentX: point.x, currentY: point.y } : null)
  }

  function finishTrace(event: React.PointerEvent<SVGSVGElement>) {
    if (!draft) return
    const point = pointFromEvent(event)
    const completedDraft = { ...draft, currentX: point.x, currentY: point.y }
    const rectangle = normalizeDraft(completedDraft)
    setDraft(null)

    const minimumSide = Math.max(4, Math.min(image.naturalWidth, image.naturalHeight) * 0.003)
    const pointerTravel = Math.hypot(
      completedDraft.currentX - completedDraft.startX,
      completedDraft.currentY - completedDraft.startY,
    )
    const bounds = pointerTravel < minimumSide * 2
      ? getClickDropTableBounds(
        image.rectangles,
        point,
        image.naturalWidth,
        image.naturalHeight,
        event.shiftKey,
      )
      : rectangle
    if (bounds.width < minimumSide || bounds.height < minimumSide) return

    onChange([
      ...image.rectangles,
      {
        ...bounds,
        id: `manual-${Date.now()}-${nextManualId.current++}`,
        rotation: 0,
        confidence: 1,
        source: 'manual',
      },
    ])
  }

  const normalizedDraft = draft ? normalizeDraft(draft) : null
  const automaticCount = image.rectangles.filter(rectangle => rectangle.source === 'auto').length
  const manualCount = image.rectangles.length - automaticCount

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{image.name}</p>
          <p className="text-xs text-slate-500">
            {image.rectangles.length} table{image.rectangles.length === 1 ? '' : 's'} selected
            {manualCount > 0 ? ` (${manualCount} added manually)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetDetection}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Detect Again
          </button>
          <button
            type="button"
            onClick={onRemovePage}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Remove Page
          </button>
        </div>
      </div>

      <div className="max-h-[390px] overflow-auto bg-slate-200 p-2">
        <svg
          viewBox={`0 0 ${image.naturalWidth} ${image.naturalHeight}`}
          aria-label={`Review detected tables on ${image.name}`}
          className="block w-full cursor-crosshair select-none bg-white shadow-sm"
          style={{ aspectRatio: `${image.naturalWidth} / ${image.naturalHeight}`, touchAction: 'none' }}
          onPointerDown={startTrace}
          onPointerMove={moveTrace}
          onPointerUp={finishTrace}
          onPointerCancel={() => setDraft(null)}
        >
          <image
            href={image.dataUrl}
            x={0}
            y={0}
            width={image.naturalWidth}
            height={image.naturalHeight}
            preserveAspectRatio="none"
          />

          {image.rectangles.map(rectangle => (
            <rect
              key={rectangle.id}
              x={rectangle.x}
              y={rectangle.y}
              width={rectangle.width}
              height={rectangle.height}
              fill={rectangle.source === 'manual' ? 'rgba(37, 99, 235, 0.24)' : 'rgba(16, 185, 129, 0.22)'}
              stroke={rectangle.source === 'manual' ? '#2563eb' : '#059669'}
              strokeWidth={Math.max(1.5, image.naturalWidth / 700)}
              transform={`rotate(${rectangle.rotation} ${rectangle.x} ${rectangle.y})`}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer"
              onPointerDown={event => {
                event.stopPropagation()
                onChange(image.rectangles.filter(candidate => candidate.id !== rectangle.id))
              }}
            />
          ))}

          {normalizedDraft && (
            <rect
              x={normalizedDraft.x}
              y={normalizedDraft.y}
              width={normalizedDraft.width}
              height={normalizedDraft.height}
              fill="rgba(37, 99, 235, 0.18)"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="7 5"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        <span>Click to drop a 6 ft × 24 in table. Shift-click for vertical. Drag for a custom size.</span>
        <span>{automaticCount} found automatically</span>
      </div>
    </section>
  )
}
