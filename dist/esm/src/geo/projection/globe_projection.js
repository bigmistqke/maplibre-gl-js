import { ProjectionDefinition, latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { DataConstantProperty, Properties, Transitionable } from '../../style/properties';
import { Evented } from '../../util/evented';
import { EvaluationParameters } from '../../style/evaluation_parameters';
import { MercatorProjection } from './mercator_projection';
import { VerticalPerspectiveProjection } from './vertical_perspective_projection';
const properties = new Properties({
    'type': new DataConstantProperty(styleSpec.projection.type)
});
export class GlobeProjection extends Evented {
    constructor(projection) {
        super();
        this._transitionable = new Transitionable(properties, undefined);
        this.setProjection(projection);
        this._transitioning = this._transitionable.untransitioned();
        this.recalculate(new EvaluationParameters(0));
        this._mercatorProjection = new MercatorProjection();
        this._verticalPerspectiveProjection = new VerticalPerspectiveProjection();
    }
    get transitionState() {
        const currentProjectionSpecValue = this.properties.get('type');
        if (typeof currentProjectionSpecValue === 'string' && currentProjectionSpecValue === 'mercator') {
            return 0;
        }
        if (typeof currentProjectionSpecValue === 'string' && currentProjectionSpecValue === 'vertical-perspective') {
            return 1;
        }
        if (currentProjectionSpecValue instanceof ProjectionDefinition) {
            if (currentProjectionSpecValue.from === 'vertical-perspective' && currentProjectionSpecValue.to === 'mercator') {
                return 1 - currentProjectionSpecValue.transition;
            }
            if (currentProjectionSpecValue.from === 'mercator' && currentProjectionSpecValue.to === 'vertical-perspective') {
                return currentProjectionSpecValue.transition;
            }
        }
        ;
        return 1;
    }
    get useGlobeRendering() {
        return this.transitionState > 0;
    }
    get latitudeErrorCorrectionRadians() { return this._verticalPerspectiveProjection.latitudeErrorCorrectionRadians; }
    get currentProjection() {
        return this.useGlobeRendering ? this._verticalPerspectiveProjection : this._mercatorProjection;
    }
    get name() {
        return 'globe';
    }
    get useSubdivision() {
        return this.currentProjection.useSubdivision;
    }
    get shaderVariantName() {
        return this.currentProjection.shaderVariantName;
    }
    get shaderDefine() {
        return this.currentProjection.shaderDefine;
    }
    get shaderPreludeCode() {
        return this.currentProjection.shaderPreludeCode;
    }
    get vertexShaderPreludeCode() {
        return this.currentProjection.vertexShaderPreludeCode;
    }
    get subdivisionGranularity() {
        return this.currentProjection.subdivisionGranularity;
    }
    get useGlobeControls() {
        return this.transitionState > 0;
    }
    destroy() {
        this._mercatorProjection.destroy();
        this._verticalPerspectiveProjection.destroy();
    }
    updateGPUdependent(context) {
        this._mercatorProjection.updateGPUdependent(context);
        this._verticalPerspectiveProjection.updateGPUdependent(context);
    }
    getMeshFromTileID(context, _tileID, _hasBorder, _allowPoles, _usage) {
        return this.currentProjection.getMeshFromTileID(context, _tileID, _hasBorder, _allowPoles, _usage);
    }
    setProjection(projection) {
        this._transitionable.setValue('type', (projection === null || projection === void 0 ? void 0 : projection.type) || 'mercator');
    }
    updateTransitions(parameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }
    hasTransition() {
        return this._transitioning.hasTransition() || this.currentProjection.hasTransition();
    }
    recalculate(parameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }
    setErrorQueryLatitudeDegrees(value) {
        this._verticalPerspectiveProjection.setErrorQueryLatitudeDegrees(value);
        this._mercatorProjection.setErrorQueryLatitudeDegrees(value);
    }
}
//# sourceMappingURL=globe_projection.js.map