// src/modular/layers/symbol/icon-layer.ts
import type {ProgramDefinition} from '@modular/core/types.ts';
import type {DrawContext, RenderContext} from '@modular/core/render-extension.ts';
import type {RendererAPI} from '@modular/core/renderer-api.ts';
import type {ImageManager} from '@modular/layers/symbol/image-manager.ts';
import type {IconTileData} from '@modular/layers/symbol/icon-types.ts';
import {IconWorkerService} from '@modular/layers/symbol/workers/icon-worker-service.ts';
import {createDebug} from '@modular/debug.ts';
import {SymbolLayerBase} from '@modular/layers/symbol/base/symbol-layer-base.ts';
import {TileFetcher} from '@modular/layers/symbol/base/tile-fetcher.ts';
import type {CollisionData, GPUBucket} from '@modular/layers/symbol/base/types.ts';

const debug = createDebug?.('IconLayer', false);

// --- Shaders ---

const iconVert = `
attribute vec2 a_anchor;
attribute vec2 a_offset;
attribute vec2 a_tex;

uniform vec2 u_texsize;
uniform vec2 u_resolution;

varying vec2 v_uv;

void main() {
  vec4 proj = projectTile(a_anchor);
  vec2 screen = proj.xy / proj.w;
  screen += (a_offset / 32.0) * vec2(2.0, -2.0) / u_resolution;
  gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  v_uv = a_tex / u_texsize;
}
`;

const iconFrag = `
precision mediump float;

uniform sampler2D u_texture;
uniform float u_opacity;

varying vec2 v_uv;

void main() {
  gl_FragColor = texture2D(u_texture, v_uv) * u_opacity;
}
`;

// --- Options ---

export interface IconLayerOptions {
    /** Source ID used to look up tile URLs from TileManager. */
    source: string;
    /** MVT source-layer name inside the PBF. */
    sourceLayer: string;
    /** Feature property name whose value is a sprite icon name. */
    iconField: string;
    /** Sprite URL (without extension), e.g. 'https://example.com/sprite' */
    spriteUrl: string;
    /** Opacity in [0, 1]. Default 1. */
    opacity?: number;
    /** Optional layer id */
    id?: string;
}

// --- Layer ---

export class IconLayer extends SymbolLayerBase<IconTileData> {
    readonly extent = 8192;

    static programs: ProgramDefinition[] = [
        {name: 'icon', vertex: iconVert, fragment: iconFrag},
    ];

    private _iconField: string;
    private _spriteUrl: string;
    private _opacity: number;
    private _workerService: IconWorkerService;
    private _imageManager: ImageManager | null = null;
    private _atlasTexture: WebGLTexture | null = null;
    private _atlasWidth = 1;
    private _atlasHeight = 1;
    private _imagesReady = false;

    /** Cached anchor positions (tile-local coords) for collision data */
    private _anchorCache = new Map<string, { x: number; y: number }[]>();

    /** Expose workerService so callers can pass it as a TileService-like object if needed. */
    readonly workerService: IconWorkerService;

    constructor(options: IconLayerOptions) {
        const workerService = new IconWorkerService();

        const tileFetcher = new TileFetcher<IconTileData>({
            fetch: async (key: string, data: ArrayBuffer): Promise<IconTileData | null> => {
                if (!this._imagesReady) {
                    debug?.('tileFetcher.fetch: images not ready, skipping', key);
                    return null;
                }

                debug?.('tileFetcher.fetch', key);

                // Request layout from worker
                workerService.requestFromPbf(key, data, options.sourceLayer, options.iconField);

                // Poll for result
                const bucket = await workerService.getBucket(key);
                if (!bucket) {
                    debug?.('tileFetcher: not ready yet', key);
                    return null;
                }

                debug?.('tileFetcher: ready', {key, count: bucket.count});

                if (bucket.count === 0) {
                    return null;
                }

                // Cache anchor positions for collision data
                if (bucket.anchorPositions) {
                    this._anchorCache.set(key, bucket.anchorPositions);
                }

                return bucket;
            },
            onReady: (key: string, _result: IconTileData) => {
                debug?.('tileFetcher.onReady', key);
                this._pendingUploads.set(key, _result);
                this._markDirty?.();
            },
        });

        super(tileFetcher, {
            source: options.source,
            sourceLayer: options.sourceLayer,
            id: options.id,
        });

        this._iconField = options.iconField;
        this._spriteUrl = options.spriteUrl;
        this._opacity = options.opacity ?? 1;
        this._workerService = workerService;
        this.workerService = workerService;
    }

    // ---- Lifecycle ----

    onAdd(renderer: RendererAPI): void {
        super.onAdd(renderer);

        // Get shared ImageManager from engine resources
        this._imageManager = this._engine!.resources.getImageManager(this._spriteUrl);

        // Begin loading sprite; push metadata to worker once ready
        this._imageManager.load((spriteData, atlas) => {
            debug?.('sprite loaded', {entries: Object.keys(atlas.entries)});
            const gl = this._gl!;

            const tex = gl.createTexture()!;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.imageData);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            this._atlasTexture = tex;
            this._atlasWidth = atlas.atlasWidth;
            this._atlasHeight = atlas.atlasHeight;

            const atlasEntries: { [name: string]: { atlasX: number; atlasY: number } } = {};
            for (const [name, entry] of Object.entries(atlas.entries)) {
                atlasEntries[name] = {atlasX: entry.atlasX, atlasY: entry.atlasY};
            }
            void this._workerService.updateImages(spriteData, atlasEntries);
            this._imagesReady = true;
            debug?.('imagesReady, calling markDirty');
            this._markDirty?.();
        });

        debug?.('onAdd complete', {spriteUrl: this._spriteUrl});
    }

    onRemove(): void {
    // Clean up atlas texture
        if (this._gl && this._atlasTexture) {
            this._gl.deleteTexture(this._atlasTexture);
            this._atlasTexture = null;
        }

        // Destroy worker service
        this._workerService.destroy();

        super.onRemove();
    }

    // ---- Override program name ----

    protected _getProgramName(): string {
        return 'icon';
    }

    // ---- Abstract implementations ----

    uploadBucket(gl: WebGLRenderingContext, key: string, data: IconTileData): GPUBucket {
        debug?.('uploadBucket', {key, count: data.count});

        const renderer = this._renderer! as Required<Pick<RendererAPI, 'createGeometryBuffer' | 'destroyGeometryBuffers'>>;
        renderer.destroyGeometryBuffers(`tile:${key}:icon:`);
        const verts = renderer.createGeometryBuffer(`tile:${key}:icon:v`, new Int16Array(data.vertices), gl.ARRAY_BUFFER);
        const idx = renderer.createGeometryBuffer(`tile:${key}:icon:i`, new Uint16Array(data.indices), gl.ELEMENT_ARRAY_BUFFER);

        return {verts, idx, count: data.count};
    }

    drawTile(gl: WebGLRenderingContext, program: WebGLProgram, bucket: GPUBucket, ctx: DrawContext): void {
        const key = ctx.tileID.key;

        if (!this._atlasTexture) {
            debug?.('drawTile: no atlas texture yet', key);
            return;
        }

        // Placement: skip if all icons hidden
        const placementOp = this._labelOpacity.get(key);
        if (placementOp && placementOp.length > 0) {
            if (!placementOp.some(v => v > 0)) {
                debug?.('drawTile: all icons hidden by placement', key);
                return;
            }
        }

        debug?.('drawTile: rendering', {key, count: bucket.count});

        // Bind image atlas to texture unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._atlasTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

        // Atlas size for UV normalization
        gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), this._atlasWidth, this._atlasHeight);

        // Resolution for pixel-space offsets
        const canvas = gl.canvas as HTMLCanvasElement;
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);

        // Opacity
        gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this._opacity);

        // Override blend to straight alpha (not premultiplied like base class sets)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Bind buffers and set attributes
        // IconVertexLayout stride = 12 bytes: ax(2) ay(2) ox(2) oy(2) u(2) v(2)
        gl.bindBuffer(gl.ARRAY_BUFFER, bucket.verts);

        const aAnchor = gl.getAttribLocation(program, 'a_anchor');
        gl.enableVertexAttribArray(aAnchor);
        gl.vertexAttribPointer(aAnchor, 2, gl.SHORT, false, 12, 0);

        const aOffset = gl.getAttribLocation(program, 'a_offset');
        gl.enableVertexAttribArray(aOffset);
        gl.vertexAttribPointer(aOffset, 2, gl.SHORT, false, 12, 4);

        const aTex = gl.getAttribLocation(program, 'a_tex');
        gl.enableVertexAttribArray(aTex);
        gl.vertexAttribPointer(aTex, 2, gl.UNSIGNED_SHORT, false, 12, 8);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bucket.idx);
        gl.drawElements(gl.TRIANGLES, bucket.count, gl.UNSIGNED_SHORT, 0);

        // Cleanup attributes
        gl.disableVertexAttribArray(aAnchor);
        gl.disableVertexAttribArray(aOffset);
        gl.disableVertexAttribArray(aTex);
    }

    getCollisionData(ctx: RenderContext, visibleKeys: ReadonlySet<string>): CollisionData[] {
        if (!this._renderer) return [];
        const camera = ctx.camera;
        if (!camera) return [];
        const gl = ctx.gl;
        const canvas = gl.canvas as HTMLCanvasElement;
        const w = canvas.width;
        const h = canvas.height;
        const halfSize = 16;

        const buckets: CollisionData[] = [];

        for (const [key, positions] of this._anchorCache) {
            if (positions.length === 0) continue;
            if (!visibleKeys.has(key)) continue;

            const screenPositions = this._projectToScreen(positions, key, camera, w, h);
            if (screenPositions.length === 0) continue;

            const anchors: Array<{ x: number; y: number }> = [];
            const boxes: Array<[number, number, number, number]> = [];

            for (let i = 0; i < screenPositions.length; i++) {
                const sp = screenPositions[i];
                anchors.push({x: sp.x, y: sp.y});
                boxes.push([sp.x - halfSize, sp.y - halfSize, sp.x + halfSize, sp.y + halfSize]);
            }

            buckets.push({tileKey: key, anchors, boxes, crossTileIDs: []}); // STUB: populated by CrossTileIndex
        }

        return buckets;
    }

    // ---- Tile eviction override ----

    evictTile(key: string): void {
        debug?.('evictTile', key);
        this._anchorCache.delete(key);
        this._workerService.cancel(key);
        super.evictTile(key);
    }

    destroy(): void {
        this._workerService.destroy();
        if (this._gl && this._atlasTexture) {
            this._gl.deleteTexture(this._atlasTexture);
        }
    }
}
