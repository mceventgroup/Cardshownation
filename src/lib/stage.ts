// Module-level Konva stage registry.
// KonvaCanvas registers itself here so the export functions can access it
// without threading a ref through the entire component tree.

import type Konva from 'konva'

let _stage: Konva.Stage | null = null

export function registerStage(stage: Konva.Stage | null): void {
  _stage = stage
}

export function getStage(): Konva.Stage | null {
  return _stage
}
