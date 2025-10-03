import { mat4 } from 'gl-matrix';
import { SourceCache } from '../source/source_cache';
import { SegmentVector } from '../data/segment';
import { type ProgramConfiguration } from '../data/program_configuration';
import { CrossTileSymbolIndex } from '../symbol/cross_tile_symbol_index';
import { Program } from './program';
import { Context } from '../gl/context';
import { DepthMode } from '../gl/depth_mode';
import { StencilMode } from '../gl/stencil_mode';
import { ColorMode } from '../gl/color_mode';
import { Texture } from './texture';
import { type OverscaledTileID } from '../source/tile_id';
import { Mesh } from './mesh';
import type { IReadonlyTransform } from '../geo/transform_interface';
import type { Style } from '../style/style';
import type { StyleLayer } from '../style/style_layer';
import type { CrossFaded } from '../style/properties';
import type { LineAtlas } from './line_atlas';
import type { ImageManager } from './image_manager';
import type { GlyphManager } from './glyph_manager';
import type { VertexBuffer } from '../gl/vertex_buffer';
import type { IndexBuffer } from '../gl/index_buffer';
import type { DepthRangeType, DepthMaskType, DepthFuncType } from '../gl/types';
import type { ResolvedImage } from '@maplibre/maplibre-gl-style-spec';
import type { RenderToTexture } from './render_to_texture';
export type RenderPass = 'offscreen' | 'opaque' | 'translucent';
type PainterOptions = {
    showOverdrawInspector: boolean;
    showTileBoundaries: boolean;
    showPadding: boolean;
    rotating: boolean;
    zooming: boolean;
    moving: boolean;
    fadeDuration: number;
};
export type RenderOptions = {
    isRenderingToTexture: boolean;
    isRenderingGlobe: boolean;
};
export declare class Painter {
    context: Context;
    transform: IReadonlyTransform;
    renderToTexture: RenderToTexture;
    _tileTextures: {
        [_: number]: Array<Texture>;
    };
    numSublayers: number;
    depthEpsilon: number;
    emptyProgramConfiguration: ProgramConfiguration;
    width: number;
    height: number;
    pixelRatio: number;
    tileExtentBuffer: VertexBuffer;
    tileExtentSegments: SegmentVector;
    tileExtentMesh: Mesh;
    debugBuffer: VertexBuffer;
    debugSegments: SegmentVector;
    rasterBoundsBuffer: VertexBuffer;
    rasterBoundsSegments: SegmentVector;
    rasterBoundsBufferPosOnly: VertexBuffer;
    rasterBoundsSegmentsPosOnly: SegmentVector;
    viewportBuffer: VertexBuffer;
    viewportSegments: SegmentVector;
    quadTriangleIndexBuffer: IndexBuffer;
    tileBorderIndexBuffer: IndexBuffer;
    _tileClippingMaskIDs: {
        [_: string]: number;
    };
    stencilClearMode: StencilMode;
    style: Style;
    options: PainterOptions;
    lineAtlas: LineAtlas;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    depthRangeFor3D: DepthRangeType;
    opaquePassCutoff: number;
    renderPass: RenderPass;
    currentLayer: number;
    currentStencilSource: string;
    nextStencilID: number;
    id: string;
    _showOverdrawInspector: boolean;
    cache: {
        [_: string]: Program<any>;
    };
    crossTileSymbolIndex: CrossTileSymbolIndex;
    symbolFadeChange: number;
    debugOverlayTexture: Texture;
    debugOverlayCanvas: HTMLCanvasElement;
    terrainFacilitator: {
        dirty: boolean;
        matrix: mat4;
        renderTime: number;
    };
    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, transform: IReadonlyTransform);
    resize(width: number, height: number, pixelRatio: number): void;
    setup(): void;
    clearStencil(): void;
    _renderTileClippingMasks(layer: StyleLayer, tileIDs: Array<OverscaledTileID>, renderToTexture: boolean): void;
    _renderTileMasks(tileStencilRefs: {
        [_: string]: number;
    }, tileIDs: Array<OverscaledTileID>, renderToTexture: boolean, useBorders: boolean): void;
    _renderTilesDepthBuffer(): void;
    stencilModeFor3D(): StencilMode;
    stencilModeForClipping(tileID: OverscaledTileID): StencilMode;
    getStencilConfigForOverlapAndUpdateStencilID(tileIDs: Array<OverscaledTileID>): [
        {
            [_: number]: Readonly<StencilMode>;
        },
        Array<OverscaledTileID>
    ];
    stencilConfigForOverlapTwoPass(tileIDs: Array<OverscaledTileID>): [
        {
            [_: number]: Readonly<StencilMode>;
        },
        {
            [_: number]: Readonly<StencilMode>;
        },
        Array<OverscaledTileID>
    ];
    colorModeForRenderPass(): Readonly<ColorMode>;
    getDepthModeForSublayer(n: number, mask: DepthMaskType, func?: DepthFuncType | null): Readonly<DepthMode>;
    getDepthModeFor3D(): Readonly<DepthMode>;
    opaquePassEnabledForLayer(): boolean;
    render(style: Style, options: PainterOptions): void;
    maybeDrawDepthAndCoords(requireExact: boolean): void;
    renderLayer(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions): void;
    saveTileTexture(texture: Texture): void;
    getTileTexture(size: number): Texture;
    isPatternMissing(image?: CrossFaded<ResolvedImage> | null): boolean;
    useProgram(name: string, programConfiguration?: ProgramConfiguration | null, forceSimpleProjection?: boolean, defines?: Array<string>): Program<any>;
    setCustomLayerDefaults(): void;
    setBaseState(): void;
    initDebugOverlayCanvas(): void;
    destroy(): void;
    overLimit(): boolean;
}
export {};
//# sourceMappingURL=painter.d.ts.map