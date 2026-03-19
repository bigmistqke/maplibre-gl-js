# Globe Projection — Design Spec

**Date:** 2026-03-19
**Branch:** mini-clean
**Goal:** Add globe projection to maplibre-mini for production raster-tile use, following the CLAUDE.md principle: copy MapLibre's hard math verbatim, contribute only architecture.

---

## Context

maplibre-mini is a pluggable, tree-shakeable WebGL map renderer. The current `Projection` interface supports only Mercator. The user's company renders raster tiles on a globe in production. Globe projection is a non-negotiable MVP feature.

---

## Approach: Shader Injection + Copied Subdivision (MapLibre-style)

- **Projection interface** expanded with three new methods
- **Shader injection**: each projection provides a GLSL prelude defining `project_tile(vec2) → vec4`; all layer vertex shaders call this function instead of hard-coding `u_matrix * vec4(a_pos, ...)`
- **Mesh subdivision**: copied verbatim from MapLibre — tiles are subdivided into curved meshes so raster textures wrap the sphere correctly at all zoom levels
- **Stencil mask** uses the same subdivided mesh as rendering (identical geometry = no seam artifacts)
- `u_projection_transition` is included in the globe prelude (hardcoded `1.0` for now) so animated mercator↔globe transitions can be wired up later without shader changes

No type flags, no `if projection.type === 'globe'` anywhere. Polymorphism throughout.

---

## 1. Expanded `Projection` Interface

```typescript
// src/mini/core/projection.ts

export interface Projection {
  /** GLSL prepended to every layer vertex shader. Defines project_tile(vec2) → vec4. */
  readonly vertexShaderPrelude: string

  /** Tile IDs visible in the current camera + viewport */
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[]

  /**
   * For mercator: per-tile affine matrix mapping [0,4096]² → clip space.
   * For globe: camera/view-projection matrix (shared across tiles; tileID ignored).
   * Used by the renderer for the stencil pass and passed to setTileUniforms.
   */
  getTileMatrix(tileID: TileID, camera: CameraState, viewport: Viewport): Float32Array

  /**
   * Set all projection-specific uniforms for a tile on a compiled program.
   * Mercator: sets u_matrix.
   * Globe: sets u_projection_matrix, u_projection_tile_mercator_coords,
   *        u_projection_clipping_plane, u_projection_transition.
   */
  setTileUniforms(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    tileID: TileID,
    camera: CameraState,
    viewport: Viewport,
  ): void

  /**
   * Returns the tile mesh for rendering and stencil masking.
   * Mercator: returns a single static flat quad [0,4096]² (no allocation per tile).
   * Globe: returns a subdivided curved mesh; cached by tileID.key.
   */
  getMeshForTile(tileID: TileID): TileMesh
}
```

---

## 2. New Shared Types

```typescript
// src/mini/core/types.ts additions

export interface TileMesh {
  vertices: Float32Array  // MVT coords [0,4096], interleaved xy
  indices: Uint16Array
}
```

`matrix` is **removed** from `DrawContext` — projection uniforms are set by `setTileUniforms`, not by layers.

---

## 3. Layer Shader Change (all layers)

One-line change in every layer vertex shader:

```glsl
// Before:
gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);

// After:
gl_Position = project_tile(a_pos);
```

`project_tile` is defined by the projection's `vertexShaderPrelude`. Layers are projection-agnostic.

---

## 4. Shader Injection in the Renderer

Programs are compiled once per `Projection` instance, cached in a `WeakMap<Projection, ProgramCache>`:

```typescript
// Renderer
private _compiledPrograms = new WeakMap<Projection, ProgramCache>()

private _getOrCompilePrograms(): ProgramCache {
  if (!this._compiledPrograms.has(this._projection)) {
    const defs = this._collectLayerDefs()
    const cache = this._webgl.compilePrograms(defs, this._projection.vertexShaderPrelude)
    this._compiledPrograms.set(this._projection, cache)
  }
  return this._compiledPrograms.get(this._projection)!
}
```

`WebGLContext.compilePrograms(defs, vertexPrelude)` prepends the prelude to each definition's vertex shader and returns a fresh `ProgramCache`. Switching projections triggers recompilation via the WeakMap miss. Old programs remain cached for future transition blending.

---

## 5. Render Loop Changes

```typescript
renderFrame(): void {
  const programs = this._getOrCompilePrograms()
  gl.enable(gl.STENCIL_TEST)
  gl.clear(gl.STENCIL_BUFFER_BIT)
  let nextStencilRef = 1

  for each tile:
    const matrix  = this._projection.getTileMatrix(tileID, camera, viewport)
    const mesh    = this._projection.getMeshForTile(tileID)
    const buffers = this._webgl.getOrCreateMeshBuffers(tileID.key, mesh)

    // Stencil uses identical geometry to rendering — no seam artifacts
    this._webgl.writeTileStencil(buffers.vert, buffers.idx, mesh.indices.length, matrix, ref++)

    gl.stencilFunc(gl.EQUAL, ref, 0xFF)
    gl.stencilMask(0x00)

    for each layer:
      const program = programs.get(layer.programName)
      this._projection.setTileUniforms(gl, program, tileID, camera, viewport)
      layer.draw({ gl, programs, tileID, zoom, paint, ... })  // no matrix in DrawContext

  gl.disable(gl.STENCIL_TEST)
}
```

---

## 6. MercatorProjection Changes (additive only)

Three new methods added to the existing class:

```typescript
readonly vertexShaderPrelude = `
  uniform mat4 u_matrix;
  vec4 project_tile(vec2 pos) { return u_matrix * vec4(pos, 0.0, 1.0); }
`

setTileUniforms(gl, program, tileID, camera, viewport): void {
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false,
    this.getTileMatrix(tileID, camera, viewport))
}

getMeshForTile(_tileID: TileID): TileMesh {
  return FLAT_QUAD_MESH  // static singleton, no allocation
}
```

---

## 7. GlobeProjection Implementation

### Files copied verbatim from MapLibre

All placed under `src/mini/renderer/globe/`:

| File | MapLibre source | Lines | Purpose |
|---|---|---|---|
| `subdivision.ts` | `src/render/subdivision.ts` | ~999 | Recursive tile mesh subdivision |
| `globe-utils.ts` | `src/geo/projection/globe_utils.ts` | ~253 | Sphere math utilities |
| `globe-transform.ts` | `src/geo/projection/globe_transform.ts` | ~464 | Globe camera/view-projection matrix |
| `globe-prelude.glsl.ts` | `src/shaders/_projection_globe.vertex.glsl` | ~152 | Vertex shader prelude (sphere projection) |

### `GlobeProjection` class (~150 lines, written by us)

```typescript
class GlobeProjection implements Projection {
  readonly vertexShaderPrelude = GLOBE_PRELUDE  // from globe-prelude.glsl.ts
  private _meshCache = new Map<string, TileMesh>()

  getTileMatrix(tileID, camera, viewport): Float32Array
    // delegates to globe-transform.ts — same matrix for all tiles

  setTileUniforms(gl, program, tileID, camera, viewport): void
    // u_projection_matrix          → getTileMatrix()
    // u_projection_tile_mercator_coords → vec4 tile mercator bounds
    // u_projection_clipping_plane  → computed from camera center
    // u_projection_transition      → 1.0 (hardcoded for now)

  getMeshForTile(tileID): TileMesh
    // subdivision granularity from zoom (copy MapLibre's globeDefault table)
    // calls subdivision.ts, caches by tileID.key

  getVisibleTiles(camera, viewport): TileID[]
    // MVP: reuse mercator tile coverage
    // back-face tiles discarded by clipping plane in shader
    // full sphere frustum culling deferred to follow-up
}
```

---

## 8. WebGLContext Changes

**`compilePrograms(defs, vertexPrelude)`** — new overload prepends prelude to vertex shaders, returns `ProgramCache`:
```typescript
compilePrograms(defs: ProgramDefinition[], vertexPrelude = ''): ProgramCache
```

**`getOrCreateMeshBuffers(key, mesh)`** — creates and caches VBO + IBO for a `TileMesh`:
```typescript
getOrCreateMeshBuffers(key: string, mesh: TileMesh): { vert: WebGLBuffer, idx: WebGLBuffer }
```

**`writeTileStencil`** — updated signature to accept external buffers:
```typescript
writeTileStencil(
  vertBuf: WebGLBuffer,
  idxBuf: WebGLBuffer,
  indexCount: number,
  matrix: Float32Array,
  ref: number,
): void
```

---

## 9. File Summary

### New files
```
src/mini/renderer/globe/
  subdivision.ts         — copied verbatim
  globe-utils.ts         — copied verbatim
  globe-transform.ts     — copied verbatim
  globe-prelude.glsl.ts  — copied verbatim
  globe-projection.ts    — ~150 lines (written by us)
demo/phase6/             — globe demo with raster tiles
```

### Modified files
```
src/mini/core/projection.ts      — expanded interface
src/mini/core/types.ts           — TileMesh type, remove matrix from DrawContext
src/mini/renderer/mercator.ts    — add vertexShaderPrelude, setTileUniforms, getMeshForTile
src/mini/renderer/renderer.ts    — WeakMap program cache, mesh-based stencil, setTileUniforms
src/mini/renderer/webgl-context.ts — compilePrograms(prelude), getOrCreateMeshBuffers, writeTileStencil
src/mini/layers/raster.ts        — project_tile() in vertex shader
src/mini/layers/fill.ts          — project_tile() in vertex shader
src/mini/layers/line.ts          — project_tile() in vertex shader
```

---

## 10. Out of Scope (deferred)

- Animated mercator↔globe transition (uniform wired in shader, value deferred)
- Full sphere frustum culling (mercator coverage + back-face culling is sufficient MVP)
- Globe-aware symbol/label placement
- Elevation/terrain on globe
