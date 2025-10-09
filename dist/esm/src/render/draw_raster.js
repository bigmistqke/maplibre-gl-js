import { clamp } from '../util/util';
import { browser } from '../util/browser';
import { StencilMode } from '../gl/stencil_mode';
import { DepthMode } from '../gl/depth_mode';
import { CullFaceMode } from '../gl/cull_face_mode';
import { rasterUniformValues } from './program/raster_program';
import { EXTENT } from '../data/extent';
import { coveringZoomLevel } from '../geo/projection/covering_tiles';
import Point from '@mapbox/point-geometry';
import { registry } from '../registry';
const cornerCoords = [
    new Point(0, 0),
    new Point(EXTENT, 0),
    new Point(EXTENT, EXTENT),
    new Point(0, EXTENT),
];
export function drawRaster(painter, sourceCache, layer, tileIDs, renderOptions) {
    if (painter.renderPass !== 'translucent')
        return;
    if (layer.paint.get('raster-opacity') === 0)
        return;
    if (!tileIDs.length)
        return;
    const { isRenderingToTexture } = renderOptions;
    const source = sourceCache.getSource();
    const projection = painter.style.projection;
    const useSubdivision = projection.useSubdivision;
    if (source instanceof registry.source.image) {
        drawTiles(painter, sourceCache, layer, tileIDs, null, false, false, source.tileCoords, source.flippedWindingOrder, isRenderingToTexture);
    }
    else if (useSubdivision) {
        const [stencilBorderless, stencilBorders, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
        drawTiles(painter, sourceCache, layer, coords, stencilBorderless, false, true, cornerCoords, false, isRenderingToTexture);
        drawTiles(painter, sourceCache, layer, coords, stencilBorders, true, true, cornerCoords, false, isRenderingToTexture);
    }
    else {
        const [stencil, coords] = painter.getStencilConfigForOverlapAndUpdateStencilID(tileIDs);
        drawTiles(painter, sourceCache, layer, coords, stencil, false, true, cornerCoords, false, isRenderingToTexture);
    }
}
function drawTiles(painter, sourceCache, layer, coords, stencilModes, useBorder, allowPoles, corners, flipCullfaceMode = false, isRenderingToTexture = false) {
    const minTileZ = coords[coords.length - 1].overscaledZ;
    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('raster');
    const transform = painter.transform;
    const projection = painter.style.projection;
    const colorMode = painter.colorModeForRenderPass();
    const align = !painter.options.moving;
    for (const coord of coords) {
        const depthMode = painter.getDepthModeForSublayer(coord.overscaledZ - minTileZ, layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);
        const tile = sourceCache.getTile(coord);
        tile.registerFadeDuration(layer.paint.get('raster-fade-duration'));
        const parentTile = sourceCache.findLoadedParent(coord, 0);
        const siblingTile = sourceCache.findLoadedSibling(coord);
        const fadeTileReference = parentTile || siblingTile || null;
        const fade = getFadeValues(tile, fadeTileReference, sourceCache, layer, painter.transform, painter.style.map.terrain);
        let parentScaleBy, parentTL;
        const textureFilter = layer.paint.get('raster-resampling') === 'nearest' ? gl.NEAREST : gl.LINEAR;
        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
        context.activeTexture.set(gl.TEXTURE1);
        if (parentTile) {
            parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
            parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
            parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];
        }
        else {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
        }
        if (tile.texture.useMipmap && context.extTextureFilterAnisotropic && painter.transform.pitch > 20) {
            gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
        }
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const projectionData = transform.getProjectionData({ overscaledTileID: coord, aligned: align, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true });
        const uniformValues = rasterUniformValues(parentTL || [0, 0], parentScaleBy || 1, fade, layer, corners);
        const mesh = projection.getMeshFromTileID(context, coord.canonical, useBorder, allowPoles, 'raster');
        const stencilMode = stencilModes ? stencilModes[coord.overscaledZ] : StencilMode.disabled;
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, flipCullfaceMode ? CullFaceMode.frontCCW : CullFaceMode.backCCW, uniformValues, terrainData, projectionData, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}
function getFadeValues(tile, parentTile, sourceCache, layer, transform, terrain) {
    const fadeDuration = layer.paint.get('raster-fade-duration');
    if (!terrain && fadeDuration > 0) {
        const now = browser.now();
        const sinceTile = (now - tile.timeAdded) / fadeDuration;
        const sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;
        const source = sourceCache.getSource();
        const idealZ = coveringZoomLevel(transform, {
            tileSize: source.tileSize,
            roundZoom: source.roundZoom
        });
        const fadeIn = !parentTile || Math.abs(parentTile.tileID.overscaledZ - idealZ) > Math.abs(tile.tileID.overscaledZ - idealZ);
        const childOpacity = (fadeIn && tile.refreshedUponExpiration) ? 1 : clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1);
        if (tile.refreshedUponExpiration && sinceTile >= 1)
            tile.refreshedUponExpiration = false;
        if (parentTile) {
            return {
                opacity: 1,
                mix: 1 - childOpacity
            };
        }
        else {
            return {
                opacity: childOpacity,
                mix: 0
            };
        }
    }
    else {
        return {
            opacity: 1,
            mix: 0
        };
    }
}
//# sourceMappingURL=draw_raster.js.map