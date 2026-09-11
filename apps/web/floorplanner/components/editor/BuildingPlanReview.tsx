'use client'
import { useRef, useState } from 'react'
import type { PlanStructure, PlanReviewMetadata, Point } from '@floorplanner/domain/types'
import { connectedRooms, joinWalls, openingLines, polygonArea, referenceError, snapPlanPoint, splitWall, validRoom, wallEnds, wallFromEnds } from '@floorplanner/lib/plan-editing'
import { parsePlanDimension, scaleFromReference } from '@floorplanner/lib/plan-structure'

export interface ReviewImage extends PlanReviewMetadata {
  name: string; dataUrl: string; naturalWidth: number; naturalHeight: number
  structures: PlanStructure[]; inchesPerPixel?: number; dimensionLabels?: string[]
  detectionArea?: { x: number; y: number; width: number; height: number }
  contrast?: 'standard' | 'faint'
}
export default function BuildingPlanReview({ image, onChange, onResetDetection, onRemovePage, disabled = false }: {
  image: ReviewImage; onChange: (image: ReviewImage) => void; onResetDetection: () => void; onRemovePage: () => void; disabled?: boolean
}) {
  const [tool, setTool] = useState<'scale' | 'wall' | 'pillar' | 'remove' | 'edit' | 'area' | 'pan' | 'room'>(image.inchesPerPixel ? 'edit' : 'scale')
  const [selectedId, setSelectedId] = useState('')
  const [past, setPast] = useState<ReviewImage[]>([]), [future, setFuture] = useState<ReviewImage[]>([])
  const viewport = useRef<HTMLDivElement>(null)
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  function remember() { setPast(history => [...history.slice(-29), image]); setFuture([]) }
  function change(next: ReviewImage) { remember(); onChange(next) }
  function undo() { const prior = past.at(-1); if (!prior) return; setPast(past.slice(0, -1)); setFuture([image, ...future]); onChange(prior) }
  function redo() { const next = future[0]; if (!next) return; setFuture(future.slice(1)); setPast([...past, image]); onChange(next) }
  const selected = image.structures.find(s => s.id === selectedId)
  function edit(updates: Partial<PlanStructure>) { if (selected) change({ ...image, rejected: reject([selected]), structures: image.structures.map(s => s.id === selected.id ? { ...s, ...updates, source: 'manual' } : s) }) }
  const [points, setPoints] = useState<Point[]>(image.calibration ? [image.calibration.start, image.calibration.end] : [])
  const [roomPoints, setRoomPoints] = useState<Point[]>([])
  const [roundPillar, setRoundPillar] = useState(false), [snap, setSnap] = useState(true)
  const [joinId, setJoinId] = useState(''), [openingWidth, setOpeningWidth] = useState(36), [openingPosition, setOpeningPosition] = useState(50)
  const [openingKind, setOpeningKind] = useState<'door' | 'exit' | 'opening'>('door')
  const [swing, setSwing] = useState<'left' | 'right'>('left')
  const endpoint = useRef<0 | 1 | null>(null)
  const tolerance = Math.max(4, image.naturalWidth / 100)
  function reject(items: PlanStructure[]) { return [...(image.rejected || []), ...items].slice(-4000) }
  function removeMark(item: PlanStructure) { change({ ...image, rejected: reject([item]), structures: image.structures.filter(s => s.id !== item.id) }) }
  const [distance, setDistance] = useState(''), [unit, setUnit] = useState('ft')
  const [thickness, setThickness] = useState(6), [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const draft = useRef<Point | null>(null), [end, setEnd] = useState<Point | null>(null)
  const button = 'rounded-lg border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40'
  function point(e: React.PointerEvent<SVGSVGElement>): Point {
    const b = e.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(image.naturalWidth, (e.clientX - b.left) / b.width * image.naturalWidth)), y: Math.max(0, Math.min(image.naturalHeight, (e.clientY - b.top) / b.height * image.naturalHeight)) }
  }
  function finish(e: React.PointerEvent<SVGSVGElement>) {
    if (disabled) return
    if (panStart.current) { panStart.current = null; return }
    const raw = point(e), p = snap && (tool === 'wall' || tool === 'room' || endpoint.current !== null) ? snapPlanPoint(raw, image.structures, tolerance, endpoint.current !== null ? selectedId : undefined) : raw, start = draft.current
    if (endpoint.current !== null && selected) { const ends = wallEnds(selected); ends[endpoint.current] = p; endpoint.current = null; draft.current = null; setEnd(null); if (Math.hypot(ends[0].x - ends[1].x, ends[0].y - ends[1].y) >= 3) edit(wallFromEnds(selected, ends[0], ends[1])); return }
    draft.current = null; setEnd(null)
    if (!start) return
    if (tool === 'room') { setRoomPoints(current => [...current, p]); return }
    if (tool === 'scale') { setPoints(current => current.length === 1 ? [current[0], p] : [p]); return }
    if (!start || tool === 'remove' || tool === 'edit' || tool === 'pan' || Math.hypot(p.x - start.x, p.y - start.y) < 3) return
    if (tool === 'area') {
      const area = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) }
      if (area.width >= 20 && area.height >= 20) change({ ...image, detectionArea: area })
      else setError('Select an area at least 20 pixels wide and tall.')
      return
    }
    const common = { id: crypto.randomUUID(), source: 'manual' as const }
    const item: PlanStructure = tool === 'wall'
      ? wallFromEnds({ ...common, kind: 'wall', x: 0, y: 0, width: 100000, height: image.inchesPerPixel ? thickness / image.inchesPerPixel : 4, rotation: 0 }, start, p)
      : { ...common, kind: 'pillar', shape: roundPillar ? 'ellipse' : 'rectangle', x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y), rotation: 0 }
    if (item.width > 0 && item.height > 0) change({ ...image, structures: [...image.structures, item] })
  }
  function applyScale() {
    try {
      if (points.length !== 2) throw new Error('Select both endpoints of a known distance.')
      const inches = parsePlanDimension(distance) ?? parsePlanDimension(`${distance} ${unit}`)
      if (!inches) throw new Error('Enter a positive distance.')
      change({ ...image, inchesPerPixel: scaleFromReference(points[0], points[1], inches), calibration: { start: points[0], end: points[1], inches }, verification: undefined }); setError(''); setTool('wall')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not set scale.') }
  }
  function verifyScale() {
    try { const inches = parsePlanDimension(distance) ?? parsePlanDimension(distance + ' ' + unit); if (!inches || points.length !== 2 || !image.inchesPerPixel) throw new Error('Select a second known distance and enter its size.'); scaleFromReference(points[0], points[1], inches); if (image.calibration && Math.abs((points[1].x - points[0].x) * (image.calibration.end.y - image.calibration.start.y) - (points[1].y - points[0].y) * (image.calibration.end.x - image.calibration.start.x)) < 1) throw new Error('Use a reference in a different direction to check scan distortion.'); change({ ...image, verification: { start: points[0], end: points[1], inches } }); setError('') } catch(e) { setError((e as Error).message) }
  }
  function saveRoom(vertices: Point[]) {
    if (!validRoom(vertices)) { setError('Trace at least three corners without crossing edges.'); return }
    change({ ...image, rooms: [...(image.rooms || []), { id: crypto.randomUUID(), label: 'Room ' + ((image.rooms?.length || 0) + 1), vertices }] }); setRoomPoints([]); setError('')
  }
  function cutOpening() {
    if (!selected || !image.inchesPerPixel) return
    try {
      const pieces = splitWall(selected, openingPosition / 100, openingWidth / image.inchesPerPixel)
      const start = wallEnds(pieces[0])[1], end = wallEnds(pieces[1])[0]
      change({ ...image, rejected: reject([selected]), structures: image.structures.flatMap(s => s.id === selected.id ? pieces : [s]), openings: [...(image.openings || []), { id: crypto.randomUUID(), kind: openingKind, start, end, swing }] }); setError('')
    } catch(e) { setError((e as Error).message) }
  }
  return <section inert={disabled} className="overflow-hidden rounded-xl border bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-3 lg:col-span-2"><div><h3 className="font-semibold">{image.name}</h3><p className="text-xs text-slate-600">{image.structures.filter(s => s.kind === 'wall').length} walls · {image.structures.filter(s => s.kind === 'pillar').length} pillars · {image.inchesPerPixel ? 'Scale confirmed' : 'Set scale before importing'}</p></div><button disabled={disabled} className={button} onClick={onRemovePage}>Remove page</button></div>
    <div className="space-y-3 p-3 lg:col-start-2 lg:row-start-2 lg:max-h-[65dvh] lg:overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={disabled || !past.length} onClick={undo}>Undo review change</button>
        <button className={button} disabled={disabled || !future.length} onClick={redo}>Redo review change</button>
        <label className="ml-auto text-xs">Drawing contrast <select disabled={disabled} value={image.contrast || 'standard'} onChange={e => change({ ...image, contrast: e.target.value as 'standard' | 'faint' })} className="rounded border p-2"><option value="standard">Standard linework</option><option value="faint">Faint / gray scan</option></select></label>
      </div>
      <div className="flex flex-wrap gap-2">{(['scale', 'wall', 'pillar', 'edit', 'room', 'remove', 'area', 'pan'] as const).map(t => <button key={t} disabled={disabled} aria-pressed={tool === t} onClick={() => { setTool(t); draft.current = null; setEnd(null) }} className={`${button} ${tool === t ? 'border-blue-600 text-blue-700 ring-1 ring-blue-600' : ''}`}>{({ scale: 'Set scale', wall: 'Trace wall', pillar: 'Trace pillar', remove: 'Remove marks', edit: 'Edit mark', area: 'Detection area', pan: 'Pan', room: 'Room boundary' })[t]}</button>)}<button disabled={disabled} className={button} onClick={() => { remember(); onResetDetection() }}>Detect walls &amp; pillars again</button><button disabled={disabled} className={button} onClick={() => change({ ...image, rejected: reject(image.structures), structures: [] })}>Clear marks</button></div>
      {tool === 'scale' && <div className="space-y-2 rounded-xl bg-blue-50 p-3">
        <p className="text-sm">Click two endpoints of a wall, dimension line, or known distance. Enter its real size, then apply scale.</p>
        {!!image.dimensionLabels?.length && <label className="block text-sm">Dimensions found in PDF<select disabled={disabled} aria-label={`Dimension label for ${image.name}`} defaultValue="" onChange={e => { const inches = parsePlanDimension(e.target.value); if (inches) { setDistance(String(inches)); setUnit('in') } }} className="ml-2 rounded border p-2"><option value="">Choose a printed measurement</option>{image.dimensionLabels.map(label => <option key={label}>{label}</option>)}</select></label>}
        <div className="flex flex-wrap items-center gap-2"><label className="text-sm">Known distance <input disabled={disabled} aria-label={`Known distance for ${image.name}`} type="text" placeholder="40 ft or 40.5" value={distance} onChange={e => setDistance(e.target.value)} className="w-28 rounded border p-2" /></label><select disabled={disabled} aria-label={`Distance unit for ${image.name}`} value={unit} onChange={e => setUnit(e.target.value)} className="rounded border p-2">{['ft', 'in', 'm', 'cm', 'mm'].map(u => <option key={u}>{u}</option>)}</select><button disabled={disabled || points.length !== 2} className={button} onClick={applyScale}>Apply scale</button><button disabled={disabled || points.length !== 2 || !image.inchesPerPixel} className={button} onClick={verifyScale}>Verify second distance</button><span className="text-xs">{points.length}/2 endpoints selected</span></div>
        <p className="text-xs text-slate-600">Each page has its own scale. Confirm the matching endpoints for PDF labels. On scans, type the measurement.</p>
        {points.length === 2 && image.inchesPerPixel && <p className="text-sm font-semibold text-blue-800">At the current scale, this span measures {(Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) * image.inchesPerPixel / 12).toFixed(2)} ft. Use another known distance to check the scale.</p>}
      </div>}
      {tool === 'wall' && <label className="block text-sm">Wall thickness (inches) <input disabled={disabled} aria-label="Wall trace thickness" type="number" min="1" max="120" value={thickness} onChange={e => setThickness(Math.max(1, Math.min(120, Number(e.target.value))))} className="w-20 rounded border p-2" /> <span className="text-xs">Drag along a wall centerline, including diagonals.</span></label>}
      {tool === 'pillar' && <label className="text-sm"><input type="checkbox" checked={roundPillar} onChange={e => setRoundPillar(e.target.checked)} /> Round / oval pillar. Drag its footprint.</label>}
      {(tool === 'wall' || tool === 'room' || tool === 'edit') && <label className="text-xs"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Snap to wall endpoints</label>}
      {tool === 'room' && <div className="space-y-2 text-sm"><p>Click each inside corner, then close the boundary. This creates a room for placement and numbering.</p><button disabled={disabled || roomPoints.length < 3} className={button} onClick={() => saveRoom(roomPoints)}>Close room boundary</button> <button className={button} onClick={() => setRoomPoints([])}>Restart boundary</button> <button disabled={disabled} className={button} onClick={() => { const found = connectedRooms(image.structures, tolerance); if (!found.length) { setError('No unambiguous closed wall loops. Snap endpoints together or trace the inside boundary.'); return } change({ ...image, rooms: [...(image.rooms || []), ...found.filter(vertices => !(image.rooms || []).some(r => Math.abs(polygonArea(r.vertices) - polygonArea(vertices)) < 1 && Math.hypot(r.vertices[0].x - vertices[0].x, r.vertices[0].y - vertices[0].y) < tolerance)).map((vertices, i) => ({ id: crypto.randomUUID(), label: 'Room ' + ((image.rooms?.length || 0) + i + 1), vertices }))] }); setError('') }}>Build rooms from connected walls</button>
      {(image.rooms || []).map(r => <div key={r.id} className="flex gap-2"><input aria-label="Room name" value={r.label} onChange={e => change({ ...image, rooms: image.rooms!.map(room => room.id === r.id ? { ...room, label: e.target.value } : room) })} className="w-32 rounded border p-1" /><span>{image.inchesPerPixel ? (polygonArea(r.vertices) * image.inchesPerPixel ** 2 / 144).toFixed(0) + ' sq ft boundary area' : 'Set scale for area'}</span><button className={button} onClick={() => change({ ...image, rooms: image.rooms!.filter(room => room.id !== r.id) })}>Remove room</button></div>)}</div>}
      {tool === 'remove' && <p className="text-sm">Click an incorrect mark to remove it.</p>}
      {tool === 'area' && <div className="flex items-center gap-3 text-sm"><p>Drag around the room to exclude title blocks and page borders, then run detection again.</p>{image.detectionArea && <button className={button} disabled={disabled} onClick={() => change({ ...image, detectionArea: undefined })}>Use whole page</button>}</div>}
      {tool === 'pan' && <p className="text-sm">Drag the drawing to move around at higher zoom.</p>}
      {tool === 'edit' && <div className="space-y-3 rounded-xl bg-slate-50 p-3">
        <label className="block text-sm">Select a mark <select disabled={disabled} aria-label="Selected building mark" value={selectedId} onChange={e => setSelectedId(e.target.value)} className="ml-2 max-w-full rounded border p-2"><option value="">Click a mark or choose one</option>{image.structures.map((s, i) => <option key={s.id} value={s.id}>{s.kind === 'wall' ? 'Wall' : 'Pillar'} {i + 1} · {s.source === 'auto' ? 'detected' : 'edited'}</option>)}</select></label>
        {selected && <div className="flex flex-wrap gap-3">
          <label className="text-xs">Type<select disabled={disabled} aria-label="Mark type" value={selected.kind} onChange={e => edit({ kind: e.target.value as 'wall' | 'pillar' })} className="block rounded border p-2"><option value="wall">Wall</option><option value="pillar">Pillar</option></select></label>
          {(['width', 'height', 'rotation'] as const).map(key => <label className="text-xs" key={key}>{key === 'rotation' ? 'Angle (degrees)' : `${key === 'width' ? 'Length' : 'Thickness'} (${image.inchesPerPixel ? 'inches' : 'image pixels'})`}<input disabled={disabled} key={`${selected.id}-${key}-${selected[key]}`} aria-label={`Mark ${key}`} type="number" step="any" min={key === 'rotation' ? -360 : .01} max={key === 'rotation' ? 360 : undefined} defaultValue={Number((selected[key] * (key === 'rotation' ? 1 : image.inchesPerPixel || 1)).toFixed(3))} onBlur={e => { const n = Number(e.target.value); if (e.target.value && Number.isFinite(n) && (key === 'rotation' ? Math.abs(n) <= 360 : n > 0)) { const value = n / (key === 'rotation' ? 1 : image.inchesPerPixel || 1); if (Math.abs(value - selected[key]) > .00001) edit({ [key]: value }); } else e.target.value = String(selected[key] * (key === 'rotation' ? 1 : image.inchesPerPixel || 1)) }} className="block w-28 rounded border p-2" /></label>)}
          {selected.kind === 'pillar' && <label className="text-xs">Pillar shape<select aria-label="Pillar shape" value={selected.shape || 'rectangle'} onChange={e => edit({ shape: e.target.value as 'rectangle' | 'ellipse' })}><option value="rectangle">Rectangle</option><option value="ellipse">Round / oval</option></select></label>}
          {selected.kind === 'wall' && <div className="flex w-full flex-wrap gap-2 text-xs"><p className="w-full">Drag either blue endpoint to reshape this wall.</p><button className={button} onClick={() => { try { change({ ...image, rejected: reject([selected]), structures: image.structures.flatMap(s => s.id === selected.id ? splitWall(s) : [s]) }) } catch(e) { setError((e as Error).message) } }}>Split wall</button><select aria-label="Join wall" value={joinId} onChange={e => setJoinId(e.target.value)}><option value="">Choose adjoining wall</option>{image.structures.filter(s => s.kind === 'wall' && s.id !== selected.id).map(s => <option key={s.id} value={s.id}>Wall {image.structures.indexOf(s) + 1}</option>)}</select><button className={button} disabled={!joinId} onClick={() => { try { const other = image.structures.find(s => s.id === joinId); if (!other) return; const joined = joinWalls(selected, other, tolerance); change({ ...image, rejected: reject([selected, other]), structures: image.structures.filter(s => s.id !== other.id).map(s => s.id === selected.id ? joined : s) }); setJoinId(''); setError('') } catch(e) { setError((e as Error).message) } }}>Join walls</button>
          <div className="flex w-full flex-wrap items-center gap-2"><select aria-label="Opening type" value={openingKind} onChange={e => setOpeningKind(e.target.value as typeof openingKind)}><option value="door">Door</option><option value="exit">Exit</option><option value="opening">Open passage</option></select><label>Width (in)<input aria-label="Opening width" className="w-16 border p-1" type="number" min="1" value={openingWidth} onChange={e => setOpeningWidth(Math.max(1, Number(e.target.value)))} /></label><label>Position (%)<input aria-label="Opening position" className="w-16 border p-1" type="number" min="1" max="99" value={openingPosition} onChange={e => setOpeningPosition(Math.max(1, Math.min(99, Number(e.target.value))))} /></label><select aria-label="Door swing" value={swing} onChange={e => setSwing(e.target.value as typeof swing)}><option value="left">Left swing</option><option value="right">Right swing</option></select><button className={button} disabled={!image.inchesPerPixel} onClick={cutOpening}>Cut opening</button></div></div>}
          <button disabled={disabled} className={button} onClick={() => removeMark(selected)}>Delete selected mark</button>
        </div>}
      </div>}
      {!!image.openings?.length && tool === 'edit' && <details><summary className="cursor-pointer text-sm">Doors and openings ({image.openings.length})</summary>{image.openings.map((o, i) => <div key={o.id} className="flex items-center gap-2 text-xs"><span>{o.kind} {i + 1}</span><button className={button} onClick={() => change({ ...image, openings: image.openings!.map(item => item.id === o.id ? { ...item, swing: item.swing === 'left' ? 'right' : 'left' } : item) })}>Flip swing</button><button className={button} onClick={() => change({ ...image, openings: image.openings!.filter(item => item.id !== o.id) })}>Remove symbol (keep gap)</button></div>)}</details>}
      {image.verification && image.inchesPerPixel && <p role="status" className={referenceError(image.verification, image.inchesPerPixel) > 2 ? 'text-sm text-amber-800' : 'text-sm text-green-800'}>Second reference: {referenceError(image.verification, image.inchesPerPixel).toFixed(1)}% difference.{referenceError(image.verification, image.inchesPerPixel) > 2 ? ' Check endpoints, units, or scan distortion before importing.' : ' Scale check passed.'}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex items-center justify-between text-xs"><span>{image.inchesPerPixel ? `Page size: ${(image.naturalWidth * image.inchesPerPixel / 12).toFixed(1)} × ${(image.naturalHeight * image.inchesPerPixel / 12).toFixed(1)} ft` : 'Scale is not confirmed'}</span><label>Zoom <select disabled={disabled} aria-label={`Review zoom for ${image.name}`} value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[1, 1.5, 2, 3, 4].map(z => <option key={z} value={z}>{z * 100}%</option>)}</select></label></div>
    </div>
    <div ref={viewport} className="max-h-[65dvh] min-h-80 overflow-auto bg-slate-200 p-2 lg:col-start-1 lg:row-start-2"><svg aria-label={`Review building on ${image.name}`} viewBox={`0 0 ${image.naturalWidth} ${image.naturalHeight}`} className="block max-w-none cursor-crosshair bg-white" style={{ width: `${zoom * 100}%`, aspectRatio: `${image.naturalWidth}/${image.naturalHeight}`, touchAction: 'none' }} onPointerDown={e => { if (disabled || e.button !== 0) return; if (tool === 'pan' && viewport.current) { panStart.current = { x: e.clientX, y: e.clientY, left: viewport.current.scrollLeft, top: viewport.current.scrollTop }; e.currentTarget.setPointerCapture(e.pointerId); return } draft.current = snap && (tool === 'wall' || tool === 'room') ? snapPlanPoint(point(e), image.structures, tolerance) : point(e); setEnd(draft.current); e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { if (panStart.current && viewport.current) { viewport.current.scrollLeft = panStart.current.left - e.clientX + panStart.current.x; viewport.current.scrollTop = panStart.current.top - e.clientY + panStart.current.y } else if (draft.current) setEnd(point(e)) }} onPointerUp={finish} onPointerCancel={() => { draft.current = null; endpoint.current = null; panStart.current = null; setEnd(null) }}>
      <image href={image.dataUrl} width={image.naturalWidth} height={image.naturalHeight} preserveAspectRatio="none" />
      {image.detectionArea && <rect {...image.detectionArea} fill="none" stroke="#7c3aed" strokeWidth="3" strokeDasharray="8 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      {selected && tool === 'edit' && <rect x={selected.x} y={selected.y} width={selected.width} height={selected.height} transform={`rotate(${selected.rotation} ${selected.x} ${selected.y})`} fill="#2563eb33" stroke="#2563eb" strokeWidth="6" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      {image.structures.map(s => <rect key={s.id} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.shape === 'ellipse' ? s.width / 2 : 0} ry={s.shape === 'ellipse' ? s.height / 2 : 0} transform={`rotate(${s.rotation} ${s.x} ${s.y})`} fill={s.kind === 'wall' ? '#0d948855' : '#d9770655'} stroke={s.kind === 'wall' ? '#0d9488' : '#d97706'} strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents={tool === 'remove' || tool === 'edit' ? 'auto' : 'none'} onPointerDown={e => { if (!disabled && (tool === 'remove' || tool === 'edit')) { e.stopPropagation(); if (tool === 'edit') setSelectedId(s.id); else removeMark(s) } }} />)}
      {(image.rooms || []).map(r => <polygon key={r.id} points={r.vertices.map(p => p.x + ',' + p.y).join(' ')} fill="#2563eb11" stroke="#2563eb" strokeDasharray="6 4" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
      {roomPoints.length > 0 && tool === 'room' && <polyline points={roomPoints.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="#2563eb" strokeWidth="3" pointerEvents="none" />}
      {(image.openings || []).flatMap(o => openingLines(o).map((line, i) => <polyline key={o.id + i} points={line.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke={o.kind === 'exit' ? '#dc2626' : '#2563eb'} strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none" />))}
      {selected?.kind === 'wall' && tool === 'edit' && wallEnds(selected).map((p, i) => <circle key={'endpoint-' + i} aria-label={'Wall endpoint ' + (i + 1)} cx={endpoint.current === i && end ? end.x : p.x} cy={endpoint.current === i && end ? end.y : p.y} r={image.naturalWidth / 100 / zoom} fill="#2563eb" stroke="white" strokeWidth="2" style={{ cursor: 'grab' }} onPointerDown={e => { if (disabled) return; e.stopPropagation(); endpoint.current = i as 0 | 1; draft.current = p; setEnd(p); e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId) }} />)}
      {image.verification && <line x1={image.verification.start.x} y1={image.verification.start.y} x2={image.verification.end.x} y2={image.verification.end.y} stroke="#16a34a" strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={image.naturalWidth / 120} fill="#2563eb" pointerEvents="none" />)}
      {points.length === 2 && <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#2563eb" strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      {draft.current && end && tool === 'wall' && <line x1={draft.current.x} y1={draft.current.y} x2={end.x} y2={end.y} stroke="#2563eb" strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      {draft.current && end && (tool === 'pillar' || tool === 'area') && <rect x={Math.min(draft.current.x, end.x)} y={Math.min(draft.current.y, end.y)} width={Math.abs(draft.current.x - end.x)} height={Math.abs(draft.current.y - end.y)} fill="#d9770655" stroke="#d97706" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
    </svg></div>
  </section>
}
