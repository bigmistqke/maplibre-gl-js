import { EXTENT } from '../../data/extent';
import { getShader } from '../../shaders/shader_registry';
import { Mesh } from '../../render/mesh';
import { PosArray, TriangleIndexArray } from '../../data/array_types.g';
import { SegmentVector } from '../../data/segment';
import posAttributes from '../../data/pos_attributes';
import { SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
export const MercatorShaderDefine = '#define PROJECTION_MERCATOR';
export const MercatorShaderVariantKey = 'mercator';
export class MercatorProjection {
    constructor() {
        this._cachedMesh = null;
    }
    get name() {
        return 'mercator';
    }
    get useSubdivision() {
        return false;
    }
    get shaderVariantName() {
        return MercatorShaderVariantKey;
    }
    get shaderDefine() {
        return MercatorShaderDefine;
    }
    get shaderPreludeCode() {
        return getShader('projectionMercator');
    }
    get vertexShaderPreludeCode() {
        return getShader('projectionMercator').vertexSource;
    }
    get subdivisionGranularity() {
        return SubdivisionGranularitySetting.noSubdivision;
    }
    get useGlobeControls() {
        return false;
    }
    get transitionState() {
        return 0;
    }
    get latitudeErrorCorrectionRadians() {
        return 0;
    }
    destroy() {
    }
    updateGPUdependent(_) {
    }
    getMeshFromTileID(context, _tileID, _hasBorder, _allowPoles, _usage) {
        if (this._cachedMesh) {
            return this._cachedMesh;
        }
        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        const tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
        const tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        const quadTriangleIndices = new TriangleIndexArray();
        quadTriangleIndices.emplaceBack(1, 0, 2);
        quadTriangleIndices.emplaceBack(1, 2, 3);
        const quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);
        this._cachedMesh = new Mesh(tileExtentBuffer, quadTriangleIndexBuffer, tileExtentSegments);
        return this._cachedMesh;
    }
    recalculate() {
    }
    hasTransition() {
        return false;
    }
    setErrorQueryLatitudeDegrees(_value) {
    }
}
//# sourceMappingURL=mercator_projection.js.map