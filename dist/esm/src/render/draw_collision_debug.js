import { DepthMode } from '../gl/depth_mode';
import { StencilMode } from '../gl/stencil_mode';
import { CullFaceMode } from '../gl/cull_face_mode';
import { collisionUniformValues, collisionCircleUniformValues } from './program/collision_program';
import { QuadTriangleArray, CollisionCircleLayoutArray } from '../data/array_types.g';
import { collisionCircleLayout } from '../data/bucket/symbol_attributes';
import { SegmentVector } from '../data/segment';
let quadTriangles;
export function drawCollisionDebug(painter, sourceCache, layer, coords, isText) {
    const context = painter.context;
    const transform = painter.transform;
    const gl = context.gl;
    const program = painter.useProgram('collisionBox');
    const tileBatches = [];
    let circleCount = 0;
    let circleOffset = 0;
    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) {
            continue;
        }
        const buffers = isText ? bucket.textCollisionBox : bucket.iconCollisionBox;
        const circleArray = bucket.collisionCircleArray;
        if (circleArray.length > 0) {
            tileBatches.push({
                circleArray,
                circleOffset,
                coord
            });
            circleCount += circleArray.length / 4;
            circleOffset = circleCount;
        }
        if (!buffers) {
            continue;
        }
        program.draw(context, gl.LINES, DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled, collisionUniformValues(painter.transform), painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord), transform.getProjectionData({ overscaledTileID: coord, applyGlobeMatrix: true, applyTerrainMatrix: true }), layer.id, buffers.layoutVertexBuffer, buffers.indexBuffer, buffers.segments, null, painter.transform.zoom, null, null, buffers.collisionVertexBuffer);
    }
    if (!isText || !tileBatches.length) {
        return;
    }
    const circleProgram = painter.useProgram('collisionCircle');
    const vertexData = new CollisionCircleLayoutArray();
    vertexData.resize(circleCount * 4);
    vertexData._trim();
    let vertexOffset = 0;
    for (const batch of tileBatches) {
        for (let i = 0; i < batch.circleArray.length / 4; i++) {
            const circleIdx = i * 4;
            const x = batch.circleArray[circleIdx + 0];
            const y = batch.circleArray[circleIdx + 1];
            const radius = batch.circleArray[circleIdx + 2];
            const collision = batch.circleArray[circleIdx + 3];
            vertexData.emplace(vertexOffset++, x, y, radius, collision, 0);
            vertexData.emplace(vertexOffset++, x, y, radius, collision, 1);
            vertexData.emplace(vertexOffset++, x, y, radius, collision, 2);
            vertexData.emplace(vertexOffset++, x, y, radius, collision, 3);
        }
    }
    if (!quadTriangles || quadTriangles.length < circleCount * 2) {
        quadTriangles = createQuadTriangles(circleCount);
    }
    const indexBuffer = context.createIndexBuffer(quadTriangles, true);
    const vertexBuffer = context.createVertexBuffer(vertexData, collisionCircleLayout.members, true);
    for (const batch of tileBatches) {
        const uniforms = collisionCircleUniformValues(painter.transform);
        circleProgram.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled, uniforms, painter.style.map.terrain && painter.style.map.terrain.getTerrainData(batch.coord), null, layer.id, vertexBuffer, indexBuffer, SegmentVector.simpleSegment(0, batch.circleOffset * 2, batch.circleArray.length, batch.circleArray.length / 2), null, painter.transform.zoom, null, null, null);
    }
    vertexBuffer.destroy();
    indexBuffer.destroy();
}
function createQuadTriangles(quadCount) {
    const triCount = quadCount * 2;
    const array = new QuadTriangleArray();
    array.resize(triCount);
    array._trim();
    for (let i = 0; i < triCount; i++) {
        const idx = i * 6;
        array.uint16[idx + 0] = i * 4 + 0;
        array.uint16[idx + 1] = i * 4 + 1;
        array.uint16[idx + 2] = i * 4 + 2;
        array.uint16[idx + 3] = i * 4 + 2;
        array.uint16[idx + 4] = i * 4 + 3;
        array.uint16[idx + 5] = i * 4 + 0;
    }
    return array;
}
//# sourceMappingURL=draw_collision_debug.js.map