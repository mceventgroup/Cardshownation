'use client'
// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE LAYER
//
// Renders floor plan reference images behind all other canvas layers.
// Each image is a Konva Image node. Images can be dragged unless locked.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react'
import { Layer, Group, Line, Image as KonvaImage } from 'react-konva/lib/ReactKonvaCore'
import { openingLines, planPoint } from '@floorplanner/lib/plan-editing'
import { structurePolygon } from '@floorplanner/lib/plan-structure'
import type { BackgroundImage, BackgroundImageId } from '@floorplanner/domain/types'

interface Props {
  images: BackgroundImage[]
  onDragEnd: (id: BackgroundImageId, x: number, y: number) => void
}

export default function BackgroundImageLayer({ images, onDragEnd }: Props) {
  const sortedImages = [...images].sort((a, b) => a.order - b.order)

  return (
    <Layer listening={true}>
      {sortedImages.map(img =>
        img.visible ? (
          <BGImageNode key={img.id} bgImage={img} onDragEnd={onDragEnd} />
        ) : null
      )}
    </Layer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL IMAGE NODE
// Loads the HTMLImageElement from the data URL and renders it via Konva.
// ─────────────────────────────────────────────────────────────────────────────

function BGImageNode({
  bgImage,
  onDragEnd,
}: {
  bgImage: BackgroundImage
  onDragEnd: (id: BackgroundImageId, x: number, y: number) => void
}) {
  const [htmlImage, setHtmlImage] = useState<HTMLImageElement | null>(null)
  const dataUrlRef = useRef(bgImage.dataUrl)

  useEffect(() => {
    // Only reload if the dataUrl actually changed
    if (dataUrlRef.current !== bgImage.dataUrl || !htmlImage) {
      dataUrlRef.current = bgImage.dataUrl
      const img = new window.Image()
      img.onload = () => setHtmlImage(img)
      img.src = bgImage.dataUrl
    }
  }, [bgImage.dataUrl, htmlImage])

  if (!htmlImage) return null

  return (
    <Group x={bgImage.x} y={bgImage.y} draggable={!bgImage.locked} onDragEnd={e => onDragEnd(bgImage.id, e.target.x(), e.target.y())}>
    <KonvaImage
      image={htmlImage}
      x={0}
      y={0}
      width={bgImage.width}
      height={bgImage.height}
      opacity={bgImage.opacity}
    />
    {bgImage.plan?.structures.map(s => <Line key={s.id} points={structurePolygon({ ...bgImage, x: 0, y: 0 }, s).flatMap(p => [p.x, p.y])} closed fill={s.kind === 'wall' ? '#334155' : '#92400e'} stroke={s.kind === 'wall' ? '#0f172a' : '#78350f'} strokeWidth={1} listening={false} />)}
    {bgImage.plan?.openings?.flatMap(o => openingLines(o).map((line, i) => <Line key={o.id + i} points={line.map(p => planPoint({ ...bgImage, x: 0, y: 0 }, p)).flatMap(p => [p.x, p.y])} stroke={o.kind === 'exit' ? '#dc2626' : '#2563eb'} strokeWidth={2} listening={false} />))}
    </Group>
  )
}
