'use client'
// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE LAYER
//
// Renders floor plan reference images behind all other canvas layers.
// Each image is a Konva Image node. Images can be dragged unless locked.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react'
import { Layer, Image as KonvaImage } from 'react-konva'
import type { BackgroundImage, BackgroundImageId } from '@/domain/types'

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
    <KonvaImage
      image={htmlImage}
      x={bgImage.x}
      y={bgImage.y}
      width={bgImage.width}
      height={bgImage.height}
      opacity={bgImage.opacity}
      draggable={!bgImage.locked}
      onDragEnd={e => {
        onDragEnd(bgImage.id, e.target.x(), e.target.y())
      }}
    />
  )
}
