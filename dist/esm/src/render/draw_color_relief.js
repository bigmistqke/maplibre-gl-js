import { Texture } from './texture';
import { DepthMode } from '../gl/depth_mode';
import { CullFaceMode } from '../gl/cull_face_mode';
import { colorReliefUniformValues } from './program/color_relief_program';
export function drawColorRelief(painter, sourceCache, layer, tileIDs, renderOptions) {
    if (painter.renderPass !== 'translucent')
        return;
    if (!tileIDs.length)
        return;
    const { isRenderingToTexture } = renderOptions;
    const projection = painter.style.projection;
    const useSubdivision = projection.useSubdivision;
    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();
    if (useSubdivision) {
        const [stencilBorderless, stencilBorders, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
        renderColorRelief(painter, sourceCache, layer, coords, stencilBorderless, depthMode, colorMode, false, isRenderingToTexture);
        renderColorRelief(painter, sourceCache, layer, coords, stencilBorders, depthMode, colorMode, true, isRenderingToTexture);
    }
    else {
        const [stencil, coords] = painter.getStencilConfigForOverlapAndUpdateStencilID(tileIDs);
        renderColorRelief(painter, sourceCache, layer, coords, stencil, depthMode, colorMode, false, isRenderingToTexture);
    }
}
function renderColorRelief(painter, sourceCache, layer, coords, stencilModes, depthMode, colorMode, useBorder, isRenderingToTexture) {
    var _a;
    const projection = painter.style.projection;
    const context = painter.context;
    const transform = painter.transform;
    const gl = context.gl;
    const program = painter.useProgram('colorRelief');
    const align = !painter.options.moving;
    let firstTile = true;
    let colorRampSize = 0;
    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const dem = tile.dem;
        if (firstTile) {
            const maxLength = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const { elevationTexture, colorTexture } = layer.getColorRampTextures(context, maxLength, dem.getUnpackVector());
            context.activeTexture.set(gl.TEXTURE1);
            elevationTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            context.activeTexture.set(gl.TEXTURE4);
            colorTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            firstTile = false;
            colorRampSize = elevationTexture.size[0];
        }
        if (!dem || !dem.data) {
            continue;
        }
        const textureStride = dem.stride;
        const pixelData = dem.getPixels();
        context.activeTexture.set(gl.TEXTURE0);
        context.pixelStoreUnpackPremultiplyAlpha.set(false);
        tile.demTexture = tile.demTexture || painter.getTileTexture(textureStride);
        if (tile.demTexture) {
            const demTexture = tile.demTexture;
            demTexture.update(pixelData, { premultiply: false });
            demTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
        else {
            tile.demTexture = new Texture(context, pixelData, gl.RGBA, { premultiply: false });
            tile.demTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
        const mesh = projection.getMeshFromTileID(context, coord.canonical, useBorder, true, 'raster');
        const terrainData = (_a = painter.style.map.terrain) === null || _a === void 0 ? void 0 : _a.getTerrainData(coord);
        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            aligned: align,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });
        program.draw(context, gl.TRIANGLES, depthMode, stencilModes[coord.overscaledZ], colorMode, CullFaceMode.backCCW, colorReliefUniformValues(layer, tile.dem, colorRampSize), terrainData, projectionData, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}
//# sourceMappingURL=draw_color_relief.js.map