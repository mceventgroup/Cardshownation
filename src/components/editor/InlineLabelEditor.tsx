'use client'

// ─────────────────────────────────────────────────────────────────────────────
// INLINE LABEL EDITOR
//
// HTML input overlay positioned on top of the Konva table being edited.
// Appears on double-click. Enter commits, Escape cancels, blur commits if changed.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'

interface InlineLabelEditorProps {
  tableId: string
  currentLabel: string
  position: { x: number; y: number; width: number; height: number }
  onCommit: (tableId: string, newLabel: string) => void
  onCancel: () => void
}

export default function InlineLabelEditor({
  tableId,
  currentLabel,
  position,
  onCommit,
  onCancel,
}: InlineLabelEditorProps) {
  const [value, setValue] = useState(currentLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  function handleCommit() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== currentLabel) {
      onCommit(tableId, trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); handleCommit() }
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        e.stopPropagation() // prevent canvas keyboard shortcuts
      }}
      onBlur={handleCommit}
      className="absolute z-20 border-2 border-blue-500 rounded px-1 text-center text-xs font-medium bg-white shadow-lg outline-none"
      style={{
        left: position.x,
        top: position.y,
        width: Math.max(60, position.width),
        height: position.height,
        lineHeight: `${position.height}px`,
      }}
    />
  )
}
