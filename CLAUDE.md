# MapLibre Modular — Development Guidelines

## Debug logging

Use `createDebug` from `src/modular/debug.ts` for all debug logging. It tree-shakes away in production.

```ts
import { createDebug } from '../../debug.ts'
const debug = createDebug?.('MyLayer', false)  // true/false to enable/disable

// At call sites — always use optional chaining so prod builds eliminate the call:
debug?.('draw called', { key, count })
debug?.('something happened')
```

**Rule:** Add `debug?.()` calls at every significant state transition so the rendering pipeline can be traced without re-deploying. Do not remove debug calls — they are the observability layer.

Existing subjects: `TextLayer`, `GlyphManager`, `SymbolWorker`

## Copy MapLibre, don't reinvent

When implementing rendering features, always look at how MapLibre GL JS handles it first and copy their approach. The full MapLibre source is available at `/Users/puckey/rg/maplibre-gl-js`.

Examples where this paid off:
- **Tile clipping**: copied MapLibre's stencil mask approach (ALWAYS+REPLACE per tile, EQUAL for layer draws) instead of coordinate-based filtering — fixed tile seam glitches and preserved borders at tile boundaries.

## Mark stubs and placeholder values

When writing temporary/incomplete code — empty arrays, empty objects, null defaults, empty interfaces — mark them with `// STUB: <what's missing>` at the assignment site.

```ts
// BAD: silently breaks downstream consumers
visibleTiles: [],
imageAtlas: {},

// GOOD: discoverable without debugging
visibleTiles: [], // STUB: not wired yet, populate from TileManager.getReadyTiles()
imageAtlas: {}, // STUB: not wired yet
```

**Why:** `visibleTiles: []` looked like valid code but silently broke collision placement — labels disappeared on zoom changes. The empty array was a placeholder that was never wired up, and it took significant debugging to trace back to it.

**Code review rule:** Any `[]`, `{}`, or `null` passed where a consumer reads and acts on the value must either be the correct value or have a STUB comment.
