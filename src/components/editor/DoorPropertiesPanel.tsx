'use client'

import { useState, useEffect } from 'react'
import {
  useEditorStore,
  selectDoors,
  selectRoom,
  selectSelectedDoorId,
} from '@/store/index'
import type { DoorId, DoorKind } from '@/domain/types'
import { findBoundaryEdgeForDoor, getRoomBoundaryEdges } from '@/domain/room-contour'
import { formatDimension } from '@/lib/units'

export default function DoorPropertiesPanel() {
  const doors = useEditorStore(selectDoors)
  const room = useEditorStore(selectRoom)
  const selectedDoorId = useEditorStore(selectSelectedDoorId)
  const dispatch = useEditorStore(s => s.dispatch)
  const setSelectedDoor = useEditorStore(s => s.setSelectedDoor)

  const door = selectedDoorId ? doors[selectedDoorId] : null
  const boundaryEdge = room && door ? findBoundaryEdgeForDoor(door, getRoomBoundaryEdges(room)) : null

  // Local state for editing — in feet
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<DoorKind>('door')
  const [widthFt, setWidthFt] = useState(0)
  const [positionFt, setPositionFt] = useState(0)

  // Sync local state when selection changes
  useEffect(() => {
    if (!door || !boundaryEdge) return
    setLabel(door.label)
    setKind(door.kind)
    setWidthFt(Math.round(door.width / 12 * 10) / 10)
    if (door.side === 'top' || door.side === 'bottom') {
      const wallStart = Math.min(boundaryEdge.x1, boundaryEdge.x2)
      setPositionFt(Math.round((door.x - wallStart) / 12 * 10) / 10)
    } else {
      const wallStart = Math.min(boundaryEdge.y1, boundaryEdge.y2)
      setPositionFt(Math.round((door.y - wallStart) / 12 * 10) / 10)
    }
  }, [door, boundaryEdge])

  if (!door || !boundaryEdge) return null

  function applyChanges() {
    if (!door || !boundaryEdge) return
    const wallLength = door.side === 'top' || door.side === 'bottom'
      ? Math.abs(boundaryEdge.x2 - boundaryEdge.x1)
      : Math.abs(boundaryEdge.y2 - boundaryEdge.y1)
    const newWidth = Math.max(12, Math.min(wallLength, widthFt * 12))
    const newPos = Math.max(0, Math.min(wallLength - newWidth, positionFt * 12))

    let newX = door.x
    let newY = door.y

    if (door.side === 'top' || door.side === 'bottom') {
      newX = Math.min(boundaryEdge.x1, boundaryEdge.x2) + newPos
      newY = boundaryEdge.y1
    } else {
      newX = boundaryEdge.x1
      newY = Math.min(boundaryEdge.y1, boundaryEdge.y2) + newPos
    }

    if (newX !== door.x || newY !== door.y) {
      dispatch({
        type: 'MOVE_DOOR',
        doorId: door.id as DoorId,
        prev: { x: door.x, y: door.y, side: door.side },
        next: { x: newX, y: newY, side: door.side },
        timestamp: Date.now(),
      })
    }

    // Resize if width changed
    if (newWidth !== door.width) {
      dispatch({
        type: 'RESIZE_DOOR',
        doorId: door.id as DoorId,
        prevWidth: door.width,
        nextWidth: newWidth,
        timestamp: Date.now(),
      })
    }

    const trimmedLabel = label.trim() || (kind === 'entrance' ? 'Entrance' : 'Door')
    if (trimmedLabel !== door.label || kind !== door.kind) {
      dispatch({
        type: 'UPDATE_DOOR',
        doorId: door.id as DoorId,
        prev: { label: door.label, kind: door.kind },
        next: { label: trimmedLabel, kind },
        timestamp: Date.now(),
      })
    }
  }

  // Wall length for reference
  const wallLength = (door.side === 'top' || door.side === 'bottom')
    ? Math.abs(boundaryEdge.x2 - boundaryEdge.x1)
    : Math.abs(boundaryEdge.y2 - boundaryEdge.y1)

  return (
    <div className="px-3 py-2 space-y-2 text-sm border-t border-gray-200">
      <div className="flex items-center justify-between">
        <div className="font-medium text-gray-700">{door.label}</div>
        <button
          onClick={() => setSelectedDoor(null)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Deselect
        </button>
      </div>

      {/* Wall side */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-16">Type</label>
        <select
          value={kind}
          onChange={e => setKind(e.target.value as DoorKind)}
          className="flex-1 px-1.5 py-1 border border-gray-300 rounded text-xs"
        >
          <option value="door">Door</option>
          <option value="entrance">Entrance</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-16">Label</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="flex-1 px-1.5 py-1 border border-gray-300 rounded text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-16">Wall</label>
        <div className="flex-1 px-1.5 py-1 border border-gray-200 bg-gray-50 rounded text-xs text-gray-600 capitalize">
          {door.side}
        </div>
      </div>

      {/* Position from wall start */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-16">Position</label>
        <input
          type="number"
          min={0}
          max={Math.round((wallLength - door.width) / 12 * 10) / 10}
          step={0.5}
          value={positionFt}
          onChange={e => setPositionFt(Number(e.target.value))}
          className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
        />
        <span className="text-xs text-gray-400">ft from start</span>
      </div>

      {/* Width */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-16">Width</label>
        <input
          type="number"
          min={1}
          max={Math.round(wallLength / 12)}
          step={0.5}
          value={widthFt}
          onChange={e => setWidthFt(Number(e.target.value))}
          className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
        />
        <span className="text-xs text-gray-400">ft</span>
      </div>

      <div className="text-xs text-gray-400">
        Wall: {formatDimension(wallLength)}
      </div>

      <div className="flex gap-2">
        <button
          onClick={applyChanges}
          className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Apply
        </button>
        <button
          onClick={() => {
            dispatch({ type: 'DELETE_DOOR', door, timestamp: Date.now() })
            setSelectedDoor(null)
          }}
          className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
