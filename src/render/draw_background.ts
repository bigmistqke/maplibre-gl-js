import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {
    backgroundUniformValues,
    backgroundPatternUniformValues
} from './program/background_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {BackgroundStyleLayer} from '../style/style_layer/background_style_layer';
import {type OverscaledTileID} from '../tile/tile_id';
import {coveringTiles} from '../geo/projection/covering_tiles';

function isBackgroundOpaque(painter: Painter, layer: BackgroundStyleLayer): boolean {
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');
    const image = layer.paint.get('background-pattern');
    return !image && color.a === 1 && opacity === 1 && painter.opaquePassEnabledForLayer();
}

export function drawBackgroundOpaque(painter: Painter, tileManager: TileManager, layer: BackgroundStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (layer.paint.get('background-opacity') === 0) return;
    if (painter.isPatternMissing(layer.paint.get('background-pattern'))) return;
    if (!isBackgroundOpaque(painter, layer)) return;

    drawBackgroundTiles(painter, layer, coords, renderOptions, DepthMode.ReadWrite);
}

export function drawBackground(painter: Painter, tileManager: TileManager, layer: BackgroundStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (layer.paint.get('background-opacity') === 0) return;
    if (painter.isPatternMissing(layer.paint.get('background-pattern'))) return;
    if (isBackgroundOpaque(painter, layer)) return;

    drawBackgroundTiles(painter, layer, coords, renderOptions, DepthMode.ReadOnly);
}

function drawBackgroundTiles(painter: Painter, layer: BackgroundStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions, depthMask: typeof DepthMode.ReadWrite | typeof DepthMode.ReadOnly) {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const projection = painter.style.projection;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const image = layer.paint.get('background-pattern');
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.getDepthModeForSublayer(0, depthMask);
    const colorMode = painter.colorModeForRenderPass();
    const program = painter.useProgram(image ? 'backgroundPattern' : 'background');
    const tileIDs = coords ? coords : coveringTiles(transform, {tileSize, surface: painter.surface});

    if (image) {
        context.activeTexture.set(gl.TEXTURE0);
        painter.imageManager.bind(painter.context);
    }

    const crossfade = layer.getCrossfadeParameters();

    for (const tileID of tileIDs) {
        const projectionData = transform.getProjectionData({
            overscaledTileID: tileID,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        const uniformValues = image ?
            backgroundPatternUniformValues(opacity, painter, image, {tileID, tileSize}, crossfade) :
            backgroundUniformValues(opacity, color);
        const terrainData = painter.surface.getBindings(tileID);

        const mesh = projection.getMeshFromTileID(context, tileID.canonical, false, true, 'raster');
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, terrainData, projectionData, layer.id,
            mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}
