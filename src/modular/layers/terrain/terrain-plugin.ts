// src/modular/layers/terrain/terrain-plugin.ts
import type {LngLat, TileID} from '@modular/core/types.ts';
import type {RendererInternals} from '@modular/core/surface.ts';
import type {SourceDefinition} from '@modular/core/renderer-api.ts';
import type {MapGL} from '@modular/core/map.ts';
import type {WebGL2RendererAPI} from '@modular/core/renderer-api.ts';
import type {Plugin} from '@modular/core/map.ts';
import {RTTPool, FBO_SIZE} from '@modular/layers/terrain/rtt-pool.ts';
import {WorkerDEMTileService} from '@modular/layers/terrain/worker-dem-tile-service.ts';
import {buildTerrainMesh} from '@modular/layers/terrain/terrain-mesh.ts';
import {TERRAIN_VERT, TERRAIN_FRAG} from '@modular/layers/terrain/terrain-shaders.ts';
// ELEVATION_PRELUDE defines projectTileWithElevation used by TERRAIN_VERT
import {ELEVATION_PRELUDE, flatRenderTiles} from '@modular/renderer/flat-render-tiles.ts';
import {lngToTileX, latToTileY} from '@modular/renderer/mercator.ts';

// Mapbox terrain-RGB unpack factors — matches MapLibre DEMData.getUnpackVector()
// Shader formula: (texture * 255) * unpack.xyz → rgb.r + rgb.g + rgb.b - unpack.a
const DEM_UNPACK: [number, number, number, number] = [6553.6, 25.6, 0.1, 10000];

// numSublayers matches MapLibre painter.ts line 127: SourceCache.maxUnderzooming + maxOverzooming + 1
// (mirrors MAX_UNDERZOOMING=3 + MAX_OVERZOOMING=10 + 1 from tile-manager.ts)
const NUM_SUBLAYERS = 14;
const WORLD_TILE = {z: 0, x: 0, y: 0, key: '0/0/0'};
// Header size in the DEM ArrayBuffer: [dim, stride] as two Uint32 values = 8 bytes
const DEM_HEADER_BYTES = 8;

/**
 * Compute an orthographic matrix that renders the portion of srcTile that covers
 * demTile into the entire FBO [-1,1]×[-1,1]. Returns null if srcTile doesn't cover demTile.
 *
 * For an exact match (same z/x/y), this is the standard tile-fill ortho.
 * For a parent tile (srcTile.z < demTile.z), the matrix crops to the sub-area.
 */
function tileOrthoMatrix(srcTileID: { z: number; x: number; y: number }, demTileID: { z: number; x: number; y: number }): Float32Array | null {
    const dz = demTileID.z - srcTileID.z;

    if (dz >= 0) {
    // src is coarser or equal: crop the srcTile to the sub-area that covers demTile
        const scale = 1 << dz;   // 2^dz
        if ((demTileID.x >> dz) !== srcTileID.x || (demTileID.y >> dz) !== srcTileID.y) return null;
        const xi = demTileID.x - (srcTileID.x * scale);
        const yi = demTileID.y - (srcTileID.y * scale);
        const sx = (2 * scale) / 4096;
        const sy = -(2 * scale) / 4096;
        const tx = -1 - xi * 2;
        const ty = 1 + yi * 2;
        return new Float32Array([sx, 0, 0, 0,  0, sy, 0, 0,  0, 0, 1, 0,  tx, ty, 0, 1]);
    } else {
    // src is finer than DEM (e.g. camera zoom 12, DEM maxZoom 8): src covers a sub-area of demTile.
    // Scale and translate so srcTile's [0,4096]² maps to its sub-area of the FBO NDC [-1,1]².
        const dz2 = srcTileID.z - demTileID.z;   // positive
        const scale = 1 << dz2;                  // src tiles per DEM tile per axis
        if ((srcTileID.x >> dz2) !== demTileID.x || (srcTileID.y >> dz2) !== demTileID.y) return null;
        const xi = srcTileID.x - (demTileID.x * scale);
        const yi = srcTileID.y - (demTileID.y * scale);
        const sx = 2 / (scale * 4096);
        const sy = -2 / (scale * 4096);
        const tx = -1 + (xi * 2) / scale;
        const ty = 1 - (yi * 2) / scale;
        return new Float32Array([sx, 0, 0, 0,  0, sy, 0, 0,  0, 0, 1, 0,  tx, ty, 0, 1]);
    }
}

export interface TerrainPluginOptions {
    /** Source ID of the terrain-RGB raster DEM source. */
    source: string;
    /** Height exaggeration multiplier. Default 1.0. */
    exaggeration?: number;
}

interface DEMTileData {
    bytes: Uint8Array;  // pixel data (RGBA, stride×stride), without the 8-byte header
    dim: number;        // core tile dimension (e.g. 256)
    stride: number;     // dim + 2 (includes 1px padding border)
}

export class TerrainPlugin implements Plugin<WebGL2RendererAPI> {
    readonly shaderDefines = ['#define TERRAIN3D'];

    private _source: string;
    private _exaggeration: number;
    private _rttPool = new RTTPool();
    private _terrainProgram: WebGLProgram | null = null;
    private _meshVert: WebGLBuffer | null = null;
    private _meshIdx: WebGLBuffer | null = null;
    private _meshIndexCount = 0;
    private _gl: WebGL2RenderingContext | null = null;  // set on first renderTiles call

    // DEM tile GPU textures — managed directly to control NEAREST filter and lifecycle
    private _demTextures = new globalThis.Map<string, WebGLTexture>();
    // DEM tile pixel data for CPU elevation queries (getElevation)
    private _demData = new globalThis.Map<string, DEMTileData>();

    // Cached uniform/attrib locations (set once after _ensureProgram)
    private _uMapTexture: WebGLUniformLocation | null = null;
    private _uDem: WebGLUniformLocation | null = null;
    private _uExaggeration: WebGLUniformLocation | null = null;
    private _uTerrainUnpack: WebGLUniformLocation | null = null;
    private _uTerrainDim: WebGLUniformLocation | null = null;
    private _aPos = -1;
    // Per-program u_matrix location cache — stable for program lifetime
    private _uMatrixCache = new globalThis.Map<WebGLProgram, WebGLUniformLocation | null>();

    constructor(opts: TerrainPluginOptions) {
        this._source = opts.source;
        this._exaggeration = opts.exaggeration ?? 1.0;
    }

    /**
   * Create a source definition that uses WorkerDEMTileService to decode terrain-RGB
   * tiles in a worker — matching MapLibre's RasterDEMTileSource approach.
   * Use this instead of a plain raster source for the DEM source.
   */
    static createDEMSource(opts: {
        url: string;
        minZoom?: number;
        maxZoom?: number;
        tileSize?: number;
    }): SourceDefinition {
        return {type: 'raster', tileService: new WorkerDEMTileService(), ...opts};
    }

    setExaggeration(value: number): void {
        this._exaggeration = value;
    }

    // ElevationProvider — duck-typed by CameraController.
    // TODO: implement real DEM tile lookup so camera ground-clamping works over mountains.
    // Until then this silently returns 0, so camera elevation clamping treats terrain as flat.
    //
    // Port of MapLibre terrain.ts getDEMElevation() — bilinear interpolation in elevation space.
    getElevation(lngLat: LngLat): number {
        for (const [key, {bytes, dim, stride}] of this._demData) {
            const [z, tileX, tileY] = key.split('/').map(Number);
            const nx = lngToTileX(lngLat.lng, z);
            const ny = latToTileY(lngLat.lat, z);
            if (Math.floor(nx) !== tileX || Math.floor(ny) !== tileY) continue;

            // Fractional pixel position within tile
            const px = (nx - tileX) * dim;
            const py = (ny - tileY) * dim;
            const cx = Math.floor(px);
            const cy = Math.floor(py);
            const dx = px - cx;
            const dy = py - cy;

            // Sample elevation at padded pixel (col, row) — matches MapLibre DEMData.get()
            const sample = (col: number, row: number): number => {
                const i = ((row + 1) * stride + (col + 1)) * 4;
                return bytes[i] * DEM_UNPACK[0] + bytes[i + 1] * DEM_UNPACK[1] + bytes[i + 2] * DEM_UNPACK[2] - DEM_UNPACK[3];
            };

            // Bilinear interpolation in elevation space — matches MapLibre getDEMElevation()
            return (
                sample(cx,     cy    ) * (1 - dx) * (1 - dy) +
        sample(cx + 1, cy    ) * dx       * (1 - dy) +
        sample(cx,     cy + 1) * (1 - dx) * dy       +
        sample(cx + 1, cy + 1) * dx       * dy
            );
        }
        return 0;
    }

    // Surface — set on renderer via onAdd
    renderTiles(internals: RendererInternals): void {
        const {gl} = internals;
        this._gl = gl;  // store for destroy()

        this._ensureMesh(gl);
        this._ensureProgram(internals);

        const demManager = internals.tileManagers.get(this._source);
        if (!demManager) return;

        // Evict FBOs and DEM GPU textures / pixel data for tiles no longer retained
        const retainedKeys = demManager.getRetainedKeys();
        this._rttPool.evict(retainedKeys, (key) => {
            const tex = this._demTextures.get(key);
            if (tex) gl.deleteTexture(tex);
            this._demTextures.delete(key);
            this._demData.delete(key);
        });

        const allDemTiles = demManager.getReadyTiles();

        // Build a non-overlapping tile set matching MapLibre's coveringTiles() guarantee.
        // getReadyTiles() can return both a parent and its children for the same world area
        // (the retain set keeps fallbacks alongside freshly-loaded tiles). Overlapping terrain
        // meshes cause depth conflicts even with LEQUAL + painter's sort.
        //
        // Algorithm: iterate the ideal-zoom tile grid; use the exact tile if loaded, otherwise
        // walk up to the nearest loaded ancestor — same as MapLibre's coveringTiles() fallback logic.
        // A Map keyed by tile key prevents duplicate parents when multiple children share one.
        const idealZ = Math.floor(internals.camera.zoom);
        const tileMap = new globalThis.Map(allDemTiles.map(t => [t.tileID.key, t]));
        const selected = new globalThis.Map<string, typeof allDemTiles[0]>();
        for (const tileID of internals.projection.getVisibleTiles(internals.camera, internals.viewport)) {
            if (tileID.z !== idealZ) continue;
            if (tileMap.has(tileID.key)) {
                selected.set(tileID.key, tileMap.get(tileID.key)!);
            } else {
                // Fallback: walk up to find the nearest loaded ancestor
                for (let pz = idealZ - 1; pz >= 0; pz--) {
                    const dz = idealZ - pz;
                    const parentKey = `${pz}/${tileID.x >> dz}/${tileID.y >> dz}`;
                    if (tileMap.has(parentKey)) { selected.set(parentKey, tileMap.get(parentKey)!); break; }
                }
            }
        }
        const demTiles = [...selected.values()];

        // Fall back to flat rendering while DEM tiles are still loading
        if (demTiles.length === 0) {
            flatRenderTiles(internals);
            return;
        }

        // ── Pass 1: RTT ──────────────────────────────────────────────────────────
        // Render all tile-based layers to per-tile FBOs. No stencil needed (one FBO = one tile).
        for (const {tileID} of demTiles) {
            const fbo = this._rttPool.getOrCreate(tileID.key, internals);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
            gl.viewport(0, 0, FBO_SIZE, FBO_SIZE);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            for (const [sourceId, tileManager] of internals.tileManagers) {
                if (sourceId === this._source) continue;  // DEM source — not a visual layer
                const sourceLayers = internals.tileLayers.get(sourceId) ?? [];
                const sourceType = internals.sourceTypes.get(sourceId) ?? 'raster';
                const readyTiles = tileManager.getReadyTiles();

                for (const {tileID: srcTileID, data} of readyTiles) {
                    // Accept exact match or ancestor tiles (src at lower zoom covering the DEM tile).
                    const ortho = tileOrthoMatrix(srcTileID, tileID);
                    if (!ortho) continue;

                    const mesh = internals.projection.getMeshForTile(srcTileID);
                    const meshBuffers = internals.getOrCreateMeshBuffers(srcTileID.key, mesh);

                    let tileTexture: WebGLTexture | undefined;
                    if (sourceType === 'raster') {
                        tileTexture = internals.getOrCreateTexture(srcTileID.key, data as ImageBitmap);
                    }

                    for (const layer of sourceLayers) {
                        const paint = internals.evaluate(layer, internals.camera.zoom);
                        const program = internals.programs.get((layer.constructor as { programs?: { name: string }[] }).programs?.[0]?.name);
                        if (program) {
                            gl.useProgram(program);
                            // Tile-local ortho: maps the srcTile's sub-area that covers demTile → NDC [-1,1].
                            if (!this._uMatrixCache.has(program)) {
                                this._uMatrixCache.set(program, gl.getUniformLocation(program, 'u_matrix'));
                            }
                            gl.uniformMatrix4fv(this._uMatrixCache.get(program)!, false, ortho);
                        }
                        layer.draw?.({
                            gl,
                            programs: internals.programs,
                            tileID: srcTileID,
                            meshBuffers,
                            zoom: internals.camera.zoom,
                            paint,
                            frameIndex: internals.frameIndex,
                            tileTexture,
                            tileData: sourceType === 'vector' ? data : undefined,
                            imageAtlas: {},
                            lineDashAtlas: {},
                        });
                    }
                }
            }
        }

        // Restore default framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, internals.viewport.width, internals.viewport.height);

        // ── Pass 2: Terrain mesh ─────────────────────────────────────────────────
        // Draw 3D terrain mesh per tile, draping FBO texture over DEM displacement.
        // No stencil — the elevated terrain mesh doesn't match a flat stencil quad at pitch>0.
        //
        // Painter's algorithm (back-to-front) — matches MapLibre's LEQUAL+depth approach.
        // At pitch, tiles from different rows project to overlapping screen positions, so we must
        // render further tiles first so that closer tiles correctly overwrite them with LEQUAL.
        // MapLibre doesn't need an explicit sort at typical exaggeration (1x–2x) because overlap
        // is small; at higher exaggeration we must sort explicitly.
        // Depth along the view direction in tile space: dot((tile_center − cam_center), forward_tile)
        // where forward_tile = (sin(bearing), −cos(bearing)) — bearing 0 = north = −y in tile space.
        // Painter's sort: further tiles first so closer tiles overwrite with ALWAYS depth func.
        // Normalise all tile centres to zoom-0 space so coarse+fine tiles compare correctly.
        const {center, bearing: brg = 0} = internals.camera;
        const camNx = lngToTileX(center.lng, 0);
        const camNy = latToTileY(center.lat, 0);
        const brgRad = brg * Math.PI / 180;
        const sinB = Math.sin(brgRad), cosB = Math.cos(brgRad);
        const sortedDemTiles = [...demTiles].sort((a, b) => {
            const nxA = (a.tileID.x + 0.5) / Math.pow(2, a.tileID.z);
            const nyA = (a.tileID.y + 0.5) / Math.pow(2, a.tileID.z);
            const nxB = (b.tileID.x + 0.5) / Math.pow(2, b.tileID.z);
            const nyB = (b.tileID.y + 0.5) / Math.pow(2, b.tileID.z);
            const depA = (nxA - camNx) * sinB - (nyA - camNy) * cosB;
            const depB = (nxB - camNx) * sinB - (nyB - camNy) * cosB;
            return depB - depA;  // descending: further tiles first
        });

        const prog = this._terrainProgram!;
        gl.useProgram(prog);

        // Depth setup — matches MapLibre's getDepthModeFor3D() + painter.depthRangeFor3D.
        // depthEpsilon from painter.ts line 128; NUM_SUBLAYERS from painter.ts line 127.
        const depthEpsilon = 1 / Math.pow(2, 16);
        const numLayers = internals.tileLayers.size;
        const maxDepth = 1 - ((numLayers + 2) * NUM_SUBLAYERS * depthEpsilon);
        gl.enable(gl.DEPTH_TEST);
        // ALWAYS not LEQUAL: back-face culling (below) handles intra-tile self-occlusion on steep
        // slopes; LEQUAL causes adjacent mesh rows to z-fight at high pitch+exaggeration (their
        // projected depths are nearly equal). Inter-tile ordering is handled by painter's sort above.
        gl.depthFunc(gl.ALWAYS);
        gl.depthRange(0, maxDepth);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        // Back-face culling — matches MapLibre's CullFaceMode.backCCW (cull_face_mode.ts line 33).
        // Eliminates back-facing triangles on far side of mountains at high pitch, preventing z-fighting.
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._meshVert!);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIdx!);
        gl.enableVertexAttribArray(this._aPos);
        gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);

        // u_terrain_unpack is constant for all tiles (mapbox encoding)
        gl.uniform4fv(this._uTerrainUnpack, DEM_UNPACK);

        for (const {tileID, data: demData} of sortedDemTiles) {
            const fbo = this._rttPool.getOrCreate(tileID.key, internals);
            const demTex = this._getOrCreateDEMTexture(gl, tileID, demData as ArrayBuffer);

            internals.projection.setTileUniforms(gl, prog, tileID, internals.camera, internals.viewport);

            // u_terrain_dim: unpadded tile dimension (e.g. 256.0)
            const dem = this._demData.get(tileID.key);
            gl.uniform1f(this._uTerrainDim, dem ? dem.dim : 256);

            // u_map_texture = FBO color texture (rendered tile layers)
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
            gl.uniform1i(this._uMapTexture, 0);

            // u_dem = DEM tile texture (NEAREST filter — bilinear done in elevation space by shader)
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, demTex);
            gl.uniform1i(this._uDem, 1);

            gl.uniform1f(this._uExaggeration, this._exaggeration);

            gl.drawElements(gl.TRIANGLES, this._meshIndexCount, gl.UNSIGNED_INT, 0);
        }

        gl.disable(gl.CULL_FACE);
        gl.depthFunc(gl.LESS);  // restore default
        gl.depthRange(0, 1);
        gl.disable(gl.DEPTH_TEST);

        // ── Pass 3: Custom layers ────────────────────────────────────────────────
        if (internals.customLayers.length > 0) {
            for (const layer of internals.customLayers) {
                layer.render({
                    gl: gl as WebGLRenderingContext,
                    camera: internals.camera,
                    viewport: internals.viewport,
                    vertexShaderPrelude: internals.projection.vertexShaderPrelude,
                    setProjectionUniforms: (program: WebGLProgram) => {
                        gl.useProgram(program);
                        internals.projection.setTileUniforms(gl, program, WORLD_TILE, internals.camera, internals.viewport);
                    },
                });
            }
        }
    }

    destroy(): void {
    // Free RTT FBOs — RTTPool.destroy() uses internally stored _destroyFn (no internals needed).
        this._rttPool.destroy();
        if (this._gl) {
            // Free DEM GPU textures
            for (const tex of this._demTextures.values()) this._gl.deleteTexture(tex);
            if (this._meshVert) this._gl.deleteBuffer(this._meshVert);
            if (this._meshIdx) this._gl.deleteBuffer(this._meshIdx);
            if (this._terrainProgram) this._gl.deleteProgram(this._terrainProgram);
        }
        this._demTextures.clear();
        this._demData.clear();
        this._terrainProgram = null;
        this._meshVert = null;
        this._meshIdx = null;
        this._gl = null;
    }

    // Plugin<WebGL2RendererAPI> lifecycle
    onAdd(_map: MapGL<WebGL2RendererAPI>, renderer: WebGL2RendererAPI): void {
    // Runtime guard — spec requires a descriptive error if WebGL2 is unavailable.
        if (!renderer.__webgl2) {
            throw new Error(
                'TerrainPlugin requires a WebGL2 renderer. ' +
        'Create the renderer with { contextType: "webgl2" }.',
            );
        }
        renderer.setSurface(this);
    }

    // Upload the DEM ArrayBuffer to a GPU texture (NEAREST, CLAMP_TO_EDGE) the first time
    // we see a tile, and cache the pixel bytes for CPU-side getElevation() queries.
    // Matches MapLibre's terrain.ts Texture upload with premultiply:false + NEAREST filter.
    private _getOrCreateDEMTexture(
        gl: WebGL2RenderingContext,
        tileID: TileID,
        buffer: ArrayBuffer,
    ): WebGLTexture {
        const key = tileID.key;
        const cached = this._demTextures.get(key);
        if (cached) return cached;

        // Parse the 8-byte header: [dim (Uint32), stride (Uint32)]
        const header = new Uint32Array(buffer, 0, 2);
        const dim = header[0];
        const stride = header[1];
        const bytes = new Uint8Array(buffer, DEM_HEADER_BYTES, stride * stride * 4);

        // Store for CPU-side getElevation()
        this._demData.set(key, {bytes, dim, stride});

        // Upload as RGBA UNSIGNED_BYTE texture with NEAREST filter — matches MapLibre terrain.ts.
        // NEAREST avoids interpolating across encoded RGB values; bilinear interpolation is done
        // in elevation space by the shader's get_elevation() function.
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, stride, stride, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this._demTextures.set(key, tex);
        return tex;
    }

    private _ensureMesh(gl: WebGL2RenderingContext): void {
        if (this._meshVert) return;
        const {vertices, indices} = buildTerrainMesh();

        const vert = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vert);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const idx = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this._meshVert = vert;
        this._meshIdx = idx;
        this._meshIndexCount = indices.length;
    }

    private _ensureProgram(internals: RendererInternals): void {
        if (this._terrainProgram) return;
        const {gl} = internals;

        // Assemble prelude: shaderDefines + projection prelude + ELEVATION_PRELUDE.
        // ELEVATION_PRELUDE defines projectTileWithElevation which TERRAIN_VERT calls.
        // '#version 300 es' must be the FIRST line — prepend before everything.
        const prelude = `${this.shaderDefines.join('\n')}\n${ 
            internals.projection.vertexShaderPrelude}\n${ 
            ELEVATION_PRELUDE}`;
        const vert = this._compileShader(gl, gl.VERTEX_SHADER, `#version 300 es\n${prelude}\n${TERRAIN_VERT}`);
        const frag = this._compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es\n${TERRAIN_FRAG}`);
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(`Terrain program link error: ${gl.getProgramInfoLog(prog)}`);
        }
        this._terrainProgram = prog;
        // Cache uniform/attrib locations — querying per-frame is wasteful
        this._uMapTexture = gl.getUniformLocation(prog, 'u_map_texture');
        this._uDem = gl.getUniformLocation(prog, 'u_dem');
        this._uExaggeration = gl.getUniformLocation(prog, 'u_exaggeration');
        this._uTerrainUnpack = gl.getUniformLocation(prog, 'u_terrain_unpack');
        this._uTerrainDim = gl.getUniformLocation(prog, 'u_terrain_dim');
        this._aPos = gl.getAttribLocation(prog, 'a_pos');
    }

    private _compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(`Terrain shader compile error: ${gl.getShaderInfoLog(shader)}`);
        }
        return shader;
    }
}
