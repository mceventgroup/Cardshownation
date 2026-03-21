'use client'

import { useState } from 'react'
import DoorPropertiesPanel from './DoorPropertiesPanel'
import {
  useEditorStore,
  selectRoom,
  selectDoors,
  selectSettings,
} from '@/store/index'
import type { DoorSide } from '@/domain/types'
import { createDoorId } from '@/lib/id'
import { formatDimension } from '@/lib/units'
import { computeRoomBounds } from '@/domain/room-contour'

const DOOR_SIDES: { value: DoorSide; label: string }[] = [
  { value: 'top',    label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left',   label: 'Left' },
  { value: 'right',  label: 'Right' },
]

export default function DoorsPanel() {
  const room     = useEditorStore(selectRoom)
  const doors    = useEditorStore(selectDoors)
  const settings = useEditorStore(selectSettings)
  const dispatch = useEditorStore(s => s.dispatch)

  const doorList = Object.values(doors)
  const bounds = room ? computeRoomBounds(room) : null

  const [newDoorSide, setNewDoorSide]     = useState<DoorSide>('bottom')
  const [newDoorWidthFt, setNewDoorWidthFt] = useState(6)

  function handleAddDoor() {
    if (!bounds) return
    const doorWidth = newDoorWidthFt * 12
    const id = createDoorId()

    let x: number, y: number
    switch (newDoorSide) {
      case 'top':
      case 'bottom':
        x = bounds.x + Math.round((bounds.width - doorWidth) / 2)
        y = newDoorSide === 'top' ? bounds.y : bounds.y + bounds.height
        break
      case 'left':
      case 'right':
        x = newDoorSide === 'left' ? bounds.x : bounds.x + bounds.width
        y = bounds.y + Math.round((bounds.height - doorWidth) / 2)
        break
    }

    dispatch({
      type: 'PLACE_DOOR',
      door: { id, label: `Door ${doorList.length + 1}`, x, y, width: doorWidth, side: newDoorSide },
      timestamp: Date.now(),
    })
  }

  function handleDeleteDoor(doorId: string) {
    const door = doors[doorId]
    if (door) {
      dispatch({ type: 'DELETE_DOOR', door, timestamp: Date.now() })
    }
  }

  function handleDoorClearanceChange(value: string) {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0) return
    const inches = parsed * 12
    dispatch({
      type: 'UPDATE_SETTINGS',
      prev: { doorClearance: settings.doorClearance },
      next: { doorClearance: inches },
      timestamp: Date.now(),
    })
  }

  return (
    <div className="space-y-3 text-sm">
      {/* Selected door properties */}
      <DoorPropertiesPanel />

      <div className="px-3 pb-2 space-y-3">
      {/* Door clearance setting */}
      <div>
        <div className="font-medium text-gray-700 mb-1">Door Clearance</div>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={20} step={0.5}
            value={Math.round(settings.doorClearance / 12 * 10) / 10}
            onChange={e => handleDoorClearanceChange(e.target.value)}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <span className="text-xs text-gray-400">ft</span>
        </div>
      </div>

      {/* Add door — only when room exists */}
      {room ? (
        <div>
          <div className="font-medium text-gray-700 mb-1">Add Door</div>
          <div className="flex items-center gap-2">
            <select
              value={newDoorSide}
              onChange={e => setNewDoorSide(e.target.value as DoorSide)}
              className="flex-1 px-1.5 py-1 border border-gray-300 rounded text-xs"
            >
              {DOOR_SIDES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <input
              type="number" min={2} max={30} value={newDoorWidthFt}
              onChange={e => setNewDoorWidthFt(Number(e.target.value))}
              className="w-14 px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
            <span className="text-xs text-gray-400">ft</span>
          </div>
          <button
            onClick={handleAddDoor}
            className="mt-1.5 w-full px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            Add Door
          </button>
        </div>
      ) : (
        <div className="text-xs text-gray-400">Set a room first to add doors.</div>
      )}

      {/* Door list */}
      {doorList.length > 0 && (
        <div>
          <div className="font-medium text-gray-700 mb-1">Doors ({doorList.length})</div>
          <div className="space-y-1">
            {doorList.map(door => (
              <div key={door.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                <div>
                  <span className="text-xs font-medium">{door.label}</span>
                  <span className="text-xs text-gray-400 ml-1.5">
                    {door.side} &middot; {formatDimension(door.width)}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteDoor(door.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
