import { DepthMode } from '../gl/depth_mode';
import { StencilMode } from '../gl/stencil_mode';
import { ColorMode } from '../gl/color_mode';
import { CullFaceMode } from '../gl/cull_face_mode';
import { fillExtrusionUniformValues, fillExtrusionPatternUniformValues, } from './program/fill_extrusion_program';
import { updatePatternPositionsInProgram } from './update_pattern_positions_in_program';
import { translatePosition } from '../util/util';
export function drawFillExtrusion(painter, source, layer, coords, renderOptions) {
    const opacity = layer.paint.get('fill-extrusion-opacity');
    if (opacity === 0) {
        return;
    }
    const { isRenderingToTexture } = renderOptions;
    if (painter.renderPass === 'translucent') {
        const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
        if (opacity === 1 && !layer.paint.get('fill-extrusion-pattern').constantOr(1)) {
            const colorMode = painter.colorModeForRenderPass();
            drawExtrusionTiles(painter, source, layer, coords, depthMode, StencilMode.disabled, colorMode, isRenderingToTexture);
        }
        else {
            drawExtrusionTiles(painter, source, layer, coords, depthMode, StencilMode.disabled, ColorMode.disabled, isRenderingToTexture);
            drawExtrusionTiles(painter, source, layer, coords, depthMode, painter.stencilModeFor3D(), painter.colorModeForRenderPass(), isRenderingToTexture);
        }
    }
}
function drawExtrusionTiles(painter, source, layer, coords, depthMode, stencilMode, colorMode, isRenderingToTexture) {
    const context = painter.context;
    const gl = context.gl;
    const fillPropertyName = 'fill-extrusion-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty.constantOr(1);
    const crossfade = layer.getCrossfadeParameters();
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const constantPattern = patternProperty.constantOr(null);
    const transform = painter.transform;
    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket)
            continue;
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration);
        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePaintBuffers(crossfade);
        }
        const projectionData = transform.getProjectionData({ overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true });
        updatePatternPositionsInProgram(programConfiguration, fillPropertyName, constantPattern, tile, layer);
        const translate = translatePosition(transform, tile, layer.paint.get('fill-extrusion-translate'), layer.paint.get('fill-extrusion-translate-anchor'));
        const shouldUseVerticalGradient = layer.paint.get('fill-extrusion-vertical-gradient');
        const uniformValues = image ?
            fillExtrusionPatternUniformValues(painter, shouldUseVerticalGradient, opacity, translate, coord, crossfade, tile) :
            fillExtrusionUniformValues(painter, shouldUseVerticalGradient, opacity, translate);
        program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, projectionData, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments, layer.paint, painter.transform.zoom, programConfiguration, painter.style.map.terrain && bucket.centroidVertexBuffer);
    }
}
//# sourceMappingURL=draw_fill_extrusion.js.map