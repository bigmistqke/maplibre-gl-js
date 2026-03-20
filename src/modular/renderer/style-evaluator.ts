import type { ResolvedPaintProperties } from '../core/types.ts'
import type { LayerInstance } from '../core/renderer-api.ts'

const NON_PAINT_FIELDS = new Set(['type', 'source', 'sourceLayer', 'id', 'onAdd'])

export class StyleEvaluator {
  evaluate(layer: LayerInstance, _zoom: number): ResolvedPaintProperties {
    const result: ResolvedPaintProperties = {}
    for (const [key, value] of Object.entries(layer)) {
      if (NON_PAINT_FIELDS.has(key)) continue
      if (typeof value === 'function') continue
      result[key] = value
    }
    return result
  }
}
