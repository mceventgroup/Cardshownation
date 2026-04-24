'use client'

import { useState, useEffect } from 'react'
import {
  useEditorStore,
  selectDoors,
  selectRoom,
  selectSelectedDoorId,
} from '@/store/index'
import type { DoorSide, DoorId } from '@/domain/types'
import { computeRoomBounds } from '@/domain/room-contour'
import { formatDimension } from '@/lib/units'

const SIDES: { value: DoorSide; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]

export default function DoorPropertiesPanel() {
  const doors = useEditorStore(selectDoors)
  const room = useEditorStore(selectRoom)
  const selectedDoorId = useEditorStore(selectSelectedDoorId)
  const dispatch = useEditorStore(s => s.dispatch)
  const setSelectedDoor = useEditorStore(s => s.setSelectedDoor)

  const door = selectedDoorId ? doors[selectedDoorId] : null
  const bounds = room ? computeRoomBounds(room) : null

  // Local state for editing — in feet
  const [widthFt, setWidthFt] = useState(0)
  const [positionFt, setPositionFt] = useState(0)
  const [side, setSide] = useState<DoorSide>('bottom')

  // Sync local state when selection changes
  useEffect(() => {
    if (!door || !bounds) return
    setWidthFt(Math.round(door.width / 12 * 10) / 10)
    setSide(door.side)
    // Position is distance from wall start to door start
    if (door.side === 'top' || door.side === 'bottom') {
      setPositionFt(Math.round((door.x - bounds.x) / 12 * 10) / 10)
    } else {
      setPositionFt(Math.round((door.y - bounds.y) / 12 * 10) / 10)
    }
  }, [door, bounds])

  if (!door || !bounds) return null

  function applyChanges() {
    if (!door || !bounds) return
    const newWidth = widthFt * 12
    const newPos = positionFt * 12

    let newX = door.x
    let newY = door.y

    if (side === 'top' || side === 'bottom') {
      newX = bounds.x + newPos
      newY = side === 'top' ? bounds.y : bounds.y + bounds.height
    } else {
      newX = side === 'left' ? bounds.x : bounds.x + bounds.width
      newY = bounds.y + newPos
    }

    // Move if position or side changed
    if (newX !== door.x || newY !== door.y || side !== door.side) {
      dispatch({
        type: 'MOVE_DOOR',
        doorId: door.id as DoorId,
        prev: { x: door.x, y: door.y, side: door.side },
        next: { x: newX, y: newY, side },
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
  }

  // Wall length for reference
  const wallLength = (side === 'top' || side === 'bottom')
    ? bounds.width
    : bounds.height

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
        <label className="text-xs text-gray-500 w-16">Wall</label>
        <select
          value={side}
          onChange={e => setSide(e.target.value as DoorSide)}
          className="flex-1 px-1.5 py-1 border border-gray-300 rounded text-xs"
        >
          {SIDES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
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
