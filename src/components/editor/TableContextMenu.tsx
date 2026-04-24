'use client'

import { useEffect, useRef } from 'react'

export interface ContextMenuAction {
  label: string
  action: () => void
  danger?: boolean
  disabled?: boolean
}

interface Props {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

export default function TableContextMenu({ x, y, actions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Keep menu within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 100,
  }

  return (
    <div ref={ref} style={style} className="bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]">
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => { a.action(); onClose() }}
          disabled={a.disabled}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            a.disabled
              ? 'text-gray-300 cursor-default'
              : a.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
