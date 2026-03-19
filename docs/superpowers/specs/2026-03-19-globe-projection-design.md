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
- **Shader injection**: each projection provides a GLSL prelude defining `projectTile(vec2) → vec4` (camelCase, matching MapLibre's globe GLSL verbatim); all layer vertex shaders call this function
- **Mesh subdivision**: copied from MapLibre — tiles are subdivided into curved meshes so raster textures wrap the sphere correctly at all zoom levels
- **Stencil mask** uses the same subdivided mesh as rendering (identical geometry = no seam artifacts), compiled with the same projection prelude
- `u_projection_transition` is included in the globe prelude (hardcoded `1.0` for now) so animated mercator↔globe transitions can be wired up later without shader changes

No type flags, no `if projection.type === 'globe'` anywhere. Polymorphism throughout.

---

## 1. Expanded `Projection` Interface

```typescript
// src/mini/core/projection.ts

export interface Projection {
  /**
   * GLSL prepended to every layer vertex shader AND the stencil shader.
   * Must define: `vec4 projectTile(vec2 pos)`
   * Mercator: simple matrix multiply.
   * Globe: full sphere math from MapLibre.
   */
  readonly vertexShaderPrelude: string

  /** Tile IDs visible in the current camera + viewport */
  getVisibleTiles(camera: CameraState, viewport: Viewport): TileID[]

  /**
   * Sets ALL projection-specific uniforms for a tile on a compiled program.
   * Mercator: sets u_matrix.
   * Globe: sets u_projection_matrix, u_projection_tile_mercator_coords,
   *        u_projection_clipping_plane, u_projection_transition.
   * Also used by writeTileStencil — the stencil shader shares the same uniforms.
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

**Note:** `getTileMatrix` is removed from the public interface. It was ambiguous (per-tile affine for mercator vs. shared camera matrix for globe). All matrix/uniform concerns are encapsulated in `setTileUniforms`. Internally, `GlobeProjection` and `MercatorProjection` can have private `_getTileMatrix()` helpers used by their own `setTileUniforms` implementations.

---

## 2. New Shared Types

```typescript
// src/mini/core/types.ts additions

export interface TileMesh {
  vertices: Float32Array  // MVT coords [0,4096], interleaved xy
  indices: Uint16Array
}
```

**Note:** `TileMesh` currently exists in `src/mini/core/render-extension.ts`. Move the canonical definition to `types.ts` and replace it in `render-extension.ts` with a re-export. `render-extension.ts` is added to the modified-files list.

`matrix` is **removed** from `DrawContext` — projection uniforms are set by `setTileUniforms`, not by layers.

---

## 3. Layer Shader Change (all layers)

One-line change in every layer vertex shader. Use `projectTile` (camelCase — matches MapLibre's globe GLSL verbatim):

```glsl
// Before:
gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);

// After:
gl_Position = projectTile(a_pos);
```

**Raster UV fix:** The raster layer currently derives UV from `a_pos` (which was `[0,1]²`). With the tile mesh, vertices are in `[0,4096]²`. Update the raster vertex shader:
```glsl
v_uv = a_pos / 4096.0;
```

---

## 4. Shader Injection in the Renderer

Programs are compiled once per `Projection` instance, cached in a `WeakMap<Projection, ProgramCache>`. The **stencil program** is also compiled per-projection (it must call `projectTile` too):

```typescript
// Renderer
private _compiledPrograms = new WeakMap<Projection, { layers: ProgramCache, stencil: WebGLProgram }>()

private _getOrCompilePrograms() {
  if (!this._compiledPrograms.has(this._projection)) {
    const prelude = this._projection.vertexShaderPrelude
    const layers = this._webgl.compilePrograms(this._collectLayerDefs(), prelude)
    const stencil = this._webgl.compileStencilProgram(prelude)
    this._compiledPrograms.set(this._projection, { layers, stencil })
  }
  return this._compiledPrograms.get(this._projection)!
}
```

`WebGLContext.compilePrograms(defs, vertexPrelude)` prepends the prelude to each definition's vertex shader and returns a fresh `ProgramCache`.

`WebGLContext.compileStencilProgram(vertexPrelude)` compiles the stencil shader (draws tile mesh, no color output) with the given prelude. Stencil vertex shader: `void main() { gl_Position = projectTile(a_pos); }`.

**GPU cleanup:** `Renderer.destroy()` must call `gl.deleteProgram` on all programs accumulated in the WeakMap cache values. Store all `WebGLProgram` instances in a plain array alongside the WeakMap for cleanup.

Switching projections triggers recompilation via the WeakMap miss. Old programs remain reachable (via the cleanup array) until `destroy()` is called.

---

## 5. Render Loop Changes

```typescript
renderFrame(): void {
  const { layers: programs, stencil: stencilProg } = this._getOrCompilePrograms()
  gl.enable(gl.STENCIL_TEST)
  gl.clear(gl.STENCIL_BUFFER_BIT)
  let nextStencilRef = 1

  for each tile:
    const mesh    = this._projection.getMeshForTile(tileID)
    const buffers = this._webgl.getOrCreateMeshBuffers(tileID.key, mesh)

    // Stencil: same geometry + same projection uniforms = no seam artifacts
    this._webgl.writeTileStencil(stencilProg, buffers.vert, buffers.idx,
                                  mesh.indices.length, ref++)
    this._projection.setTileUniforms(gl, stencilProg, tileID, camera, viewport)

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

```typescript
readonly vertexShaderPrelude = `
  uniform mat4 u_matrix;
  vec4 projectTile(vec2 pos) { return u_matrix * vec4(pos, 0.0, 1.0); }
`

setTileUniforms(gl, program, tileID, camera, viewport): void {
  // compute affine tile matrix (existing getTileMatrix logic, now private)
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, matrix)
}

getMeshForTile(_tileID: TileID): TileMesh {
  return FLAT_QUAD_MESH  // static singleton [0,4096]², no allocation per tile
}
```

`getTileMatrix` becomes a private helper used only by `setTileUniforms`.

---

## 7. GlobeProjection Implementation

### Files copied from MapLibre (with noted adaptations)

All placed under `src/mini/renderer/globe/`:

| File | MapLibre source | Lines | Notes |
|---|---|---|---|
| `subdivision.ts` | `src/render/subdivision.ts` | ~999 | Patch `EXTENT` import → inline constant `4096` (mini uses 4096, not MapLibre's 8192). Bring along `subdivision_granularity_settings.ts`. Stub `CanonicalTileID` as `{z,x,y}`. |
| `globe-utils.ts` | `src/geo/projection/globe_utils.ts` | ~253 | Replace `gl-matrix` imports with local copies. Inline small utilities (`clamp`, `lerp`) from MapLibre's `util.ts`. |
| `globe-transform.ts` | `src/geo/projection/globe_transform.ts` | ~464 | Extract only the matrix computation functions needed by `getTileMatrix`. Do not copy the full `GlobeTransform` class (it has 15+ MapLibre-specific dependencies). Copy the math, not the class. |
| `globe-prelude.glsl.ts` | `src/shaders/_projection_globe.vertex.glsl` | ~152 | Add missing uniform declaration: `uniform mat4 u_projection_matrix;` (normally comes from MapLibre's `_prelude.vertex.glsl`). Keep all else verbatim. |
| `subdivision_granularity_settings.ts` | `src/render/subdivision_granularity_settings.ts` | ~60 | Required by `subdivision.ts`. Copy verbatim. |

**EXTENT note:** Mini uses `4096` as tile extent; MapLibre uses `8192`. When copying `subdivision.ts`, replace `import {EXTENT} from '../data/extent'` with `const EXTENT = 4096`.

### `GlobeProjection` class (~150 lines, written by us)

```typescript
class GlobeProjection implements Projection {
  readonly vertexShaderPrelude = GLOBE_PRELUDE  // from globe-prelude.glsl.ts
  private _meshCache = new Map<string, TileMesh>()

  setTileUniforms(gl, program, tileID, camera, viewport): void
    // u_projection_matrix          → globe camera/view-projection matrix (from globe-transform.ts)
    // u_projection_tile_mercator_coords → vec4 tile mercator bounds (from tileID + zoom)
    // u_projection_clipping_plane  → computed from camera center (hides back of globe)
    // u_projection_transition      → 1.0 (hardcoded for now)

  getMeshForTile(tileID): TileMesh
    // granularity from zoom using granularitySettingsGlobe from vertical_perspective_projection.ts
    // calls subdivision.ts, caches by tileID.key

  getVisibleTiles(camera, viewport): TileID[]
    // MVP: reuse mercator tile coverage
    // back-face tiles discarded by clipping plane in shader
    // full sphere frustum culling deferred to follow-up
}
```

---

## 8. WebGLContext Changes

**`compilePrograms(defs, vertexPrelude)`** — prepends prelude to vertex shaders, returns `ProgramCache`:
```typescript
compilePrograms(defs: ProgramDefinition[], vertexPrelude = ''): ProgramCache
```

**`compileStencilProgram(vertexPrelude)`** — compiles the stencil shader with the given prelude:
```typescript
compileStencilProgram(vertexPrelude: string): WebGLProgram
// vertex: `${vertexPrelude}\nattribute vec2 a_pos;\nvoid main() { gl_Position = projectTile(a_pos); }`
// fragment: `precision mediump float; void main() { gl_FragColor = vec4(0.0); }`
```

**`getOrCreateMeshBuffers(key, mesh)`** — creates and caches VBO + IBO for a `TileMesh`:
```typescript
getOrCreateMeshBuffers(key: string, mesh: TileMesh): { vert: WebGLBuffer, idx: WebGLBuffer }
```

**`writeTileStencil`** — updated to use external program and buffers (draws with `gl.drawElements`):
```typescript
writeTileStencil(
  program: WebGLProgram,
  vertBuf: WebGLBuffer,
  idxBuf: WebGLBuffer,
  indexCount: number,
  ref: number,
): void
```

The hardcoded internal `_tileQuadBuffer` and `_stencilProgram` are removed — replaced by the per-projection stencil program and mesh buffers.

---

## 9. File Summary

### New files
```
src/mini/renderer/globe/
  subdivision.ts                    — copied (patch EXTENT=4096, stub CanonicalTileID)
  subdivision_granularity_settings.ts — copied verbatim
  globe-utils.ts                    — copied (inline gl-matrix + util helpers)
  globe-transform.ts                — copied math functions only (not full class)
  globe-prelude.glsl.ts             — copied (add u_projection_matrix declaration)
  globe-projection.ts               — ~150 lines written by us
demo/phase6/                        — globe demo with raster tiles
```

### Modified files
```
src/mini/core/projection.ts         — expanded interface (remove getTileMatrix, add setTileUniforms + getMeshForTile)
src/mini/core/types.ts              — add TileMesh, remove matrix from DrawContext
src/mini/core/render-extension.ts   — replace TileMesh definition with re-export from types.ts
src/mini/renderer/mercator.ts       — add vertexShaderPrelude, setTileUniforms, getMeshForTile; getTileMatrix private
src/mini/renderer/renderer.ts       — WeakMap program cache, mesh-based stencil, setTileUniforms, cleanup tracking
src/mini/renderer/webgl-context.ts  — compilePrograms(prelude), compileStencilProgram, getOrCreateMeshBuffers, updated writeTileStencil
src/mini/layers/raster.ts           — projectTile() in vertex shader, v_uv = a_pos / 4096.0
src/mini/layers/fill.ts             — projectTile() in vertex shader
src/mini/layers/line.ts             — projectTile() in vertex shader
```

---

## 10. Out of Scope (deferred)

- Animated mercator↔globe transition (uniform wired in shader, value deferred)
- Full sphere frustum culling (mercator coverage + back-face clipping plane is sufficient MVP)
- Globe-aware symbol/label placement
- Elevation/terrain on globe
