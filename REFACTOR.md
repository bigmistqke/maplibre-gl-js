# Pluggable MapLibre: Architecture Design

## Problem Statement

MapLibre GL JS is monolithic. Every source type, layer type, draw function, shader, and shared service (image atlas, glyph manager, collision system) is eagerly imported and initialized, regardless of whether the consumer uses it. The code is organized by technical concern (sources in `src/source/`, layers in `src/style/style_layer/`, draw functions in `src/render/`, shaders in `src/shaders/`) rather than by logical feature. A "fill layer" is actually a vertical slice across 6+ directories, but nothing in the architecture reflects this.

## Design Principles

1. **One composition model.** There is a single primitive — the `Feature` — and a single composition mechanism: pass features to `createMap({ use: [...] })`. No side-effect imports, no global registries, no multiple registration APIs.
2. **Features are vertical slices.** A feature bundles everything it needs: source, layer, bucket, draw function, programs, shaders, services. The consumer doesn't know or care about these internals.
3. **Explicit opt-in, no implicit bundling.** `feature()` gives you the minimal core of that feature. Sub-features add capabilities. Nothing is imported unless the consumer asks for it. Tree-shaking works because unused exports aren't referenced.
4. **Core is minimal.** Map, Camera, Transform, Projections, WebGL Context, Program infrastructure, Style parser skeleton, Tile management, Worker/Dispatcher. Nothing else.
5. **Shared services are lazy and de-duped.** If multiple features need ImageManager, the first one to initialize creates it. Others reuse it.

---

## Architecture Overview

```
                    ┌─────────────────────────────┐
                    │     features.ts              │
                    │                              │
                    │  Shared feature config —     │
                    │  imported by both main       │
                    │  and worker entry points     │
                    │                              │
                    │  export const features = [   │
                    │    vectorTiles(),            │
                    │    raster(),                 │
                    │    fill(patterns),           │
                    │    labels(text, collision),  │
                    │  ]                           │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────┼───────────────┐
                    │                          │
                    ▼                          ▼
    ┌───────────────────────┐  ┌───────────────────────┐
    │      main.ts          │  │     worker.ts          │
    │                       │  │                        │
    │  createMap({          │  │  createWorker(features) │
    │    use: features,     │  │                        │
    │    worker: workerUrl, │  │  Uses: Buckets,        │
    │    ...                │  │  WorkerSources,        │
    │  })                   │  │  TileProcessors        │
    │                       │  │                        │
    │  Uses: draw funcs,    │  └───────────────────────┘
    │  programs, shaders,   │
    │  services             │
    └───────────────────────┘

    Tree-shaking at the FEATURE level:
    If features.ts doesn't import labels,
    the entire symbol subsystem is excluded
    from BOTH bundles.
```

---

## 1. The Feature Primitive

Everything is a `Feature`. A Feature is a plain object that declares what it contributes:

```typescript
interface Feature {
    // Source types this feature provides
    sources?: Record<string, SourceDefinition>;

    // Layer types this feature provides
    layers?: Record<string, LayerDefinition>;

    // Shader programs this feature uses
    programs?: Record<string, ProgramDefinition>;

    // Worker-side source implementations
    workerSources?: Record<string, WorkerSourceDefinition>;

    // Worker-side tile processing hooks
    tileProcessors?: TileProcessorDefinition[];
}

interface LayerDefinition {
    StyleLayer: typeof StyleLayer;
    Bucket?: typeof Bucket;
    // Factory that receives MapContext for dependency resolution (upsert pattern)
    // Returns the draw function with dependencies captured in closure
    createDraw: (context: MapContext) => DrawFunction;
}
```

Features are created by **factory functions**. The factory takes optional sub-features as arguments for granular tree-shaking:

```typescript
// feature() = minimal core, sub-features add capabilities
export function fill(...capabilities: Feature[]): Feature {
    return merge(fillBase, ...capabilities);
}

// Sub-features are also Features
export const patterns: Feature = {
    services: [imageManagerService],
    tileProcessors: [imageAtlasProcessor],
};
```

### Composition

Features compose naturally — a preset is just an array of Features:

```typescript
export const standardMap: Feature[] = [
    vectorTiles(),
    raster(),
    fill(patterns),
    line(dashes, gradients),
    circle(),
    labels(text, icons, collision),
    background(patterns),
];
```

`createMap` flattens and merges all features:

```typescript
// These are equivalent:
createMap({ use: standardMap, ... });
createMap({ use: [vectorTiles(), raster(), fill(patterns), ...], ... });
```

---

## 2. Feature Catalog

### Rendering Features

Each bundles: source (if needed) + layer type + bucket + draw function + programs + shaders.

| Feature | Factory | Sub-features | What it renders |
|---|---|---|---|
| **`raster`** | `raster(image?, video?, canvas?)` | `image`, `video`, `canvas` | Raster tiles. Sub-features add image/video/canvas source support. |
| **`fill`** | `fill(patterns?)` | `patterns` | Filled polygons. `patterns` adds ImageManager for fill-pattern. |
| **`line`** | `line(dashes?, gradients?)` | `dashes`, `gradients` | Lines/polylines. `dashes` adds LineAtlas. `gradients` adds gradient texture support. |
| **`circle`** | `circle()` | *(none)* | Circles at points. |
| **`labels`** | `labels(text?, icons?, collision?)` | `text`, `icons`, `collision` | Text labels and icons. `text` adds GlyphManager. `icons` adds ImageManager. `collision` adds Placement + CollisionIndex. |
| **`background`** | `background(patterns?)` | `patterns` | Background color/pattern. |
| **`heatmap`** | `heatmap()` | *(none)* | Point density heatmaps. Uses FBO. |
| **`fillExtrusion`** | `fillExtrusion(patterns?)` | `patterns` | 3D extruded polygons. |
| **`sky`** | `sky()` | *(none)* | Sky/atmosphere rendering. |
| **`custom`** | `custom()` | *(none)* | Custom WebGL layer interface. |

### Source Features

Data-only features that provide data for rendering features to consume.

| Feature | Factory | What it provides |
|---|---|---|
| **`vectorTiles`** | `vectorTiles()` | Vector tile source + worker source. Feeds fill, line, circle, labels, heatmap, fillExtrusion. |
| **`geojson`** | `geojson()` | GeoJSON source + worker source. Feeds same layers as vectorTiles. |

### Elevation Features

Features that depend on DEM (digital elevation model) data.

| Feature | Factory | What it provides |
|---|---|---|
| **`elevation`** | `elevation(hillshade?, colorRelief?, terrain?)` | RasterDEM source + worker. Sub-features add rendering capabilities. |
| `hillshade` | sub-feature of elevation | Hillshade layer + draw + programs. |
| `colorRelief` | sub-feature of elevation | Color relief layer + draw + programs. |
| `terrain` | sub-feature of elevation | 3D terrain (render-to-texture, depth buffer). Deeply integrated with Painter. |

---

## 3. Anatomy of a Feature

### Simple feature: `circle`

No sub-features, no service dependencies. The smallest possible feature:

```typescript
// maplibre-mini/circle/index.ts
import { CircleStyleLayer } from '../style/style_layer/circle_style_layer';
import { CircleBucket } from '../data/bucket/circle_bucket';
import { drawCircle } from '../render/draw_circle';
import { circleUniforms } from '../render/program/circle_program';
import circleVert from '../shaders/circle.vertex.glsl';
import circleFrag from '../shaders/circle.fragment.glsl';
import type { Feature } from '../core/feature';

export function circle(): Feature {
    return {
        layers: {
            circle: {
                StyleLayer: CircleStyleLayer,
                Bucket: CircleBucket,
                draw: drawCircle,
            }
        },
        programs: {
            circle: { uniforms: circleUniforms, vert: circleVert, frag: circleFrag },
        },
    };
}
```

### Feature with sub-features: `fill`

Sub-features are optional capabilities that add service dependencies:

```typescript
// maplibre-mini/fill/index.ts
import { FillStyleLayer } from '../style/style_layer/fill_style_layer';
import { FillBucket } from '../data/bucket/fill_bucket';
import { drawFill } from '../render/draw_fill';
import { fillUniforms, fillOutlineUniforms } from '../render/program/fill_program';
import fillVert from '../shaders/fill.vertex.glsl';
import fillFrag from '../shaders/fill.fragment.glsl';
// ... more shader imports
import type { Feature } from '../core/feature';
import { merge } from '../core/merge';

const fillBase: Feature = {
    layers: {
        fill: {
            StyleLayer: FillStyleLayer,
            Bucket: FillBucket,
            draw: drawFill,
        }
    },
    programs: {
        fill:        { uniforms: fillUniforms, vert: fillVert, frag: fillFrag },
        fillOutline: { uniforms: fillOutlineUniforms, vert: fillOutlineVert, frag: fillOutlineFrag },
    },
};

export function fill(...capabilities: Feature[]): Feature {
    return merge(fillBase, ...capabilities);
}

// --- Sub-feature: patterns (separate export, tree-shakeable) ---
// Only imported if the consumer explicitly uses it

import { fillPatternUniforms, fillOutlinePatternUniforms } from '../render/program/fill_program';
import fillPatternVert from '../shaders/fill_pattern.vertex.glsl';
import fillPatternFrag from '../shaders/fill_pattern.fragment.glsl';
import { imageManagerService } from '../services/image_manager_service';
import { imageAtlasProcessor } from '../services/image_atlas_processor';

export const patterns: Feature = {
    services: [imageManagerService],
    tileProcessors: [imageAtlasProcessor],
    programs: {
        fillPattern:        { uniforms: fillPatternUniforms, vert: fillPatternVert, frag: fillPatternFrag },
        fillOutlinePattern: { uniforms: fillOutlinePatternUniforms, vert: fillOutlinePatternVert, frag: fillOutlinePatternFrag },
    },
};
```

**Tree-shaking**: if the consumer does `fill()` without `patterns`, the bundler removes `patterns` and everything it imports (ImageManager, pattern shaders, image atlas processor).

### Bundled feature: `raster`

Raster bundles source + layer because they're inseparable:

```typescript
// maplibre-mini/raster/index.ts
import { RasterTileSource } from '../source/raster_tile_source';
import { RasterStyleLayer } from '../style/style_layer/raster_style_layer';
import { drawRaster } from '../render/draw_raster';
import { rasterUniforms } from '../render/program/raster_program';
import rasterVert from '../shaders/raster.vertex.glsl';
import rasterFrag from '../shaders/raster.fragment.glsl';
import type { Feature } from '../core/feature';
import { merge } from '../core/merge';

const rasterBase: Feature = {
    sources: {
        raster: { Source: RasterTileSource },
    },
    layers: {
        raster: {
            StyleLayer: RasterStyleLayer,
            draw: drawRaster,
            // No Bucket — raster tiles are pre-rendered images
        }
    },
    programs: {
        raster: { uniforms: rasterUniforms, vert: rasterVert, frag: rasterFrag },
    },
};

export function raster(...capabilities: Feature[]): Feature {
    return merge(rasterBase, ...capabilities);
}

// --- Sub-features: additional source types ---

export { image } from './image';     // ImageSource support
export { video } from './video';     // VideoSource support
export { canvas } from './canvas';   // CanvasSource support
```

### Complex feature: `labels`

The largest feature, with multiple sub-features:

```typescript
// maplibre-mini/labels/index.ts
import { SymbolStyleLayer } from '../style/style_layer/symbol_style_layer';
import { SymbolBucket } from '../data/bucket/symbol_bucket';
import { drawSymbol } from '../render/draw_symbol';
import { symbolIconUniforms } from '../render/program/symbol_program';
import symbolIconVert from '../shaders/symbol_icon.vertex.glsl';
import symbolIconFrag from '../shaders/symbol_icon.fragment.glsl';
import type { Feature } from '../core/feature';
import { merge } from '../core/merge';

const labelsBase: Feature = {
    layers: {
        symbol: {
            StyleLayer: SymbolStyleLayer,
            Bucket: SymbolBucket,
            draw: drawSymbol,
        }
    },
    programs: {
        symbolIcon: { uniforms: symbolIconUniforms, vert: symbolIconVert, frag: symbolIconFrag },
    },
};

export function labels(...capabilities: Feature[]): Feature {
    return merge(labelsBase, ...capabilities);
}

// --- Sub-features (separate exports, tree-shakeable) ---

export { text } from './text';           // GlyphManager + SDF shaders + glyph atlas processor
export { icons } from './icons';         // ImageManager (shared)
export { collision } from './collision'; // Placement + CollisionIndex + CrossTileSymbolIndex
```

Where each sub-feature file imports only what it needs:

```typescript
// maplibre-mini/labels/text.ts
import { glyphManagerService } from '../services/glyph_manager_service';
import { glyphAtlasProcessor } from '../services/glyph_atlas_processor';
import { symbolSDFUniforms } from '../render/program/symbol_program';
import symbolSDFVert from '../shaders/symbol_sdf.vertex.glsl';
import symbolSDFFrag from '../shaders/symbol_sdf.fragment.glsl';
import type { Feature } from '../core/feature';

export const text: Feature = {
    services: [glyphManagerService],
    tileProcessors: [glyphAtlasProcessor],
    programs: {
        symbolSDF: { uniforms: symbolSDFUniforms, vert: symbolSDFVert, frag: symbolSDFFrag },
    },
};
```

---

## 4. How the Core Processes Features

### `createMap` merges all features

```typescript
function createMap(options: MapOptions & { use: Feature[] }): Map {
    // 1. Flatten and merge all features into a single FeatureConfig
    const config = mergeFeatures(options.use);

    // 2. Create Map with the merged config
    return new Map({
        ...options,
        _featureConfig: config,
    });
}

function mergeFeatures(features: Feature[]): MergedFeatureConfig {
    const merged: MergedFeatureConfig = {
        sources: {},
        layers: {},
        services: [],  // de-duped by identity
        programs: {},
        workerSources: {},
        tileProcessors: [],
    };

    for (const feature of features) {
        if (feature.sources) Object.assign(merged.sources, feature.sources);
        if (feature.layers) Object.assign(merged.layers, feature.layers);
        if (feature.programs) Object.assign(merged.programs, feature.programs);
        if (feature.workerSources) Object.assign(merged.workerSources, feature.workerSources);
        if (feature.services) {
            for (const svc of feature.services) {
                if (!merged.services.includes(svc)) merged.services.push(svc);
            }
        }
        if (feature.tileProcessors) {
            for (const proc of feature.tileProcessors) {
                if (!merged.tileProcessors.includes(proc)) merged.tileProcessors.push(proc);
            }
        }
    }

    return merged;
}
```

### Style uses merged config for instantiation

```typescript
// In Style — no more switch statements
class Style {
    _createLayer(spec: LayerSpecification): StyleLayer {
        const def = this._featureConfig.layers[spec.type];
        if (!def) {
            throw new Error(
                `Layer type "${spec.type}" is not available. ` +
                `Add the corresponding feature to createMap({ use: [...] }).`
            );
        }
        return new def.StyleLayer(spec);
    }

    _createSource(id: string, spec: SourceSpecification): Source {
        const def = this._featureConfig.sources[spec.type];
        if (!def) {
            throw new Error(
                `Source type "${spec.type}" is not available. ` +
                `Add the corresponding feature to createMap({ use: [...] }).`
            );
        }
        return new def.Source(id, spec, this.dispatcher, this);
    }
}
```

### Painter uses merged config for rendering

```typescript
class Painter {
    renderLayer(layer: StyleLayer, tileManager: TileManager, coords: OverscaledTileID[]) {
        const def = this._featureConfig.layers[layer.type];
        if (!def?.draw) return;
        def.draw(this, tileManager, layer, coords, this._renderOptions);
    }

    getProgram(name: string, ...args): Program {
        const def = this._featureConfig.programs[name];
        if (!def) throw new Error(`Program "${name}" not registered by any feature.`);
        return this._createOrGetCachedProgram(name, def, ...args);
    }
}
```

### MapContext: shared state via upsert

No service container, no service definitions. Features create shared dependencies via `context.ensure()` — an upsert: create if first, reuse if exists.

```typescript
class MapContext {
    private _instances = new Map<any, any>();

    // Upsert: return existing instance or create new one
    ensure<T>(key: new (...args: any[]) => T, factory: () => T): T {
        if (!this._instances.has(key)) {
            this._instances.set(key, factory());
        }
        return this._instances.get(key);
    }

    // Lifecycle: call beginFrame on all created instances
    beginFrame(): void {
        for (const instance of this._instances.values()) {
            if (typeof instance.beginFrame === 'function') instance.beginFrame();
        }
    }

    destroy(): void {
        for (const instance of this._instances.values()) {
            if (typeof instance.destroy === 'function') instance.destroy();
        }
    }
}
```

Features use it during initialization via `createDraw`:

```typescript
export function fill(): Feature {
    return {
        layers: {
            fill: {
                StyleLayer: FillStyleLayer,
                Bucket: FillBucket,
                createDraw: (context: MapContext) => {
                    const imageManager = context.ensure(ImageManager, () => new ImageManager());
                    return (painter, tm, layer, coords) => {
                        drawFill(painter, tm, layer, coords, imageManager);
                    };
                },
            }
        },
        programs: { ... },
    };
}
```

When `labels()` also calls `context.ensure(ImageManager, ...)`, it gets the same instance. First feature creates, rest reuse. Class constructor is the key — no strings.

---

## 5. Worker Architecture

### Shared feature config — one config, two entry points

The key insight: the consumer creates ONE feature config in a shared module. Both the main thread and the worker import it. The bundler handles code-splitting automatically.

```typescript
// features.ts — the shared config
import { fill, patterns } from 'maplibre-mini/fill';
import { vectorTiles } from 'maplibre-mini/vt';
import { raster } from 'maplibre-mini/raster';
import { labels, text, collision } from 'maplibre-mini/labels';
import { background } from 'maplibre-mini/background';

export const features = [
    vectorTiles(), raster(), fill(patterns), labels(text, collision), background()
];
```

```typescript
// main.ts — main thread entry
import { createMap } from 'maplibre-mini';
import { features } from './features';

const map = createMap({
    use: features,
    worker: new URL('./worker.ts', import.meta.url),  // explicit worker URL
    container: 'map',
    style: '...',
});
```

```typescript
// worker.ts — worker thread entry
import { createWorker } from 'maplibre-mini/worker';
import { features } from './features';

createWorker(features);
```

### How `createWorker` works

```typescript
// maplibre-mini/worker/index.ts
export function createWorker(features: Feature[]) {
    const config = mergeFeatures(features);

    const worker = new WorkerRuntime(config);
    // Worker registers message handlers based on config
    // - loadTile: uses config.layers[type].Bucket for bucket creation
    // - Worker sources from config.workerSources
    // - Tile processors from config.tileProcessors

    worker.start();  // begins listening for messages from main thread
}
```

### Tree-shaking

Tree-shaking happens at the **feature level**: if `features.ts` doesn't import `labels`, neither the main bundle nor the worker bundle includes SymbolBucket, symbol layout, GlyphManager, collision system, or SDF shaders.

Within a feature, both main-thread code (draw functions, shaders) and worker code (buckets, worker sources) are in the shared chunk. This is a small overhead — the big savings come from excluding entire features.

### Worker source resolution

```typescript
class WorkerRuntime {
    _getWorkerSource(sourceType: string): WorkerSource {
        const def = this._config.workerSources[sourceType];
        if (!def) throw new Error(`Worker source "${sourceType}" not available.`);
        return new def.WorkerSource(this._actor, this._layerIndex, this._availableImages);
    }
}
```

### Tile processor pipeline

```typescript
// worker_tile.ts:parse() — pluggable pipeline
async parse(data, layerIndex, actor) {
    const buckets = this.populateBuckets(data, layerIndex);

    for (const processor of this._config.tileProcessors) {
        const result = await processor.process(this, buckets, actor);
        Object.assign(this._result, result);
    }

    return { buckets, ...this._result };
}
```

### `createStyleLayer` in the worker

The worker needs `createStyleLayer()` for the `StyleLayerIndex`. With the feature config, this becomes:

```typescript
// Instead of a switch statement, use the merged config
function createStyleLayer(spec: LayerSpecification, config: MergedFeatureConfig): StyleLayer {
    const def = config.layers[spec.type];
    if (!def) throw new Error(`Layer type "${spec.type}" not in feature config.`);
    return new def.StyleLayer(spec);
}
```

---

## 6. Usage Examples

Every example follows the same pattern: features.ts (shared config) + main.ts + worker.ts.

### Minimal raster globe

```typescript
// features.ts
import { raster } from 'maplibre-mini/raster';
import { background } from 'maplibre-mini/background';
export const features = [raster(), background()];
```

```typescript
// main.ts
import { createMap } from 'maplibre-mini';
import { features } from './features';

const map = createMap({
    use: features,
    worker: new URL('./worker.ts', import.meta.url),
    container: 'map',
    projection: 'globe',
    style: {
        version: 8,
        sources: {
            osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 }
        },
        layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#001122' } },
            { id: 'osm', type: 'raster', source: 'osm' }
        ]
    }
});

map.easeTo({ center: [10, 50], zoom: 3, pitch: 40, bearing: 20 });
```

```typescript
// worker.ts
import { createWorker } from 'maplibre-mini/worker';
import { features } from './features';
createWorker(features);
```

### Full vector tile map (using preset)

```typescript
// features.ts
export { standardMap as features } from 'maplibre-mini/presets';
```

```typescript
// main.ts
import { createMap } from 'maplibre-mini';
import { features } from './features';

const map = createMap({
    use: features,
    worker: new URL('./worker.ts', import.meta.url),
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json'
});
```

```typescript
// worker.ts
import { createWorker } from 'maplibre-mini/worker';
import { features } from './features';
createWorker(features);
```

### Data visualization (fills + circles, no labels)

```typescript
// features.ts
import { vectorTiles } from 'maplibre-mini/vt';
import { fill } from 'maplibre-mini/fill';
import { circle } from 'maplibre-mini/circle';
import { background } from 'maplibre-mini/background';

export const features = [vectorTiles(), fill(), circle(), background()];
// No labels → no GlyphManager, no collision, no SDF shaders in bundle
```

### Labels with text only, no collision

```typescript
// features.ts
import { vectorTiles } from 'maplibre-mini/vt';
import { fill } from 'maplibre-mini/fill';
import { labels, text } from 'maplibre-mini/labels';
import { background } from 'maplibre-mini/background';

export const features = [vectorTiles(), fill(), labels(text), background()];
// No collision detection, no icon rendering — text labels may overlap but smaller bundle
```

---

## 7. What Lives Where

### Core (always bundled)

```
src/core/
  feature.ts                 — Feature type definition
  merge.ts                   — mergeFeatures() function
  create_map.ts              — createMap() entry point

src/ui/
  map.ts                     — Map class (stripped: no handlers, no controls)
  camera.ts                  — Camera base class

src/geo/
  projection/                — all projection code (mercator, globe, vertical-perspective)
  lng_lat.ts, edge_insets.ts, mercator_coordinate.ts, ...

src/render/
  painter.ts                 — Painter (reads merged config, no hardcoded imports)
  program.ts                 — Program class (creates programs from config definitions)
  context.ts                 — WebGL context wrapper
  mesh.ts, subdivision.ts    — geometry infrastructure

src/style/
  style.ts                   — Style (reads merged config for layer/source creation)
  style_layer.ts             — StyleLayer base class

src/tile/
  tile.ts, tile_manager.ts, tile_id.ts, tile_cache.ts

src/source/
  source.ts                  — Source interface only
  worker.ts                  — Worker (reads merged config)
  worker_tile.ts             — WorkerTile (runs tile processors from config)

src/data/
  bucket.ts                  — Bucket interface only
  (shared: array types, feature index, etc.)

src/util/
  (evented, dispatcher, actor, etc.)
```

### Features (tree-shakeable, each a separate entry point)

```
maplibre-mini/raster       → raster(image?, video?, canvas?)
maplibre-mini/fill         → fill(patterns?)
maplibre-mini/line         → line(dashes?, gradients?)
maplibre-mini/circle       → circle()
maplibre-mini/labels       → labels(text?, icons?, collision?)
maplibre-mini/background   → background(patterns?)
maplibre-mini/heatmap      → heatmap()
maplibre-mini/fill-extrusion → fillExtrusion(patterns?)
maplibre-mini/sky          → sky()
maplibre-mini/custom       → custom()
maplibre-mini/vt           → vectorTiles()
maplibre-mini/geojson      → geojson()
maplibre-mini/elevation    → elevation(hillshade?, colorRelief?, terrain?)
```

### Presets (convenience bundles)

```
maplibre-mini/presets
  standardMap     — vectorTiles + raster + fill(patterns) + line(dashes, gradients) + circle + labels(text, icons, collision) + background(patterns)
  rasterOnly      — raster + background
  dataViz         — vectorTiles + fill + circle + background
  all             — everything (equivalent to current maplibre)
```

---

## 8. Migration Path

### MVP Approach
Features are complete units (no sub-features yet). The architecture supports sub-features via the `merge()` pattern, but for the MVP each feature factory returns a full feature with all capabilities included. Sub-feature splitting is a later optimization.

### Phase 1: Feature infrastructure
Create `Feature` type, `merge()`, `createMap()`, `createWorker()`. Wire up `Map` to accept merged config.

### Phase 2: Extract simplest feature — `raster`
Prove the pattern works end-to-end: raster source + raster layer + draw function + programs, all declared as a Feature and consumed via `createMap({ use: [raster()] })`.

### Phase 3: Extract remaining features one by one
Order: circle → background → fill → line → labels → heatmap → fillExtrusion → sky → custom → elevation.

### Phase 4: Extract services into ServiceContainer
Move ImageManager, GlyphManager, LineAtlas, Placement out of Style/Painter into the service system.

### Phase 5: Remove old code paths
Delete switch statements, static imports, hardcoded draw function dispatch.

### Phase 6: Strip UI for maplibre-mini
Remove handlers, controls, Marker, Popup, Hash.

### Phase 7: Build system
Configure rollup/package.json for sub-path exports. ESM output for tree-shaking.

### Phase 8 (future): Sub-feature splitting
Split features into base + sub-features for granular tree-shaking. E.g., `fill()` → `fill(patterns)`, `labels()` → `labels(text, icons, collision)`. Add `enablesProperties` validation.

---

## 9. Feature Composition Map

### Full composition tree

```
feature()                    base                        sub-features add...
─────────────────────────────────────────────────────────────────────────────

fill()                       solid fills
  + patterns                   + fill-pattern support
                               + programs: fillPattern, fillOutlinePattern
                               + service: ImageManager
                               + enables: fill-pattern property

line()                       solid lines
  + dashes                     + line-dasharray support
                               + programs: lineSDF
                               + service: LineAtlas
                               + enables: line-dasharray property
  + gradients                  + line-gradient support
                               + programs: lineGradient, lineGradientSDF
                               + enables: line-gradient property
  + patterns                   + line-pattern support
                               + programs: linePattern
                               + service: ImageManager
                               + enables: line-pattern property

circle()                     circles (no sub-features)

labels()                     symbol layout base
  + text                       + SDF text rendering
                               + programs: symbolSDF, symbolTextAndIcon
                               + service: GlyphManager
                               + enables: text-field property
  + icons                      + icon rendering
                               + programs: symbolIcon
                               + service: ImageManager
                               + enables: icon-image property
  + collision                  + placement & collision detection
                               + service: Placement + CrossTileSymbolIndex

raster()                     raster tiles
  + image                      + ImageSource support
  + video                      + VideoSource support
  + canvas                     + CanvasSource support

background()                 solid background
  + patterns                   + background-pattern support
                               + programs: backgroundPattern
                               + service: ImageManager
                               + enables: background-pattern property

heatmap()                    heatmaps (no sub-features)
fillExtrusion()              3D extrusions
  + patterns                   + fill-extrusion-pattern support

sky()                        sky/atmosphere (no sub-features)
custom()                     custom WebGL (no sub-features)

elevation()                  raster-dem source
  + hillshade                  + hillshade layer
  + colorRelief                + color relief layer
  + terrain                    + 3D terrain rendering

vectorTiles()                vector tile source (no sub-features)
geojson()                    geojson source (no sub-features)
```

### Service dependency graph (de-duped by identity)

```
ImageManager  ←  fill(patterns), line(patterns), background(patterns),
                 fillExtrusion(patterns), labels(icons)

GlyphManager  ←  labels(text)
LineAtlas     ←  line(dashes)
Placement     ←  labels(collision)
```

### Style validation eliminates null-checks

**At style load time**, the merged feature config is validated against the style:

- Every source `type` in the style must have a matching source in the config
- Every layer `type` in the style must have a matching layer in the config
- Every paint/layout property used must be enabled by a sub-feature in the config

If the style uses `line-dasharray` but `line(dashes)` wasn't included → **error at style load**:
```
Error: Property "line-dasharray" requires the "dashes" capability.
Add it: line(dashes) in your feature config.
```

**Consequence**: draw functions never need null-checks. If a draw function is called, all its services and programs are guaranteed to exist. The style validation already ensured consistency.

```typescript
// No null checks — services are injected, guaranteed present
function drawLine(painter, tileManager, layer, coords, services: {
    lineAtlas: LineAtlas,     // guaranteed by line(dashes)
    imageManager: ImageManager // guaranteed by line(patterns)
}) {
    // Style-driven program selection — all programs guaranteed registered
    if (layer.paint.get('line-pattern')) {
        useProgram('linePattern');
    } else if (layer.paint.get('line-dasharray')) {
        useProgram('lineSDF');
    } else {
        useProgram('line');
    }
}
```

### How services reach draw functions

Services are resolved at initialization time (not per-frame) and injected via closure:

```typescript
// At feature initialization, after style validation
const lineServices = resolveServices(lineRegistration.services);
// lineServices.lineAtlas is LineAtlas (non-null, guaranteed)
// lineServices.imageManager is ImageManager (non-null, guaranteed)

// The draw function captures services in closure
const draw = (painter, tileManager, layer, coords) => {
    drawLine(painter, tileManager, layer, coords, lineServices);
};
```

---

## 10. Open Questions

1. **Style-spec validation**: The `@maplibre/maplibre-gl-style-spec` package validates layer/source types against a fixed list. Need to make validation aware of features in the config, or skip validation for types present in the merged config.

2. **Terrain as a feature**: Terrain is deeply integrated with Painter (render-to-texture, depth buffer, coordinate offsets in every draw call). Making it a clean sub-feature of `elevation` requires extracting a terrain interface that Painter checks for. Already partially null-guarded.

3. **Worker registry isolation**: The current implementation uses a global worker registry (`getWorkerRegistry()`). This works because:
   - The Worker is a singleton per web worker (`self.worker`)
   - Workers are pooled globally (`globalWorkerPool`)
   - Worker sources are keyed by `mapId/sourceType/sourceName`
   - In practice, all maps on a page typically use the same features
   - Tree-shaking happens at build time anyway

   However, this assumes all `Map` instances use the same feature set. If a consumer wanted two maps with different feature sets (e.g., one raster-only, one with vectors), the current architecture doesn't support that — the worker would have whichever features were registered first/last.

   A cleaner approach would be to store registries per `mapId` in the worker and have each map send its feature configuration during initialization. This adds complexity but provides true isolation. For now, we document the constraint: **all maps on a page must use the same feature set.**

4. **`patterns` as shared sub-feature**: `fill(patterns)`, `line(patterns)`, `background(patterns)`, `fillExtrusion(patterns)` — `patterns` provides the ImageManager service (shared, de-duped). Each layer provides its own pattern-specific programs and shaders. The `patterns` sub-feature imported from `maplibre-mini/fill` would include fill-pattern programs; from `maplibre-mini/line` would include line-pattern programs.

5. **Labels decomposition (future)**: Currently `labels` is a single feature. A future refactor could split SymbolBucket into separate text-only and icon-only modes, allowing `labels(text)` to skip all icon code paths. This requires SymbolBucket refactoring.

6. **No-bundler usage**: The `features.ts + main.ts + worker.ts` pattern works great with modern bundlers (Vite, Rollup, Webpack). For consumers without a bundler (CDN script tags), we'd need a pre-built `maplibre-mini.js` that includes all features (equivalent to the `all` preset).

7. **API methods depend on features — typing strategy needed**: Many public API methods on `Map` and `Style` depend on specific features being registered:

   - `map.addImage()`, `map.removeImage()`, `map.getImage()`, `map.listImages()` → require ImageManager (provided by patterns sub-features, labels with icons)
   - `map.setGlyphs()` → requires GlyphManager (provided by labels with text)
   - Line dash rendering → requires LineAtlas (provided by line with dashes)
   - `map.queryRenderedFeatures()` for specific layer types → requires those layer features

   Options for typing:
   - **Runtime errors**: Methods throw if required feature not registered. Simple but no compile-time safety.
   - **Conditional types**: `createMap<F extends Feature[]>()` returns a `Map` type with only the methods available for those features. Complex generics.
   - **Separate APIs**: Image methods live on an `ImageManager` accessed via `map.images.add()`. Only available if feature registered. Explicit but API change.
   - **Assertion helpers**: `map.requireImages().addImage()` — user explicitly asserts the feature is present.

   Need to map out all feature-dependent APIs and choose a strategy. For MVP, runtime errors with helpful messages may be sufficient.

8. **Shared instances (ImageManager, GlyphManager, LineAtlas) as feature dependencies**: ✅ IMPLEMENTED. Features declare manager classes they need, FeatureRegistry provides them to Style for instantiation.

   ```typescript
   // Feature declares managers it needs
   import {ImageManager, GlyphManager} from '../core/feature';

   export const symbolBase: Feature = {
       managers: {ImageManager, GlyphManager},
       programs: { ... }
   };
   ```

   Style gets classes from registry and creates instances:
   ```typescript
   // Style constructor - gets class from registry, creates if provided
   const ImageManagerClass = this._featureRegistry.getManager('ImageManager');
   if (ImageManagerClass) {
       this.imageManager = new ImageManagerClass();
       this.imageManager.setEventedParent(this);
   }
   ```

   Painter retrieves from style:
   ```typescript
   this.imageManager = style.imageManager;
   ```

   Type-safe registry with inference:
   ```typescript
   interface ManagerMap {
       ImageManager: typeof ImageManager;
       GlyphManager: typeof GlyphManager;
       LineAtlas: typeof LineAtlas;
   }

   getManager<K extends ManagerName>(name: K): ManagerMap[K] | undefined
   ```

   Benefits:
   - Features are declarative — they provide the class itself
   - Style doesn't import manager classes directly — gets them from registry (tree-shaking friendly)
   - Type-safe — `getManager('ImageManager')` returns `typeof ImageManager | undefined`
   - Instantiation logic stays in Style where it already lives, just made conditional

   **Future consideration**: Currently instances live on Style (`style.imageManager`, etc.) for backward compatibility. A cleaner design would have FeatureRegistry be the sole owner of feature-provided instances, making Style's core smaller and all feature-specific state accessed uniformly via the registry.

   The typing question (#7) determines whether missing dependencies are a compile-time or runtime concern.

---

## 11. Implementation Status

### What's done (Phase 1 + 2 + 3)

**Core infrastructure:**
- `src/core/feature.ts` — `Feature` interface, `merge()`, `FeatureRegistry` class
- `src/core/map_context.ts` — `MapContext` with `ensure<T>(key, factory)` upsert
- `src/core/create_map.ts` — `createMap({ use: [...] })` entry point
- `src/core/create_worker.ts` — `createWorker()` placeholder

**All layer features extracted:**
- `src/features/raster.ts` — raster()
- `src/features/background.ts` — background()
- `src/features/circle.ts` — circle()
- `src/features/fill.ts` — fill()
- `src/features/line.ts` — line()
- `src/features/fill_extrusion.ts` — fillExtrusion()
- `src/features/heatmap.ts` — heatmap()
- `src/features/hillshade.ts` — hillshade()
- `src/features/color_relief.ts` — colorRelief()
- `src/features/symbol.ts` — labels()
- `src/features/sky.ts` — sky() (programs only, no layer — sky is rendered outside the layer loop)

**Modified core files:**
- `src/style/style.ts` — `_createStyleLayer()` uses `registry.getLayer(type)` instead of `createStyleLayer` switch
- `src/render/painter.ts` — `renderLayer()` uses `registry.getLayer(type).draw()` instead of if/else chain. Only custom layers remain special-cased (they're user-provided, not feature-registered).
- `src/source/source.ts` — `create()` uses `registry.getSource(type)` instead of `getSourceType` switch. `addSourceType` and `registeredSources` removed.
- `src/tile/tile_manager.ts` — Constructor takes `FeatureRegistry`, passes to source creation.
- `src/ui/map.ts` — `MapOptions._featureRegistry` required, stored on Map, threaded to Style.

### Key design decisions that differ from the original plan

1. **`FeatureRegistry` class instead of plain `MergedFeatureConfig` object.** All access goes through typed getters (`getLayer`, `getSource`, `getProgram`) that produce helpful error messages naming the exact feature function to call. The raw config is private — no direct property access possible. This follows the harvestry pattern from maplibre-main.

2. **Clean cut, no backwards compatibility.** `_featureRegistry` is required on `MapOptions` — old `new Map()` calls without it will fail. The entry point is `createMap()`. Test files that construct Map directly are expected to break.

3. **No `createDraw` / `MapContext` used yet.** The plan called for `createDraw: (context: MapContext) => DrawFunction` for lazy service initialization. Currently features just provide a `draw` function directly. `MapContext` exists but isn't wired in — it'll become relevant when services (ImageManager, GlyphManager, etc.) are extracted from Style.

4. **Symbol layer uses a wrapper.** `drawSymbols` needs `variableOffsets` which isn't in the standard `DrawFunction` signature. The symbol feature wraps it: `(painter, tm, layer, coords, opts) => drawSymbols(painter, tm, layer, coords, painter.style.placement.variableOffsets, opts)`. No special case in Painter.

5. **Custom layers are NOT features.** They're user-provided `CustomLayerInterface` implementations, handled by a hardcoded check in `_createStyleLayer` and `renderLayer`. This is correct — custom layers are the extension point for users, not something registered via features.

6. **`createStyleLayer` import kept for custom layers only.** The old `create_style_layer.ts` switch is still imported by `style.ts` but only used for `type === 'custom'`. All other types go through the registry.

7. **Error messages name the feature function.** E.g.: `Source type "raster" is not available. Add raster() to createMap({ use: [raster(), ...] }).` A hint map in `feature.ts` maps type names to feature function names.

### What's not done yet

1. ~~**`useProgram` not wired through registry.**~~ ✅ DONE. `painter.useProgram()` now uses `registry.hasProgram(name)` and `registry.getProgram(name)` to get shader source and uniforms from features. Core shaders (clippingMask, debug, depth, terrain*) fall back to the static `shaders` object.

2. ~~**Source features not extracted.**~~ ✅ DONE. `vectorTiles()`, `geojson()`, `elevation()` features created. Raster feature extended with `image`, `video`, `canvas` sub-features.

3. ~~**Worker not wired.**~~ ✅ PARTIALLY DONE. `createWorker()` now creates a global registry. Worker's `_getWorkerSource()` uses `getWorkerRegistry()` for source resolution. However, uses global state (see Open Question #3).

4. **Services still hardcoded in Style.** ImageManager, GlyphManager, LineAtlas, CrossTileSymbolIndex are eagerly created in `Style` constructor. They should be lazy via `MapContext.ensure()` and provided by features.

5. ~~**`Bucket` not used.**~~ ✅ DONE. All layer features with buckets now include `Bucket` in their layer definition (fill, line, circle, symbol, heatmap, fill_extrusion). `FeatureRegistry.getBucket()` method added.

6. **Sub-feature splitting not started.** All features include all their programs (e.g., fill includes fillPattern programs). The `merge()` pattern supports sub-features but no feature uses it yet.

7. ~~**Sky is programs-only.**~~ ✅ DONE. Sky feature now includes `renderHooks` with `beforeLayers` and `afterTranslucent` phases. `Painter.render()` uses `registry.getRenderHooks(phase)` instead of hardcoded `drawSky`/`drawAtmosphere` calls.

8. **Terrain deeply integrated.** `drawDepth`, `drawCoords`, `drawTerrain` are called at specific points in the render pipeline and interact with the depth buffer. Not easily featurized without a render pipeline abstraction.

9. ~~**Shaders not in features.**~~ ✅ DONE. All 11 feature files now import their shaders and use `prepare()` to create `shaderSource` in program definitions. `prepare()` exported from `shaders.ts`.
