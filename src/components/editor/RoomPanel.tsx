'use client'

import { useState } from 'react'
import {
  useEditorStore,
  selectRoom,
  selectSettings,
} from '@/store/index'
import type { CompositeRoom, RoomSegment, RoomSegmentId } from '@/domain/types'
import { createRoomSegmentId } from '@/lib/id'
import { formatDimension } from '@/lib/units'
import { computeRoomBounds } from '@/domain/room-contour'

export default function RoomPanel() {
  const room     = useEditorStore(selectRoom)
  const settings = useEditorStore(selectSettings)
  const dispatch = useEditorStore(s => s.dispatch)

  // Room dimension inputs (in feet for display, stored as inches)
  const [roomWidthFt, setRoomWidthFt]   = useState(80)
  const [roomHeightFt, setRoomHeightFt] = useState(60)

  // Segment editing
  const [editingSegId, setEditingSegId] = useState<string | null>(null)
  const [editW, setEditW] = useState(0)
  const [editH, setEditH] = useState(0)

  const bounds = room ? computeRoomBounds(room) : null

  function handleAddRectSegment() {
    const w = roomWidthFt * 12
    const h = roomHeightFt * 12
    let x: number, y: number
    if (room && room.segments.length > 0) {
      const b = computeRoomBounds(room)!
      x = b.x + b.width
      y = b.y
    } else {
      x = Math.round((settings.canvasWidth - w) / 2)
      y = Math.round((settings.canvasHeight - h) / 2)
    }

    const segment: RoomSegment = {
      id: createRoomSegmentId(),
      x, y, width: w, height: h,
    }

    dispatch({
      type: 'ADD_ROOM_SEGMENT',
      segment,
      prevRoom: room,
      timestamp: Date.now(),
    })

    // Expand canvas if the new segment extends beyond it
    const maxX = x + w
    const maxY = y + h
    const padding = Math.round(Math.max(w, h) * 0.2)
    const neededW = maxX + padding
    const neededH = maxY + padding
    if (neededW > settings.canvasWidth || neededH > settings.canvasHeight) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        prev: { canvasWidth: settings.canvasWidth, canvasHeight: settings.canvasHeight },
        next: {
          canvasWidth: Math.max(settings.canvasWidth, neededW),
          canvasHeight: Math.max(settings.canvasHeight, neededH),
        },
        timestamp: Date.now(),
      })
    }
  }

  function handleSetSingleRoom() {
    const w = roomWidthFt * 12
    const h = roomHeightFt * 12

    // Resize canvas to fit room with 20% padding on each side
    const padding = 0.2
    const canvasW = Math.round(w * (1 + padding * 2))
    const canvasH = Math.round(h * (1 + padding * 2))
    const x = Math.round(w * padding)
    const y = Math.round(h * padding)

    // Update canvas size to match room
    dispatch({
      type: 'UPDATE_SETTINGS',
      prev: { canvasWidth: settings.canvasWidth, canvasHeight: settings.canvasHeight },
      next: { canvasWidth: canvasW, canvasHeight: canvasH },
      timestamp: Date.now(),
    })

    const nextRoom: CompositeRoom = {
      segments: [{
        id: createRoomSegmentId(),
        x, y, width: w, height: h,
      }],
      freehandVertices: null,
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

  function handleDeleteSegment(seg: RoomSegment) {
    dispatch({
      type: 'DELETE_ROOM_SEGMENT',
      segment: seg,
      timestamp: Date.now(),
    })
  }

  function startEditSegment(seg: RoomSegment) {
    setEditingSegId(seg.id)
    setEditW(Math.round(seg.width / 12))
    setEditH(Math.round(seg.height / 12))
  }

  function commitEditSegment(seg: RoomSegment) {
    const newW = editW * 12
    const newH = editH * 12
    if (newW !== seg.width || newH !== seg.height) {
      dispatch({
        type: 'UPDATE_ROOM_SEGMENT',
        segmentId: seg.id as RoomSegmentId,
        prev: { x: seg.x, y: seg.y, width: seg.width, height: seg.height },
        next: { x: seg.x, y: seg.y, width: newW, height: newH },
        timestamp: Date.now(),
      })
    }
    setEditingSegId(null)
  }

  return (
    <div className="px-3 py-2 space-y-3 text-sm">
      {/* Room dimensions — add rectangle */}
      <div>
        <div className="font-medium text-gray-700 mb-1">Add Rectangle</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-8">W</label>
          <input
            type="number" min={10} max={500} value={roomWidthFt}
            onChange={e => setRoomWidthFt(Number(e.target.value))}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <label className="text-xs text-gray-500 w-8">D</label>
          <input
            type="number" min={10} max={500} value={roomHeightFt}
            onChange={e => setRoomHeightFt(Number(e.target.value))}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <span className="text-xs text-gray-400">ft</span>
        </div>
        <div className="flex gap-2 mt-1.5">
          {!room || room.segments.length === 0 ? (
            <button
              onClick={handleSetSingleRoom}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Set Room
            </button>
          ) : (
            <button
              onClick={handleAddRectSegment}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Segment
            </button>
          )}
          {room && (
            <button
              onClick={handleClearRoom}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Draw on canvas: <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-0.5">B</kbd> rectangle, <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-0.5">F</kbd> freehand
        </div>
      </div>

      {/* Segment list */}
      {room && room.segments.length > 0 && (
        <div>
          <div className="font-medium text-gray-700 mb-1">
            Segments ({room.segments.length})
          </div>
          <div className="space-y-1">
            {room.segments.map((seg, idx) => (
              <div key={seg.id} className="bg-gray-50 rounded px-2 py-1">
                {editingSegId === seg.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={5} max={500} value={editW}
                      onChange={e => setEditW(Number(e.target.value))}
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                    />
                    <span className="text-xs text-gray-400">x</span>
                    <input
                      type="number" min={5} max={500} value={editH}
                      onChange={e => setEditH(Number(e.target.value))}
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                    />
                    <span className="text-xs text-gray-400">ft</span>
                    <button
                      onClick={() => commitEditSegment(seg)}
                      className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingSegId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium">Rect {idx + 1}</span>
                      <span className="text-xs text-gray-400 ml-1.5">
                        {formatDimension(seg.width)} x {formatDimension(seg.height)}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEditSegment(seg)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSegment(seg)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {bounds && (
            <div className="text-xs text-gray-400 mt-1">
              Overall: {formatDimension(bounds.width)} x {formatDimension(bounds.height)}
            </div>
          )}
        </div>
      )}

      {/* Wall setback */}
      {room && (
        <div>
          <div className="font-medium text-gray-700 mb-1">Wall Setback</div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={30} step={0.5}
              value={Math.round(settings.wallSetback / 12 * 10) / 10}
              onChange={e => {
                const parsed = parseFloat(e.target.value)
                if (isNaN(parsed) || parsed < 0) return
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  prev: { wallSetback: settings.wallSetback },
                  next: { wallSetback: parsed * 12 },
                  timestamp: Date.now(),
                })
              }}
              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
            <span className="text-xs text-gray-400">ft</span>
            <label className="flex items-center gap-1 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showWallSetback}
                onChange={e => {
                  dispatch({
                    type: 'UPDATE_SETTINGS',
                    prev: { showWallSetback: settings.showWallSetback },
                    next: { showWallSetback: e.target.checked },
                    timestamp: Date.now(),
                  })
                }}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              <span className="text-xs text-gray-500">Show</span>
            </label>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Tables cannot be placed within this distance from walls.
          </div>
        </div>
      )}

      {/* Freehand polygon info */}
      {room && room.freehandVertices && (
        <div>
          <div className="font-medium text-gray-700 mb-1">Freehand Room</div>
          <div className="text-xs text-gray-500">
            {room.freehandVertices.length} vertices
            {bounds && <> &middot; {formatDimension(bounds.width)} x {formatDimension(bounds.height)}</>}
          </div>
        </div>
      )}
    </div>
  )
}
