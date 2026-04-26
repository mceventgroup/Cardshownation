'use client'

import { useState } from 'react'
import DoorPropertiesPanel from './DoorPropertiesPanel'
import {
  useEditorStore,
  selectRoom,
  selectDoors,
  selectSettings,
  selectActiveTool,
} from '@/store/index'
import { formatDimension } from '@/lib/units'

export default function DoorsPanel() {
  const room        = useEditorStore(selectRoom)
  const doors       = useEditorStore(selectDoors)
  const settings    = useEditorStore(selectSettings)
  const activeTool  = useEditorStore(selectActiveTool)
  const dispatch    = useEditorStore(s => s.dispatch)
  const setActiveTool = useEditorStore(s => s.setActiveTool)
  const setDoorPlacementConfig = useEditorStore(s => s.setDoorPlacementConfig)

  const doorList = Object.values(doors)

  const [newDoorWidthFt, setNewDoorWidthFt] = useState(6)

  const placing = activeTool === 'place-door'

  function handleStartPlacing() {
    setDoorPlacementConfig({ widthIn: newDoorWidthFt * 12 })
    setActiveTool('place-door')
  }

  function handleCancelPlacing() {
    setActiveTool('select')
    setDoorPlacementConfig(null)
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
            <label className="text-xs text-gray-500">Width</label>
            <input
              type="number" min={2} max={30} value={newDoorWidthFt}
              onChange={e => setNewDoorWidthFt(Number(e.target.value))}
              disabled={placing}
              className="w-14 px-1.5 py-1 border border-gray-300 rounded text-xs disabled:bg-gray-100"
            />
            <span className="text-xs text-gray-400">ft</span>
          </div>
          {placing ? (
            <>
              <div className="mt-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                Move onto the canvas to preview the snapped door. Click anywhere inside or around the room to place it. Esc to cancel.
              </div>
              <button
                onClick={handleCancelPlacing}
                className="mt-1.5 w-full px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleStartPlacing}
              className="mt-1.5 w-full px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Place Door
            </button>
          )}
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
