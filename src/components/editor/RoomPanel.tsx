'use client'

import { useState } from 'react'
import {
  useEditorStore,
  selectRoom,
  selectDoors,
  selectSettings,
} from '@/store/index'
import type { Room, DoorSide } from '@/domain/types'
import { createDoorId } from '@/lib/id'
import { formatDimension } from '@/lib/units'

const DOOR_SIDES: { value: DoorSide; label: string }[] = [
  { value: 'top',    label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left',   label: 'Left' },
  { value: 'right',  label: 'Right' },
]

export default function RoomPanel() {
  const room     = useEditorStore(selectRoom)
  const doors    = useEditorStore(selectDoors)
  const settings = useEditorStore(selectSettings)
  const dispatch = useEditorStore(s => s.dispatch)

  const doorList = Object.values(doors)

  // Room dimension inputs (in feet for display, stored as inches)
  const [roomWidthFt, setRoomWidthFt]   = useState(room ? Math.round(room.width / 12) : 80)
  const [roomHeightFt, setRoomHeightFt] = useState(room ? Math.round(room.height / 12) : 60)

  // New door state
  const [newDoorSide, setNewDoorSide]     = useState<DoorSide>('bottom')
  const [newDoorWidthFt, setNewDoorWidthFt] = useState(6) // 6ft default door

  function handleSetRoom() {
    const w = roomWidthFt * 12
    const h = roomHeightFt * 12
    // Center the room on the canvas
    const nextRoom: Room = {
      x: Math.round((settings.canvasWidth - w) / 2),
      y: Math.round((settings.canvasHeight - h) / 2),
      width: w,
      height: h,
    }
    dispatch({
      type: 'SET_ROOM',
      prevRoom: room,
      nextRoom,
      timestamp: Date.now(),
    })
  }

  function handleClearRoom() {
    dispatch({
      type: 'SET_ROOM',
      prevRoom: room,
      nextRoom: null,
      timestamp: Date.now(),
    })
  }

  function handleAddDoor() {
    if (!room) return
    const doorWidth = newDoorWidthFt * 12
    const id = createDoorId()

    // Place door at the midpoint of the chosen wall
    let x: number, y: number
    switch (newDoorSide) {
      case 'top':
      case 'bottom':
        x = room.x + Math.round((room.width - doorWidth) / 2)
        y = newDoorSide === 'top' ? room.y : room.y + room.height
        break
      case 'left':
      case 'right':
        x = newDoorSide === 'left' ? room.x : room.x + room.width
        y = room.y + Math.round((room.height - doorWidth) / 2)
        break
    }

    dispatch({
      type: 'PLACE_DOOR',
      door: {
        id,
        label: `Door ${doorList.length + 1}`,
        x,
        y,
        width: doorWidth,
        side: newDoorSide,
      },
      timestamp: Date.now(),
    })
  }

  function handleDeleteDoor(doorId: string) {
    const door = doors[doorId]
    if (door) {
      dispatch({
        type: 'DELETE_DOOR',
        door,
        timestamp: Date.now(),
      })
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
    <div className="px-3 py-2 space-y-3 text-sm">
      {/* Room dimensions */}
      <div>
        <div className="font-medium text-gray-700 mb-1">Room Size</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-8">W</label>
          <input
            type="number"
            min={10}
            max={500}
            value={roomWidthFt}
            onChange={e => setRoomWidthFt(Number(e.target.value))}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <label className="text-xs text-gray-500 w-8">D</label>
          <input
            type="number"
            min={10}
            max={500}
            value={roomHeightFt}
            onChange={e => setRoomHeightFt(Number(e.target.value))}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <span className="text-xs text-gray-400">ft</span>
        </div>
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={handleSetRoom}
            className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {room ? 'Update Room' : 'Set Room'}
          </button>
          {room && (
            <button
              onClick={handleClearRoom}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>
        {room && (
          <div className="text-xs text-gray-400 mt-1">
            {formatDimension(room.width)} x {formatDimension(room.height)}
          </div>
        )}
      </div>

      {/* Door clearance setting */}
      <div>
        <div className="font-medium text-gray-700 mb-1">Door Clearance</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={20}
            step={0.5}
            value={Math.round(settings.doorClearance / 12 * 10) / 10}
            onChange={e => handleDoorClearanceChange(e.target.value)}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <span className="text-xs text-gray-400">ft</span>
        </div>
      </div>

      {/* Add door */}
      {room && (
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
              type="number"
              min={2}
              max={30}
              value={newDoorWidthFt}
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
      )}

      {/* Door list */}
      {doorList.length > 0 && (
        <div>
          <div className="font-medium text-gray-700 mb-1">Doors</div>
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
  )
}
