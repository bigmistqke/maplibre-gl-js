// src/modular/layers/symbol/base/symbol-layer-base.ts

import {createDebug} from '@modular/debug.ts';
import type {RendererAPI, LayerInstance} from '@modular/core/renderer-api.ts';
import type {DrawContext, RenderContext} from '@modular/core/render-extension.ts';
import type {CameraState} from '@modular/core/types.ts';
import type {PlaceableLayer} from '@modular/layers/symbol/engine/layout-engine.ts';
import {SymbolEngine} from '@modular/layers/symbol/engine/symbol-engine.ts';
import type {TileFetcher} from '@modular/layers/symbol/base/tile-fetcher.ts';
import type {CollisionData, GPUBucket} from '@modular/layers/symbol/base/types.ts';
import type {LabelData} from '@modular/layers/symbol/engine/cross-tile-index.ts';
import {lngToTileX, latToTileY} from '@modular/renderer/mercator.ts';
import {TILE_SIZE} from '@modular/core/constants.ts';

const debug = createDebug?.('SymbolLayerBase', false);

export interface SymbolLayerOptions {
    source: string;
    sourceLayer: string;
    id?: string;
}

export abstract class SymbolLayerBase<T> implements LayerInstance, PlaceableLayer {
    readonly type = 'symbol';
    readonly source: string;
    readonly id?: string;
    readonly sourceLayer: string;

    /** Subclass-defined extent: 4096 for text, 8192 for icons, etc. */
    abstract readonly extent: number;

    protected _renderer: RendererAPI | null = null;
    protected _gl: WebGLRenderingContext | null = null;
    protected _engine: SymbolEngine | null = null;
    protected _markDirty: (() => void) | null = null;
    protected _tileFetcher: TileFetcher<T>;
    protected _tileBuckets = new Map<string, GPUBucket>();
    protected _pendingUploads = new Map<string, T>();
    protected _labelOpacity = new Map<string, Float32Array>();

    private static _engines = new WeakMap<RendererAPI, SymbolEngine>();

    constructor(tileFetcher: TileFetcher<T>, options: SymbolLayerOptions) {
        this._tileFetcher = tileFetcher;
        this.source = options.source;
        this.sourceLayer = options.sourceLayer;
        if (options.id) this.id = options.id;
    }

    // ── Abstract methods ────────────────────────────────────────────────

    abstract uploadBucket(gl: WebGLRenderingContext, key: string, data: T): GPUBucket;
    abstract drawTile(gl: WebGLRenderingContext, program: WebGLProgram, bucket: GPUBucket, ctx: DrawContext): void;
    abstract getCollisionData(ctx: RenderContext, visibleKeys: ReadonlySet<string>): CollisionData[];

    // ── Lifecycle ───────────────────────────────────────────────────────

    onAdd(renderer: RendererAPI): void {
        this._renderer = renderer;
        this._gl = renderer.gl!;
        this._markDirty = () => renderer.markDirty?.();

        let engine = SymbolLayerBase._engines.get(renderer);
        if (!engine) {
            engine = new SymbolEngine(renderer);
            SymbolLayerBase._engines.set(renderer, engine);
        }
        this._engine = engine;
        engine.register(this as any);

        debug?.('onAdd', {id: this.id, source: this.source});
    }

    onRemove(): void {
        debug?.('onRemove', {id: this.id});

        if (this._engine) {
            this._engine.unregister(this as any);
            this._engine = null;
        }
        this._renderer = null;
        this._gl = null;
        this._markDirty = null;
    }

    // ── Draw scaffolding ───────────────────────────────────────────────

    draw(ctx: DrawContext): void {
        const {gl, tileID} = ctx;
        const key = tileID.key;

        // Upload pending results from tile fetcher
        const pending = this._pendingUploads.get(key);
        if (pending) {
            this._pendingUploads.delete(key);
            const bucket = this.uploadBucket(gl, key, pending);
            this._tileBuckets.set(key, bucket);
            debug?.('uploaded bucket', {key});
        }

        // Start fetch if not yet requested
        if (!this._tileBuckets.has(key) && !this._tileFetcher.hasPending(key) && ctx.tileData instanceof ArrayBuffer) {
            this._startFetch(key, ctx);
            return;
        }

        const bucket = this._tileBuckets.get(key);
        if (!bucket) return;

        const program = ctx.programs.get(this._getProgramName());
        if (!program) return;

        gl.useProgram(program);
        gl.disable(gl.STENCIL_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this.drawTile(gl, program, bucket, ctx);

        gl.disable(gl.BLEND);
        gl.enable(gl.STENCIL_TEST);

        debug?.('draw', {key});
    }

    // ── Tile eviction ──────────────────────────────────────────────────

    evictTile(key: string): void {
        debug?.('evictTile', {key});
        this._tileBuckets.delete(key);
        this._pendingUploads.delete(key);
        this._labelOpacity.delete(key);
        this._tileFetcher.evict(key);
    }

    // ── PlaceableLayer interface ───────────────────────────────────────

    getLabelData(): Map<string, LabelData[]> {
        return new Map();
    }

    setLabelOpacity(tileKey: string, opacity: Float32Array): void {
        this._labelOpacity.set(tileKey, opacity);
        this._markDirty?.();
        debug?.('setLabelOpacity', {tileKey, length: opacity.length});
    }

    // ── Protected helpers ──────────────────────────────────────────────

    /**
   * Start fetching tile data. Subclasses can override to add pre-processing
   * (e.g. TextLayer adds ensureGlyphsForTile before requesting).
   */
    protected _startFetch(key: string, ctx: DrawContext): void {
        if (!(ctx.tileData instanceof ArrayBuffer)) return;
        this._tileFetcher.request(key, ctx.tileData);
        debug?.('_startFetch', {key});
    }

    /**
   * Default program name. Subclasses override as needed (e.g. IconLayer → 'icon').
   */
    protected _getProgramName(): string {
        return 'symbol_sdf';
    }

    /**
   * Project tile-local positions to screen coordinates.
   * Used by subclasses in getCollisionData() implementations.
   */
    protected _projectToScreen(
        positions: Array<{ x: number; y: number }>,
        tileKey: string,
        camera: CameraState,
        canvasWidth: number,
        canvasHeight: number,
    ): Array<{ x: number; y: number }> {
        const {zoom} = camera;
        const worldSize = TILE_SIZE * Math.pow(2, zoom);
        const cx = lngToTileX(camera.center.lng, zoom) * TILE_SIZE;
        const cy = latToTileY(camera.center.lat, zoom) * TILE_SIZE;

        const parts = tileKey.split('/');
        const tz = parseInt(parts[0], 10);
        const tx = parseInt(parts[1], 10);
        const ty = parseInt(parts[2], 10);
        if (isNaN(tz) || isNaN(tx) || isNaN(ty)) return [];

        const tileScale = worldSize / Math.pow(2, tz);
        const tileOriginX = tx * tileScale;
        const tileOriginY = ty * tileScale;
        const extent = this.extent;

        return positions.map(pos => ({
            x: (tileOriginX + (pos.x / extent) * tileScale) - cx + canvasWidth / 2,
            y: (tileOriginY + (pos.y / extent) * tileScale) - cy + canvasHeight / 2,
        }));
    }
}
