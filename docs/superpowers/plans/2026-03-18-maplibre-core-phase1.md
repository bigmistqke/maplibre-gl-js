# MapLibre Clean-Room — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A map that renders a solid background color with a working camera — no tiles, no terrain. Proves the 4-tier architecture end-to-end.

**Architecture:** Core types and interfaces in `src/mini/core/`, Renderer in `src/mini/renderer/`, layers in `src/mini/layers/`. BackgroundLayer uses `gl.clearColor` — no shaders needed in Phase 1. Phase 2 introduces tile-based layers and the per-tile draw path.

**Tech Stack:** TypeScript, WebGL 1, vitest + jsdom + vitest-webgl-canvas-mock (already configured), gl-matrix (already installed). No new npm packages in Phase 1.

---

## File Map

| File | Responsibility |
|---|---|
| `src/mini/core/types.ts` | Primitive types: LngLat, TileID, ScreenPoint, Feature, CameraState, AnimationOptions, ProgramDefinition, ResolvedPaintProperties |
| `src/mini/core/elevation-provider.ts` | ElevationProvider interface + NULL_ELEVATION null object |
| `src/mini/core/plugin.ts` | Plugin interface (duck-typed, extends Partial<ElevationProvider>) |
| `src/mini/core/render-extension.ts` | RenderExtension, RenderContext, DrawContext, ProgramCache, ImageAtlas, LineDashAtlas, TileMesh interfaces |
| `src/mini/core/tile-service.ts` | TileService interface |
| `src/mini/core/renderer-api.ts` | RendererAPI interface + LayerInstance type |
| `src/mini/core/camera.ts` | CameraController — owns CameraState, animations, constraints |
| `src/mini/core/camera.test.ts` | Unit tests for CameraController |
| `src/mini/core/map.ts` | MapGL facade — thin shell, delegates to CameraController + RendererAPI |
| `src/mini/core/map.test.ts` | Unit tests for MapGL (mock renderer injected) |
| `src/mini/renderer/index.ts` | `createRenderer()` async factory — exported public API |
| `src/mini/renderer/frame-loop.ts` | FrameLoop — rAF, dirty tracking, drives renderer |
| `src/mini/renderer/frame-loop.test.ts` | Unit tests for FrameLoop |
| `src/mini/renderer/webgl-context.ts` | WebGLContext — wraps gl, compiles programs, manages GPU resources |
| `src/mini/renderer/webgl-context.test.ts` | Unit tests for WebGLContext |
| `src/mini/renderer/style-evaluator.ts` | StyleEvaluator — resolves literal paint properties per layer per zoom |
| `src/mini/renderer/style-evaluator.test.ts` | Unit tests for StyleEvaluator |
| `src/mini/renderer/render-extensions.ts` | RenderExtensions — ordered list, delegates before/afterTiles |
| `src/mini/renderer/render-extensions.test.ts` | Unit tests for RenderExtensions |
| `src/mini/renderer/renderer.ts` | Renderer — implements RendererAPI, wires everything together |
| `src/mini/renderer/renderer.test.ts` | Unit tests for Renderer |
| `src/mini/layers/background.ts` | BackgroundLayer — type='background', drawBackground() via clearColor |
| `src/mini/layers/background.test.ts` | Unit tests for BackgroundLayer |
| `src/mini/integration.test.ts` | End-to-end: canvas → createRenderer → MapGL → BackgroundLayer renders |

---

## Task 1: Core primitive types

**Files:**
- Create: `src/mini/core/types.ts`

- [ ] **Step 1: Create types.ts**

```ts
// src/mini/core/types.ts

export interface LngLat {
  lng: number
  lat: number
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface TileID {
  z: number
  x: number
  y: number
  key: string  // `${z}/${x}/${y}` — for use as Map key
}

export interface Feature {
  id?: string | number
  type: string
  properties: Record<string, unknown>
}

export interface CameraState {
  center: LngLat
  zoom: number
  bearing: number
  pitch: number
  /** Terrain elevation at map center ground level. Always 0 on flat maps. */
  groundElevation: number
}

export interface AnimationOptions {
  duration?: number
  easing?: (t: number) => number
}

export interface ProgramDefinition {
  name: string
  vertex: string
  fragment: string
}

export type ResolvedPaintProperties = Record<string, unknown>
```

- [ ] **Step 2: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: No errors from `src/mini/` files (other pre-existing errors in the repo are expected and can be ignored).

- [ ] **Step 3: Commit**

```bash
git add src/mini/core/types.ts
git commit -m "feat(mini): add core primitive types"
```

---

## Task 2: Core interfaces

**Files:**
- Create: `src/mini/core/elevation-provider.ts`
- Create: `src/mini/core/render-extension.ts`
- Create: `src/mini/core/tile-service.ts`
- Create: `src/mini/core/renderer-api.ts`
- Create: `src/mini/core/plugin.ts`

- [ ] **Step 1: Create elevation-provider.ts**

```ts
// src/mini/core/elevation-provider.ts
import type { LngLat } from './types.ts'

export interface ElevationProvider {
  getElevation(lngLat: LngLat): number
}

export const NULL_ELEVATION: ElevationProvider = {
  getElevation: () => 0,
}
```

- [ ] **Step 2: Create render-extension.ts**

This file holds all rendering-context interfaces, including `DrawContext` (used by per-tile draw calls in Phase 2+) and `RenderContext` (used by render extensions and full-frame hooks).

```ts
// src/mini/core/render-extension.ts
import type { CameraState, TileID, ResolvedPaintProperties } from './types.ts'

export interface ProgramCache {
  get(name: string): WebGLProgram | undefined
}

// Phase 2 implementations — stubs defined now so DrawContext type is complete.
export interface ImageAtlas {
  // sprite images, icon textures, fill patterns — implemented in Phase 2
}

export interface LineDashAtlas {
  // dash pattern textures for line layers — implemented in Phase 2
}

/** Passed to layer.draw() for each visible tile. Implemented by per-tile layers in Phase 2. */
export interface DrawContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  tileID: TileID
  matrix: Float32Array       // tile-space → clip-space
  zoom: number
  paint: ResolvedPaintProperties
  frameIndex: number
  imageAtlas: ImageAtlas     // always present, idle until used
  lineDashAtlas: LineDashAtlas
}

/** Passed to RenderExtension hooks (beforeTiles, afterTiles) and full-frame layers. */
export interface RenderContext {
  gl: WebGLRenderingContext
  programs: ProgramCache
  camera: CameraState
  visibleTiles: TileID[]
  frameIndex: number
}

export interface TileMesh {
  vertices: Float32Array
  indices: Uint16Array
}

export interface RenderExtension {
  id: string

  /**
   * Injected at compile time into programs that opt in via:
   * #pragma maplibre extension <id>
   * Multiple extensions injected in registration order.
   */
  shaderInjection?: {
    vertex?: string
    fragment?: string
    defines?: Record<string, string>
  }

  beforeTiles?(ctx: RenderContext): void
  afterTiles?(ctx: RenderContext): void

  /** Applied to tile mesh geometry before GPU upload. */
  transformTileGeometry?(mesh: TileMesh, tileID: TileID): TileMesh
}
```

- [ ] **Step 3: Create tile-service.ts**

```ts
// src/mini/core/tile-service.ts
import type { TileID } from './types.ts'

export interface TileService {
  /**
   * @param layerTypes — which layer types to build buckets for (e.g. ['fill', 'line'])
   */
  process(
    tileID: TileID,
    data: ArrayBuffer,
    layerTypes: string[],
    signal: AbortSignal,
  ): Promise<Transferable[]>
}
```

- [ ] **Step 4: Create renderer-api.ts**

```ts
// src/mini/core/renderer-api.ts
import type { CameraState, ScreenPoint, Feature } from './types.ts'
import type { RenderExtension } from './render-extension.ts'

export interface SourceDefinition {
  type: string
  [key: string]: unknown
}

export interface LayerInstance {
  /** Optional layer ID — used by removeLayer. */
  readonly id?: string
  readonly type: string
  onAdd?(renderer: RendererAPI): void
}

export interface RendererAPI {
  resize(width: number, height: number): void
  destroy(): void

  // Content mutations (fire-and-forget)
  addSource(id: string, source: SourceDefinition): void
  removeSource(id: string): void
  addLayer(layer: LayerInstance, beforeId?: string): void
  removeLayer(id: string): void
  setLayerPaint(id: string, props: Record<string, unknown>): void
  setLayerLayout(id: string, props: Record<string, unknown>): void
  setLayerVisibility(id: string, visible: boolean): void

  // Camera (fire-and-forget, up to 60fps)
  setCamera(state: CameraState): void

  // Render extensions (fire-and-forget)
  addRenderExtension(extension: RenderExtension): void
  removeRenderExtension(id: string): void

  // Queries — sync direct calls
  queryRenderedFeatures(point: ScreenPoint): Feature[]
}
```

- [ ] **Step 5: Create plugin.ts**

```ts
// src/mini/core/plugin.ts
import type { LngLat } from './types.ts'
import type { RenderExtension } from './render-extension.ts'

export interface Plugin {
  /** If present: registered as the map's ElevationProvider */
  getElevation?: (lngLat: LngLat) => number
  /** If present: forwarded to renderer.addRenderExtension() */
  readonly renderExtension?: RenderExtension
}
```

- [ ] **Step 6: Commit**

```bash
git add src/mini/core/
git commit -m "feat(mini): add core interfaces (ElevationProvider, RendererAPI, Plugin, RenderExtension, TileService)"
```

---

## Task 3: CameraController

**Files:**
- Create: `src/mini/core/camera.ts`
- Create: `src/mini/core/camera.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/core/camera.test.ts
import { describe, it, expect, vi } from 'vitest'
import { CameraController } from './camera.ts'

describe('CameraController', () => {
  it('has sensible defaults', () => {
    const cam = new CameraController()
    const state = cam.getState()
    expect(state.zoom).toBe(0)
    expect(state.bearing).toBe(0)
    expect(state.pitch).toBe(0)
    expect(state.center).toEqual({ lng: 0, lat: 0 })
    expect(state.groundElevation).toBe(0)
  })

  it('accepts initial state', () => {
    const cam = new CameraController({ center: { lng: 4.9, lat: 52.3 }, zoom: 10 })
    expect(cam.getState().center).toEqual({ lng: 4.9, lat: 52.3 })
    expect(cam.getState().zoom).toBe(10)
  })

  it('setZoom clamps to [minZoom, maxZoom]', () => {
    const cam = new CameraController({}, { minZoom: 0, maxZoom: 22 })
    cam.setZoom(-5)
    expect(cam.getState().zoom).toBe(0)
    cam.setZoom(30)
    expect(cam.getState().zoom).toBe(22)
  })

  it('notifies onChange when state changes', () => {
    const onChange = vi.fn()
    const cam = new CameraController({}, { onChange })
    cam.setZoom(5)
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].zoom).toBe(5)
  })

  it('setCamera updates multiple fields at once', () => {
    const cam = new CameraController()
    cam.setCamera({ zoom: 12, center: { lng: 2.3, lat: 48.8 } })
    const state = cam.getState()
    expect(state.zoom).toBe(12)
    expect(state.center).toEqual({ lng: 2.3, lat: 48.8 })
  })

  it('setElevationProvider is used for groundElevation on next setCenter', () => {
    const cam = new CameraController({ center: { lng: 0, lat: 0 } })
    cam.setElevationProvider({ getElevation: () => 42 })
    cam.setCenter({ lng: 0, lat: 0 })
    expect(cam.getState().groundElevation).toBe(42)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/core/camera.test.ts`
Expected: FAIL — `Cannot find module './camera.ts'`

- [ ] **Step 3: Implement CameraController**

```ts
// src/mini/core/camera.ts
import type { LngLat, CameraState, AnimationOptions } from './types.ts'
import type { ElevationProvider } from './elevation-provider.ts'
import { NULL_ELEVATION } from './elevation-provider.ts'

export interface CameraOptions {
  minZoom?: number
  maxZoom?: number
  onChange?: (state: CameraState) => void
}

const DEFAULT_STATE: CameraState = {
  center: { lng: 0, lat: 0 },
  zoom: 0,
  bearing: 0,
  pitch: 0,
  groundElevation: 0,
}

export class CameraController {
  private _state: CameraState
  private _minZoom: number
  private _maxZoom: number
  private _onChange?: (state: CameraState) => void
  private _elevationProvider: ElevationProvider = NULL_ELEVATION

  constructor(
    initial: Partial<CameraState> = {},
    options: CameraOptions = {},
  ) {
    this._state = { ...DEFAULT_STATE, ...initial }
    this._minZoom = options.minZoom ?? 0
    this._maxZoom = options.maxZoom ?? 22
    this._onChange = options.onChange
  }

  getState(): CameraState {
    return { ...this._state }
  }

  setElevationProvider(ep: ElevationProvider): void {
    this._elevationProvider = ep
  }

  setCenter(center: LngLat): void {
    this._update({
      center,
      groundElevation: this._elevationProvider.getElevation(center),
    })
  }

  setZoom(zoom: number): void {
    this._update({ zoom: Math.max(this._minZoom, Math.min(this._maxZoom, zoom)) })
  }

  setBearing(bearing: number): void {
    this._update({ bearing: ((bearing % 360) + 360) % 360 })
  }

  setPitch(pitch: number): void {
    this._update({ pitch: Math.max(0, Math.min(85, pitch)) })
  }

  setCamera(partial: Partial<CameraState>, _options?: AnimationOptions): void {
    const next: Partial<CameraState> = { ...partial }
    if (next.zoom !== undefined) {
      next.zoom = Math.max(this._minZoom, Math.min(this._maxZoom, next.zoom))
    }
    if (next.center !== undefined && next.groundElevation === undefined) {
      next.groundElevation = this._elevationProvider.getElevation(next.center)
    }
    this._update(next)
  }

  private _update(partial: Partial<CameraState>): void {
    this._state = { ...this._state, ...partial }
    this._onChange?.(this.getState())
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/core/camera.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/core/camera.ts src/mini/core/camera.test.ts
git commit -m "feat(mini): implement CameraController with state, constraints, and elevation clamping"
```

---

## Task 4: Map facade

**Files:**
- Create: `src/mini/core/map.ts`
- Create: `src/mini/core/map.test.ts`

> Note: The class is named `MapGL` (not `Map`) to avoid shadowing `globalThis.Map` inside the class body.

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/core/map.test.ts
import { describe, it, expect, vi } from 'vitest'
import { MapGL } from './map.ts'
import type { RendererAPI, LayerInstance } from './renderer-api.ts'

function makeRenderer(): RendererAPI {
  return {
    resize: vi.fn(),
    destroy: vi.fn(),
    addSource: vi.fn(),
    removeSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    setLayerPaint: vi.fn(),
    setLayerLayout: vi.fn(),
    setLayerVisibility: vi.fn(),
    setCamera: vi.fn(),
    addRenderExtension: vi.fn(),
    removeRenderExtension: vi.fn(),
    queryRenderedFeatures: vi.fn().mockReturnValue([]),
  }
}

describe('MapGL', () => {
  it('delegates addLayer to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const layer: LayerInstance = { type: 'background' }
    map.addLayer(layer)
    expect(renderer.addLayer).toHaveBeenCalledWith(layer, undefined)
  })

  it('delegates removeLayer to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    map.removeLayer('bg')
    expect(renderer.removeLayer).toHaveBeenCalledWith('bg')
  })

  it('setCamera updates CameraController and forwards to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    map.setCamera({ zoom: 8 })
    expect(map.getCamera().zoom).toBe(8)
    expect(renderer.setCamera).toHaveBeenCalledWith(expect.objectContaining({ zoom: 8 }))
  })

  it('getCamera returns current state synchronously', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer, initialCamera: { zoom: 5 } })
    expect(map.getCamera().zoom).toBe(5)
  })

  it('addPlugin with getElevation sets elevation provider', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const plugin = { getElevation: vi.fn().mockReturnValue(100) }
    map.addPlugin(plugin)
    map.setCamera({ center: { lng: 0, lat: 0 } })
    expect(map.getCamera().groundElevation).toBe(100)
  })

  it('addPlugin with renderExtension forwards to renderer', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const ext = { id: 'test-ext' }
    const plugin = { renderExtension: ext }
    map.addPlugin(plugin)
    expect(renderer.addRenderExtension).toHaveBeenCalledWith(ext)
  })

  it('on/off registers and removes event listeners', () => {
    const renderer = makeRenderer()
    const map = new MapGL({ renderer })
    const handler = vi.fn()
    map.on('move', handler)
    map.setCamera({ zoom: 3 })
    expect(handler).toHaveBeenCalledOnce()
    map.off('move', handler)
    map.setCamera({ zoom: 4 })
    expect(handler).toHaveBeenCalledOnce() // still just once
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/core/map.test.ts`
Expected: FAIL — `Cannot find module './map.ts'`

- [ ] **Step 3: Implement MapGL**

```ts
// src/mini/core/map.ts
import type { CameraState, AnimationOptions } from './types.ts'
import type { RendererAPI, LayerInstance } from './renderer-api.ts'
import type { Plugin } from './plugin.ts'
import { CameraController } from './camera.ts'

export interface MapGLOptions {
  renderer: RendererAPI
  initialCamera?: Partial<CameraState>
}

/**
 * Thin user-facing facade. Owns no rendering state.
 * Delegates to CameraController and RendererAPI.
 *
 * Named MapGL (not Map) to avoid shadowing globalThis.Map.
 */
export class MapGL {
  readonly renderer: RendererAPI
  private _camera: CameraController
  private _listeners: globalThis.Map<string, Set<Function>> = new globalThis.Map()

  constructor(options: MapGLOptions) {
    this.renderer = options.renderer
    this._camera = new CameraController(
      options.initialCamera ?? {},
      {
        onChange: (state) => {
          this.renderer.setCamera(state)
          this._emit('move', state)
        },
      },
    )
  }

  // — Layer API —

  addLayer(layer: LayerInstance, beforeId?: string): void {
    this.renderer.addLayer(layer, beforeId)
  }

  removeLayer(id: string): void {
    this.renderer.removeLayer(id)
  }

  addSource(id: string, source: Record<string, unknown>): void {
    this.renderer.addSource(id, source as any)
  }

  removeSource(id: string): void {
    this.renderer.removeSource(id)
  }

  // — Camera API —

  getCamera(): CameraState {
    return this._camera.getState()
  }

  setCamera(state: Partial<CameraState>, options?: AnimationOptions): void {
    this._camera.setCamera(state, options)
  }

  // — Plugin API —

  addPlugin(plugin: Plugin): void {
    if (plugin.getElevation) {
      this._camera.setElevationProvider({ getElevation: plugin.getElevation.bind(plugin) })
    }
    if (plugin.renderExtension) {
      this.renderer.addRenderExtension(plugin.renderExtension)
    }
  }

  // — Events —

  on(event: string, handler: Function): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Function): void {
    this._listeners.get(event)?.delete(handler)
  }

  private _emit(event: string, data: unknown): void {
    this._listeners.get(event)?.forEach((fn) => fn(data))
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/core/map.test.ts`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/core/map.ts src/mini/core/map.test.ts
git commit -m "feat(mini): implement MapGL facade with plugin support and event emitter"
```

---

## Task 5: FrameLoop

**Files:**
- Create: `src/mini/renderer/frame-loop.ts`
- Create: `src/mini/renderer/frame-loop.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/renderer/frame-loop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FrameLoop } from './frame-loop.ts'

describe('FrameLoop', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not call render until markDirty', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    vi.runAllTimers()
    expect(render).not.toHaveBeenCalled()
    loop.stop()
  })

  it('calls render after markDirty', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    loop.markDirty()
    vi.runAllTimers()
    expect(render).toHaveBeenCalledOnce()
    loop.stop()
  })

  it('calls render only once for multiple markDirty before next frame', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    loop.markDirty()
    loop.markDirty()
    loop.markDirty()
    vi.runAllTimers()
    expect(render).toHaveBeenCalledOnce()
    loop.stop()
  })

  it('does not render after stop', () => {
    const render = vi.fn()
    const loop = new FrameLoop(render)
    loop.start()
    loop.markDirty()
    loop.stop()
    vi.runAllTimers()
    expect(render).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/frame-loop.test.ts`
Expected: FAIL — `Cannot find module './frame-loop.ts'`

- [ ] **Step 3: Implement FrameLoop**

```ts
// src/mini/renderer/frame-loop.ts

export class FrameLoop {
  private _render: () => void
  private _dirty = false
  private _rafId: number | null = null
  private _running = false

  constructor(render: () => void) {
    this._render = render
  }

  start(): void {
    this._running = true
  }

  stop(): void {
    this._running = false
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    this._dirty = false
  }

  markDirty(): void {
    if (this._dirty || !this._running) return
    this._dirty = true
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null
      if (!this._running) return
      this._dirty = false
      this._render()
    })
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/frame-loop.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/renderer/frame-loop.ts src/mini/renderer/frame-loop.test.ts
git commit -m "feat(mini): implement FrameLoop with dirty tracking"
```

---

## Task 6: StyleEvaluator

**Files:**
- Create: `src/mini/renderer/style-evaluator.ts`
- Create: `src/mini/renderer/style-evaluator.test.ts`

Phase 1 scope: evaluates literal paint property values only — no expressions. The expression engine comes in a later phase.

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/renderer/style-evaluator.test.ts
import { describe, it, expect } from 'vitest'
import { StyleEvaluator } from './style-evaluator.ts'

describe('StyleEvaluator', () => {
  it('returns layer paint properties as-is when literal', () => {
    const evaluator = new StyleEvaluator()
    const layer = { type: 'background', color: '#ff0000', opacity: 0.5 }
    const result = evaluator.evaluate(layer as any, 10)
    expect(result['color']).toBe('#ff0000')
    expect(result['opacity']).toBe(0.5)
  })

  it('excludes structural fields (type, source, sourceLayer, id, onAdd)', () => {
    const evaluator = new StyleEvaluator()
    const layer = { type: 'fill', source: 'buildings', sourceLayer: 'building', id: 'my-layer', color: '#ccc' }
    const result = evaluator.evaluate(layer as any, 10)
    expect(result['type']).toBeUndefined()
    expect(result['source']).toBeUndefined()
    expect(result['sourceLayer']).toBeUndefined()
    expect(result['id']).toBeUndefined()
    expect(result['color']).toBe('#ccc')
  })

  it('excludes function-valued properties', () => {
    const evaluator = new StyleEvaluator()
    const layer = { type: 'background', color: '#000', draw: () => {} }
    const result = evaluator.evaluate(layer as any, 10)
    expect(result['draw']).toBeUndefined()
  })

  it('returns empty object for layer with no paint properties', () => {
    const evaluator = new StyleEvaluator()
    const layer = { type: 'background' }
    const result = evaluator.evaluate(layer as any, 10)
    expect(Object.keys(result)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/style-evaluator.test.ts`
Expected: FAIL — `Cannot find module './style-evaluator.ts'`

- [ ] **Step 3: Implement StyleEvaluator**

```ts
// src/mini/renderer/style-evaluator.ts
import type { ResolvedPaintProperties } from '../core/types.ts'
import type { LayerInstance } from '../core/renderer-api.ts'

// Fields that are structural, not paint properties
const NON_PAINT_FIELDS = new Set(['type', 'source', 'sourceLayer', 'id', 'onAdd'])

export class StyleEvaluator {
  /**
   * Phase 1: resolves literal property values only.
   * Expression evaluation is added in a later phase.
   */
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
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/style-evaluator.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/renderer/style-evaluator.ts src/mini/renderer/style-evaluator.test.ts
git commit -m "feat(mini): implement StyleEvaluator (literal property resolution, phase 1)"
```

---

## Task 7: WebGLContext

**Files:**
- Create: `src/mini/renderer/webgl-context.ts`
- Create: `src/mini/renderer/webgl-context.test.ts`

Phase 1: wraps the GL context, compiles programs, provides a `ProgramCache`. BackgroundLayer has no programs (uses clearColor), but the infrastructure must exist for Phase 2 layers.

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/renderer/webgl-context.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'vitest-webgl-canvas-mock'
import { WebGLContext } from './webgl-context.ts'
import type { ProgramDefinition } from '../core/types.ts'

describe('WebGLContext', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
  })

  it('creates a WebGLRenderingContext from a canvas', () => {
    const ctx = new WebGLContext(canvas)
    expect(ctx.gl).toBeDefined()
  })

  it('compilePrograms with an empty list succeeds', () => {
    const ctx = new WebGLContext(canvas)
    expect(() => ctx.compilePrograms([])).not.toThrow()
  })

  it('compilePrograms makes programs accessible by name', () => {
    const ctx = new WebGLContext(canvas)
    const defs: ProgramDefinition[] = [
      {
        name: 'test-prog',
        vertex: 'void main() { gl_Position = vec4(0.0); }',
        fragment: 'void main() { gl_FragColor = vec4(1.0); }',
      },
    ]
    ctx.compilePrograms(defs)
    expect(ctx.programs.get('test-prog')).toBeDefined()
  })

  it('programs.get returns undefined for unknown program', () => {
    const ctx = new WebGLContext(canvas)
    expect(ctx.programs.get('nonexistent')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/webgl-context.test.ts`
Expected: FAIL — `Cannot find module './webgl-context.ts'`

- [ ] **Step 3: Implement WebGLContext**

```ts
// src/mini/renderer/webgl-context.ts
import type { ProgramDefinition } from '../core/types.ts'
import type { ProgramCache } from '../core/render-extension.ts'

export class WebGLContext {
  readonly gl: WebGLRenderingContext
  private _programs = new globalThis.Map<string, WebGLProgram>()

  readonly programs: ProgramCache = {
    get: (name) => this._programs.get(name),
  }

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl')
    if (!gl) throw new Error('WebGL not supported')
    this.gl = gl
  }

  compilePrograms(defs: ProgramDefinition[]): void {
    for (const def of defs) {
      if (this._programs.has(def.name)) continue  // reference-counted: already compiled
      const program = this._compile(def.vertex, def.fragment)
      this._programs.set(def.name, program)
    }
  }

  private _compile(vertSrc: string, fragSrc: string): WebGLProgram {
    const { gl } = this
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc)
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc)
    const program = gl.createProgram()!
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`)
    }
    return program
  }

  private _compileShader(type: number, src: string): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`)
    }
    return shader
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/webgl-context.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/renderer/webgl-context.ts src/mini/renderer/webgl-context.test.ts
git commit -m "feat(mini): implement WebGLContext with program compilation"
```

---

## Task 8: RenderExtensions

**Files:**
- Create: `src/mini/renderer/render-extensions.ts`
- Create: `src/mini/renderer/render-extensions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/renderer/render-extensions.test.ts
import { describe, it, expect, vi } from 'vitest'
import { RenderExtensions } from './render-extensions.ts'
import type { RenderContext } from '../core/render-extension.ts'

const mockCtx = {} as RenderContext

describe('RenderExtensions', () => {
  it('starts empty', () => {
    const exts = new RenderExtensions()
    expect(exts.getAll()).toHaveLength(0)
  })

  it('add and getAll returns extensions in registration order', () => {
    const exts = new RenderExtensions()
    exts.add({ id: 'a' })
    exts.add({ id: 'b' })
    const all = exts.getAll()
    expect(all.map(e => e.id)).toEqual(['a', 'b'])
  })

  it('remove by id', () => {
    const exts = new RenderExtensions()
    exts.add({ id: 'a' })
    exts.add({ id: 'b' })
    exts.remove('a')
    expect(exts.getAll().map(e => e.id)).toEqual(['b'])
  })

  it('calls beforeTiles on all extensions in order', () => {
    const order: string[] = []
    const exts = new RenderExtensions()
    exts.add({ id: 'a', beforeTiles: () => order.push('a') })
    exts.add({ id: 'b', beforeTiles: () => order.push('b') })
    exts.runBeforeTiles(mockCtx)
    expect(order).toEqual(['a', 'b'])
  })

  it('calls afterTiles on all extensions in order', () => {
    const order: string[] = []
    const exts = new RenderExtensions()
    exts.add({ id: 'a', afterTiles: () => order.push('a') })
    exts.add({ id: 'b', afterTiles: () => order.push('b') })
    exts.runAfterTiles(mockCtx)
    expect(order).toEqual(['a', 'b'])
  })

  it('silently skips extensions without beforeTiles/afterTiles', () => {
    const exts = new RenderExtensions()
    exts.add({ id: 'no-hooks' })
    expect(() => exts.runBeforeTiles(mockCtx)).not.toThrow()
    expect(() => exts.runAfterTiles(mockCtx)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/render-extensions.test.ts`
Expected: FAIL — `Cannot find module './render-extensions.ts'`

- [ ] **Step 3: Implement RenderExtensions**

```ts
// src/mini/renderer/render-extensions.ts
import type { RenderExtension, RenderContext } from '../core/render-extension.ts'

export class RenderExtensions {
  private _extensions: RenderExtension[] = []

  add(extension: RenderExtension): void {
    this._extensions.push(extension)
  }

  remove(id: string): void {
    this._extensions = this._extensions.filter(e => e.id !== id)
  }

  getAll(): RenderExtension[] {
    return [...this._extensions]
  }

  runBeforeTiles(ctx: RenderContext): void {
    for (const ext of this._extensions) ext.beforeTiles?.(ctx)
  }

  runAfterTiles(ctx: RenderContext): void {
    for (const ext of this._extensions) ext.afterTiles?.(ctx)
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/render-extensions.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/renderer/render-extensions.ts src/mini/renderer/render-extensions.test.ts
git commit -m "feat(mini): implement RenderExtensions with ordered before/afterTiles hooks"
```

---

## Task 9: BackgroundLayer

**Files:**
- Create: `src/mini/layers/background.ts`
- Create: `src/mini/layers/background.test.ts`

BackgroundLayer uses `gl.clearColor` + `gl.clear` — no shaders, no tiles. It is a full-frame layer, not a per-tile layer. Its `drawBackground` method is called once per frame by the Renderer.

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/layers/background.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'vitest-webgl-canvas-mock'
import { BackgroundLayer } from './background.ts'

describe('BackgroundLayer', () => {
  it('has type "background"', () => {
    const layer = new BackgroundLayer({ color: '#ff0000' })
    expect(layer.type).toBe('background')
  })

  it('has no static programs (uses clearColor, not shaders)', () => {
    expect(BackgroundLayer.programs).toHaveLength(0)
  })

  it('has no TileService', () => {
    expect(BackgroundLayer.TileService).toBeUndefined()
  })

  it('drawBackground calls gl.clearColor with parsed RGBA', () => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')!
    const clearColor = vi.spyOn(gl, 'clearColor')
    const clear = vi.spyOn(gl, 'clear')

    const layer = new BackgroundLayer({ color: '#ff0000', opacity: 1 })
    layer.drawBackground({ gl, paint: { color: '#ff0000', opacity: 1 } })

    expect(clearColor).toHaveBeenCalledWith(1, 0, 0, 1)
    expect(clear).toHaveBeenCalledWith(gl.COLOR_BUFFER_BIT)
  })

  it('drawBackground applies opacity to alpha channel', () => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')!
    const clearColor = vi.spyOn(gl, 'clearColor')

    const layer = new BackgroundLayer({ color: '#ffffff', opacity: 0.5 })
    layer.drawBackground({ gl, paint: { color: '#ffffff', opacity: 0.5 } })

    const [, , , a] = clearColor.mock.calls[0]!
    expect(a).toBeCloseTo(0.5)
  })

  it('defaults color to black and opacity to 1', () => {
    const layer = new BackgroundLayer({})
    expect(layer.color).toBe('#000000')
    expect(layer.opacity).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/layers/background.test.ts`
Expected: FAIL — `Cannot find module './background.ts'`

- [ ] **Step 3: Implement BackgroundLayer**

```ts
// src/mini/layers/background.ts
import type { ProgramDefinition, ResolvedPaintProperties } from '../core/types.ts'

export interface BackgroundLayerOptions {
  color?: string
  opacity?: number
}

/** Parse a CSS hex color (#rgb, #rrggbb) into [r, g, b] in 0–1 range. */
function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16) / 255,
      parseInt(h[1] + h[1], 16) / 255,
      parseInt(h[2] + h[2], 16) / 255,
    ]
  }
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

export class BackgroundLayer {
  readonly type = 'background' as const

  /** No programs — background is drawn with gl.clearColor, not shaders. */
  static programs: ProgramDefinition[] = []
  static TileService: undefined = undefined

  color: string
  opacity: number

  constructor(options: BackgroundLayerOptions) {
    this.color = options.color ?? '#000000'
    this.opacity = options.opacity ?? 1
  }

  drawBackground(ctx: { gl: WebGLRenderingContext; paint: ResolvedPaintProperties }): void {
    const { gl, paint } = ctx
    const color = (paint['color'] as string | undefined) ?? this.color
    const opacity = (paint['opacity'] as number | undefined) ?? this.opacity
    const [r, g, b] = parseHexColor(color)
    gl.clearColor(r, g, b, opacity)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/layers/background.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/layers/background.ts src/mini/layers/background.test.ts
git commit -m "feat(mini): implement BackgroundLayer with clearColor rendering"
```

---

## Task 10: Renderer

**Files:**
- Create: `src/mini/renderer/renderer.ts`
- Create: `src/mini/renderer/renderer.test.ts`

The Renderer implements `RendererAPI`. It owns `WebGLContext`, `FrameLoop`, `StyleEvaluator`, and `RenderExtensions`.

**Key design: no layer-type-specific code in Renderer.** Full-frame layers (like BackgroundLayer) are detected by the presence of a `drawBackground` method — not by `instanceof` or type string checks.

- [ ] **Step 1: Write the failing tests**

```ts
// src/mini/renderer/renderer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'vitest-webgl-canvas-mock'
import { Renderer } from './renderer.ts'
import { BackgroundLayer } from '../layers/background.ts'

describe('Renderer', () => {
  let canvas: HTMLCanvasElement
  let renderer: Renderer

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    renderer = new Renderer(canvas)
  })

  it('addLayer registers the layer', () => {
    const layer = new BackgroundLayer({ color: '#ff0000' })
    renderer.addLayer(layer)
    expect(renderer.getLayers()).toContain(layer)
  })

  it('removeLayer unregisters the layer', () => {
    const layer = Object.assign(new BackgroundLayer({ color: '#ff0000' }), { id: 'bg' })
    renderer.addLayer(layer)
    renderer.removeLayer('bg')
    expect(renderer.getLayers()).not.toContain(layer)
  })

  it('addLayer calls onAdd if present', () => {
    const onAdd = vi.fn()
    const layer = Object.assign(new BackgroundLayer({ color: '#ff0000' }), { onAdd })
    renderer.addLayer(layer)
    expect(onAdd).toHaveBeenCalledWith(renderer)
  })

  it('renderFrame calls drawBackground on BackgroundLayer', () => {
    const layer = new BackgroundLayer({ color: '#00ff00' })
    const drawBackground = vi.spyOn(layer, 'drawBackground')
    renderer.addLayer(layer)
    renderer.renderFrame()
    expect(drawBackground).toHaveBeenCalledOnce()
  })

  it('renderFrame runs beforeTiles/afterTiles from render extensions', () => {
    const order: string[] = []
    renderer.addRenderExtension({ id: 'a', beforeTiles: () => order.push('before'), afterTiles: () => order.push('after') })
    renderer.renderFrame()
    expect(order).toEqual(['before', 'after'])
  })

  it('setCamera marks the frame dirty', () => {
    const markDirty = vi.spyOn((renderer as any)._frameLoop, 'markDirty')
    renderer.setCamera({ center: { lng: 0, lat: 0 }, zoom: 5, bearing: 0, pitch: 0, groundElevation: 0 })
    expect(markDirty).toHaveBeenCalled()
  })

  it('queryRenderedFeatures returns empty array (phase 1 stub)', () => {
    const result = renderer.queryRenderedFeatures({ x: 100, y: 100 })
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/renderer.test.ts`
Expected: FAIL — `Cannot find module './renderer.ts'`

- [ ] **Step 3: Implement Renderer**

```ts
// src/mini/renderer/renderer.ts
import type { CameraState, ScreenPoint, Feature, ResolvedPaintProperties } from '../core/types.ts'
import type { RendererAPI, LayerInstance, SourceDefinition } from '../core/renderer-api.ts'
import type { RenderExtension, RenderContext } from '../core/render-extension.ts'
import { WebGLContext } from './webgl-context.ts'
import { FrameLoop } from './frame-loop.ts'
import { StyleEvaluator } from './style-evaluator.ts'
import { RenderExtensions } from './render-extensions.ts'

interface LayerEntry {
  id: string
  layer: LayerInstance
}

/** Full-frame layers (e.g. BackgroundLayer) declare drawBackground instead of draw(DrawContext). */
interface FullFrameLayer {
  drawBackground(ctx: { gl: WebGLRenderingContext; paint: ResolvedPaintProperties }): void
}

function isFullFrameLayer(layer: LayerInstance): layer is LayerInstance & FullFrameLayer {
  return typeof (layer as any).drawBackground === 'function'
}

export class Renderer implements RendererAPI {
  private _webgl: WebGLContext
  private _frameLoop: FrameLoop
  private _styleEvaluator: StyleEvaluator
  private _renderExtensions: RenderExtensions
  private _layers: LayerEntry[] = []
  private _camera: CameraState | null = null
  private _frameIndex = 0
  private _width: number
  private _height: number

  constructor(canvas: HTMLCanvasElement) {
    this._width = canvas.width
    this._height = canvas.height
    this._webgl = new WebGLContext(canvas)
    this._frameLoop = new FrameLoop(() => this.renderFrame())
    this._styleEvaluator = new StyleEvaluator()
    this._renderExtensions = new RenderExtensions()
    this._frameLoop.start()
  }

  // RendererAPI — mutations

  resize(width: number, height: number): void {
    this._width = width
    this._height = height
    this._frameLoop.markDirty()
  }

  destroy(): void {
    this._frameLoop.stop()
  }

  addSource(_id: string, _source: SourceDefinition): void {
    // Phase 2: wire up TileManager
    this._frameLoop.markDirty()
  }

  removeSource(_id: string): void {
    this._frameLoop.markDirty()
  }

  addLayer(layer: LayerInstance, beforeId?: string): void {
    const id = (layer as any).id ?? `__layer_${this._layers.length}`
    if (beforeId) {
      const idx = this._layers.findIndex(e => e.id === beforeId)
      this._layers.splice(idx !== -1 ? idx : this._layers.length, 0, { id, layer })
    } else {
      this._layers.push({ id, layer })
    }

    if (typeof (layer as any).onAdd === 'function') {
      ;(layer as any).onAdd(this)
    }

    const programs = (layer.constructor as any).programs
    if (programs?.length > 0) {
      this._webgl.compilePrograms(programs)
    }

    this._frameLoop.markDirty()
  }

  removeLayer(id: string): void {
    this._layers = this._layers.filter(e => e.id !== id)
    this._frameLoop.markDirty()
  }

  setLayerPaint(_id: string, _props: Record<string, unknown>): void {
    this._frameLoop.markDirty()
  }

  setLayerLayout(_id: string, _props: Record<string, unknown>): void {
    this._frameLoop.markDirty()
  }

  setLayerVisibility(_id: string, _visible: boolean): void {
    this._frameLoop.markDirty()
  }

  setCamera(state: CameraState): void {
    this._camera = state
    this._frameLoop.markDirty()
  }

  addRenderExtension(extension: RenderExtension): void {
    this._renderExtensions.add(extension)
    this._frameLoop.markDirty()
  }

  removeRenderExtension(id: string): void {
    this._renderExtensions.remove(id)
  }

  // RendererAPI — queries

  queryRenderedFeatures(_point: ScreenPoint): Feature[] {
    // Phase 2: query geometry cache
    return []
  }

  // Internal — called by FrameLoop

  renderFrame(): void {
    const { gl } = this._webgl
    gl.viewport(0, 0, this._width, this._height)

    const renderCtx: RenderContext = {
      gl,
      programs: this._webgl.programs,
      camera: this._camera ?? { center: { lng: 0, lat: 0 }, zoom: 0, bearing: 0, pitch: 0, groundElevation: 0 },
      visibleTiles: [],
      frameIndex: this._frameIndex,
    }

    this._renderExtensions.runBeforeTiles(renderCtx)

    for (const { layer } of this._layers) {
      if (isFullFrameLayer(layer)) {
        const paint = this._styleEvaluator.evaluate(layer, renderCtx.camera.zoom)
        layer.drawBackground({ gl, paint })
      }
      // Phase 2: per-tile draw goes here
    }

    this._renderExtensions.runAfterTiles(renderCtx)
    this._frameIndex++
  }

  // Exposed for testing — not part of RendererAPI

  getLayers(): LayerInstance[] {
    return this._layers.map(e => e.layer)
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/renderer/renderer.test.ts`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mini/renderer/renderer.ts src/mini/renderer/renderer.test.ts
git commit -m "feat(mini): implement Renderer (RendererAPI impl, frame loop, background draw)"
```

---

## Task 11: createRenderer factory + integration test

**Files:**
- Create: `src/mini/renderer/index.ts`
- Create: `src/mini/integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
// src/mini/integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'vitest-webgl-canvas-mock'
import { createRenderer } from './renderer/index.ts'
import { MapGL } from './core/map.ts'
import { BackgroundLayer } from './layers/background.ts'

describe('Phase 1 integration', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
  })

  it('createRenderer returns a RendererAPI', async () => {
    const renderer = await createRenderer(canvas)
    expect(renderer).toBeDefined()
    expect(typeof renderer.addLayer).toBe('function')
    expect(typeof renderer.setCamera).toBe('function')
  })

  it('MapGL renders a background color frame', async () => {
    const renderer = await createRenderer(canvas)
    const map = new MapGL({ renderer, initialCamera: { zoom: 5 } })

    const layer = new BackgroundLayer({ color: '#3388ff', opacity: 1 })
    const drawBackground = vi.spyOn(layer, 'drawBackground')

    map.addLayer(layer)

    // Trigger a frame render directly (FrameLoop fires via rAF which is async)
    ;(renderer as any).renderFrame()

    expect(drawBackground).toHaveBeenCalledOnce()
    const { paint } = drawBackground.mock.calls[0][0]
    expect(paint['color']).toBe('#3388ff')
    expect(paint['opacity']).toBe(1)
  })

  it('setCamera propagates from MapGL to Renderer', async () => {
    const renderer = await createRenderer(canvas)
    const setCamera = vi.spyOn(renderer, 'setCamera')
    const map = new MapGL({ renderer })

    map.setCamera({ zoom: 12, center: { lng: 13.4, lat: 52.5 } })

    expect(setCamera).toHaveBeenCalledOnce()
    expect(setCamera.mock.calls[0][0].zoom).toBe(12)
  })

  it('addPlugin wires ElevationProvider and RenderExtension', async () => {
    const renderer = await createRenderer(canvas)
    const addRenderExtension = vi.spyOn(renderer, 'addRenderExtension')
    const map = new MapGL({ renderer })

    const plugin = {
      getElevation: vi.fn().mockReturnValue(500),
      renderExtension: { id: 'test-terrain' },
    }
    map.addPlugin(plugin)

    // ElevationProvider: groundElevation should come from plugin on next setCamera
    map.setCamera({ center: { lng: 0, lat: 0 } })
    expect(map.getCamera().groundElevation).toBe(500)

    // RenderExtension: forwarded to renderer
    expect(addRenderExtension).toHaveBeenCalledWith(plugin.renderExtension)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/integration.test.ts`
Expected: FAIL — `Cannot find module './renderer/index.ts'`

- [ ] **Step 3: Implement createRenderer**

```ts
// src/mini/renderer/index.ts
import type { RendererAPI } from '../core/renderer-api.ts'
import { Renderer } from './renderer.ts'

export type { RendererAPI }

/**
 * Async factory — no constructor+init smell.
 * In Phase 2+: compiles initial shader programs, warms the WebGL context.
 * In Phase 3+: accepts OffscreenCanvas for worker-mode rendering.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
): Promise<RendererAPI> {
  return new Renderer(canvas)
}
```

- [ ] **Step 4: Run integration test — expect PASS**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/integration.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Run the full mini test suite**

Run: `node_modules/.bin/vitest run --config vitest.config.unit.ts src/mini/`
Expected: PASS — all tests in `src/mini/` pass. (Pre-existing failures in other parts of the repo are unrelated and expected.)

- [ ] **Step 6: Commit**

```bash
git add src/mini/renderer/index.ts src/mini/integration.test.ts
git commit -m "feat(mini): add createRenderer factory and Phase 1 integration test"
```

---

## Done: Phase 1 Complete

All tests pass. The architecture is proven end-to-end:

- **Tier 1** (`MapGL`, `CameraController`) is isolated from rendering — testable with a mock renderer
- **Tier 2** (`Renderer`, `FrameLoop`, `WebGLContext`, `StyleEvaluator`, `RenderExtensions`) is independently testable
- **BackgroundLayer** is self-contained — no registry, no factory, just a class
- **No layer-type branching in core** — `Renderer` detects draw capability via duck-typing (`drawBackground` method presence)
- **Plugin system** wires `ElevationProvider` (Tier 1) and `RenderExtension` (Tier 2) via duck-typing
- **createRenderer** is an async factory — no constructor+init smell

### Phase 2 work items (for the next plan)
- `TileManager` — tile visibility, fetch, eviction
- `RasterLayer` — fetch + draw raster tiles via `gl.texImage2D`
- `VectorTileService` — MVT decode + tessellation with earcut
- `FillLayer` — per-tile fill draw with real vertex shaders
- `@bigmistqke/view.gl` integration in `WebGLContext`
- `ImageAtlas` + `LineDashAtlas` on `DrawContext`
