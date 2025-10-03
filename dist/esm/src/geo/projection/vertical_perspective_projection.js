import { browser } from '../../util/browser';
import { easeCubicInOut, lerp } from '../../util/util';
import { mercatorYfromLat } from '../mercator_coordinate';
import { SubdivisionGranularityExpression, SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
import { getShader } from '../../shaders/shader_registry';
import { ProjectionErrorMeasurement } from './globe_projection_error_measurement';
import { createTileMeshWithBuffers } from '../../util/create_tile_mesh';
export const VerticalPerspectiveShaderDefine = '#define GLOBE';
export const VerticalPerspectiveShaderVariantKey = 'globe';
export const globeConstants = {
    errorTransitionTimeSeconds: 0.5
};
const granularitySettingsGlobe = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(128, 2),
    line: new SubdivisionGranularityExpression(512, 0),
    tile: new SubdivisionGranularityExpression(128, 32),
    stencil: new SubdivisionGranularityExpression(128, 1),
    circle: 3
});
export class VerticalPerspectiveProjection {
    constructor() {
        this._tileMeshCache = {};
        this._errorCorrectionUsable = 0.0;
        this._errorMeasurementLastValue = 0.0;
        this._errorCorrectionPreviousValue = 0.0;
        this._errorMeasurementLastChangeTime = -1000.0;
    }
    get name() {
        return 'vertical-perspective';
    }
    get transitionState() {
        return 1;
    }
    get useSubdivision() {
        return true;
    }
    get shaderVariantName() {
        return VerticalPerspectiveShaderVariantKey;
    }
    get shaderDefine() {
        return VerticalPerspectiveShaderDefine;
    }
    get shaderPreludeCode() {
        return getShader('projectionGlobe');
    }
    get vertexShaderPreludeCode() {
        return getShader('projectionMercator').vertexSource;
    }
    get subdivisionGranularity() {
        return granularitySettingsGlobe;
    }
    get useGlobeControls() {
        return true;
    }
    get latitudeErrorCorrectionRadians() { return this._errorCorrectionUsable; }
    destroy() {
        if (this._errorMeasurement) {
            this._errorMeasurement.destroy();
        }
    }
    updateGPUdependent(renderContext) {
        if (!this._errorMeasurement) {
            this._errorMeasurement = new ProjectionErrorMeasurement(renderContext);
        }
        const mercatorY = mercatorYfromLat(this._errorQueryLatitudeDegrees);
        const expectedResult = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
        const newValue = this._errorMeasurement.updateErrorLoop(mercatorY, expectedResult);
        const now = browser.now();
        if (newValue !== this._errorMeasurementLastValue) {
            this._errorCorrectionPreviousValue = this._errorCorrectionUsable;
            this._errorMeasurementLastValue = newValue;
            this._errorMeasurementLastChangeTime = now;
        }
        const sinceUpdateSeconds = (now - this._errorMeasurementLastChangeTime) / 1000.0;
        const mix = Math.min(Math.max(sinceUpdateSeconds / globeConstants.errorTransitionTimeSeconds, 0.0), 1.0);
        const newCorrection = -this._errorMeasurementLastValue;
        this._errorCorrectionUsable = lerp(this._errorCorrectionPreviousValue, newCorrection, easeCubicInOut(mix));
    }
    _getMeshKey(options) {
        return `${options.granularity.toString(36)}_${options.generateBorders ? 'b' : ''}${options.extendToNorthPole ? 'n' : ''}${options.extendToSouthPole ? 's' : ''}`;
    }
    getMeshFromTileID(context, canonical, hasBorder, allowPoles, usage) {
        const granularityConfig = usage === 'stencil' ? granularitySettingsGlobe.stencil : granularitySettingsGlobe.tile;
        const granularity = granularityConfig.getGranularityForZoomLevel(canonical.z);
        const north = (canonical.y === 0) && allowPoles;
        const south = (canonical.y === (1 << canonical.z) - 1) && allowPoles;
        return this._getMesh(context, {
            granularity,
            generateBorders: hasBorder,
            extendToNorthPole: north,
            extendToSouthPole: south,
        });
    }
    _getMesh(context, options) {
        const key = this._getMeshKey(options);
        if (key in this._tileMeshCache) {
            return this._tileMeshCache[key];
        }
        const mesh = createTileMeshWithBuffers(context, options);
        this._tileMeshCache[key] = mesh;
        return mesh;
    }
    recalculate(_params) {
    }
    hasTransition() {
        const now = browser.now();
        let dirty = false;
        dirty = dirty || (now - this._errorMeasurementLastChangeTime) / 1000.0 < (globeConstants.errorTransitionTimeSeconds + 0.2);
        dirty = dirty || (this._errorMeasurement && this._errorMeasurement.awaitingQuery);
        return dirty;
    }
    setErrorQueryLatitudeDegrees(value) {
        this._errorQueryLatitudeDegrees = value;
    }
}
//# sourceMappingURL=vertical_perspective_projection.js.map