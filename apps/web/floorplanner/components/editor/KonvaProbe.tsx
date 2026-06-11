'use client'

import 'konva/lib/Stage'
import 'konva/lib/Layer'
import 'konva/lib/shapes/Rect'
import { Stage, Layer, Rect } from 'react-konva/lib/ReactKonvaCore'

export default function KonvaProbe() {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Renderer Probe
      </p>
      <p className="mt-2 text-sm text-slate-600">
        This is a minimal Konva stage with a single rectangle. If it renders, the crash is above the raw renderer layer.
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Stage width={320} height={180}>
          <Layer>
            <Rect x={32} y={32} width={120} height={72} fill="#0f172a" cornerRadius={10} />
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
