# MapLibre Modular — Development Guidelines

## Debug logging

Use `createDebug` from `src/modular/debug.ts` for all debug logging. It tree-shakes away in production and can be enabled per-subject at runtime.

```ts
import { createDebug } from '../../debug.ts'
const debug = createDebug?.('MyLayer', false)  // false = off by default

// At call sites — always use optional chaining so prod builds eliminate the call:
debug?.('draw called', { key, count })
debug?.('something happened')
```

Enable subjects at runtime in the browser console:
```js
globalThis.__DEBUG__ = '*'              // enable all
globalThis.__DEBUG__ = 'TextLayer,GlyphManager'  // enable specific subjects
```

**Rule:** Add `debug?.()` calls at every significant state transition so the rendering pipeline can be traced without re-deploying. Do not remove debug calls — they are the observability layer.

Existing subjects: `TextLayer`, `GlyphManager`, `SymbolWorker`

## Copy MapLibre, don't reinvent

When implementing rendering features, always look at how MapLibre GL JS handles it first and copy their approach. The full MapLibre source is available at `/Users/puckey/rg/maplibre-gl-js`.

Examples where this paid off:
- **Tile clipping**: copied MapLibre's stencil mask approach (ALWAYS+REPLACE per tile, EQUAL for layer draws) instead of coordinate-based filtering — fixed tile seam glitches and preserved borders at tile boundaries.
