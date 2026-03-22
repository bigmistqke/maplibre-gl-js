// src/modular/core/surface.ts
import type {CameraState, TileID, TileMesh, ResolvedPaintProperties} from '@modular/core/types.ts';
import type {Projection, Viewport} from '@modular/core/projection.ts';
import type {ProgramCache} from '@modular/core/render-extension.ts';
import type {LayerInstance, CustomLayer} from '@modular/core/renderer-api.ts';

export interface FramebufferObject {
    framebuffer: WebGLFramebuffer;
    texture: WebGLTexture;    // RGBA8, width×height
    depth: WebGLRenderbuffer;
}

export interface MeshBuffers {
    vert: WebGLBuffer;
    idx: WebGLBuffer;
    indexCount: number;
}

export interface RendererInternals {
    /** Typed as WebGL2 — safe because setSurface() can only be called on WebGL2RendererAPI. */
    gl: WebGL2RenderingContext;
    camera: CameraState;
    viewport: Viewport;
    projection: Projection;
    programs: ProgramCache;
    stencilProgram: WebGLProgram;
    /** Structurally typed to avoid importing renderer internals into core. */
    layers: Array<{ id: string; layer: LayerInstance }>;
    tileLayers: Map<string, LayerInstance[]>;
    tileManagers: Map<string, {
        getReadyTiles(): Array<{ tileID: TileID; data: Transferable | undefined }>;
        getRetainedKeys(): Set<string>;
    }>;
    sourceTypes: Map<string, 'raster' | 'vector'>;
    customLayers: CustomLayer[];
    evaluate: (layer: LayerInstance, zoom: number) => ResolvedPaintProperties;
    frameIndex: number;
    createFramebuffer(width: number, height: number): FramebufferObject;
    destroyFramebuffer(fb: FramebufferObject): void;
    getOrCreateTexture(key: string, bitmap: ImageBitmap): WebGLTexture;
    destroyTexture(key: string): void;
    getOrCreateMeshBuffers(key: string, mesh: TileMesh): MeshBuffers;
    writeTileStencil(
        prog: WebGLProgram,
        vert: WebGLBuffer,
        idx: WebGLBuffer,
        count: number,
        ref: number,
    ): void;
}

export interface Surface {
    /** Shader defines injected at program compile time. e.g. ['#define TERRAIN3D'] */
    readonly shaderDefines: readonly string[];
    /** Execute the tile render loop for one frame. */
    renderTiles(internals: RendererInternals): void;
    /** Release GPU resources. */
    destroy(): void;
}
