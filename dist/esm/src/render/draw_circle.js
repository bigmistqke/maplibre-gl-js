import { StencilMode } from '../gl/stencil_mode';
import { DepthMode } from '../gl/depth_mode';
import { CullFaceMode } from '../gl/cull_face_mode';
import { circleUniformValues } from './program/circle_program';
import { SegmentVector } from '../data/segment';
import { translatePosition } from '../util/util';
export function drawCircles(painter, sourceCache, layer, coords, renderOptions) {
    if (painter.renderPass !== 'translucent')
        return;
    const { isRenderingToTexture } = renderOptions;
    const opacity = layer.paint.get('circle-opacity');
    const strokeWidth = layer.paint.get('circle-stroke-width');
    const strokeOpacity = layer.paint.get('circle-stroke-opacity');
    const sortFeaturesByKey = !layer.layout.get('circle-sort-key').isConstant();
    if (opacity.constantOr(1) === 0 && (strokeWidth.constantOr(1) === 0 || strokeOpacity.constantOr(1) === 0)) {
        return;
    }
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const segmentsRenderStates = [];
    const radiusCorrectionFactor = transform.getCircleRadiusCorrection();
    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket)
            continue;
        const styleTranslate = layer.paint.get('circle-translate');
        const styleTranslateAnchor = layer.paint.get('circle-translate-anchor');
        const translateForUniforms = translatePosition(transform, tile, styleTranslate, styleTranslateAnchor);
        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('circle', programConfiguration);
        const layoutVertexBuffer = bucket.layoutVertexBuffer;
        const indexBuffer = bucket.indexBuffer;
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);
        const uniformValues = circleUniformValues(painter, tile, layer, translateForUniforms, radiusCorrectionFactor);
        const projectionData = transform.getProjectionData({ overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true });
        const state = {
            programConfiguration,
            program,
            layoutVertexBuffer,
            indexBuffer,
            uniformValues,
            terrainData,
            projectionData
        };
        if (sortFeaturesByKey) {
            const oldSegments = bucket.segments.get();
            for (const segment of oldSegments) {
                segmentsRenderStates.push({
                    segments: new SegmentVector([segment]),
                    sortKey: segment.sortKey,
                    state
                });
            }
        }
        else {
            segmentsRenderStates.push({
                segments: bucket.segments,
                sortKey: 0,
                state
            });
        }
    }
    if (sortFeaturesByKey) {
        segmentsRenderStates.sort((a, b) => a.sortKey - b.sortKey);
    }
    for (const segmentsState of segmentsRenderStates) {
        const { programConfiguration, program, layoutVertexBuffer, indexBuffer, uniformValues, terrainData, projectionData } = segmentsState.state;
        const segments = segmentsState.segments;
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, projectionData, layer.id, layoutVertexBuffer, indexBuffer, segments, layer.paint, painter.transform.zoom, programConfiguration);
    }
}
//# sourceMappingURL=draw_circle.js.map