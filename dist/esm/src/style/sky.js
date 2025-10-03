import { DataConstantProperty, Properties, Transitionable } from './properties';
import { Evented } from '../util/evented';
import { EvaluationParameters } from './evaluation_parameters';
import { emitValidationErrors, validateSky, validateStyle } from './validate_style';
import { extend } from '../util/util';
import { latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
const properties = new Properties({
    'sky-color': new DataConstantProperty(styleSpec.sky['sky-color']),
    'horizon-color': new DataConstantProperty(styleSpec.sky['horizon-color']),
    'fog-color': new DataConstantProperty(styleSpec.sky['fog-color']),
    'fog-ground-blend': new DataConstantProperty(styleSpec.sky['fog-ground-blend']),
    'horizon-fog-blend': new DataConstantProperty(styleSpec.sky['horizon-fog-blend']),
    'sky-horizon-blend': new DataConstantProperty(styleSpec.sky['sky-horizon-blend']),
    'atmosphere-blend': new DataConstantProperty(styleSpec.sky['atmosphere-blend'])
});
const TRANSITION_SUFFIX = '-transition';
export class Sky extends Evented {
    constructor(sky) {
        super();
        this._transitionable = new Transitionable(properties, undefined);
        this.setSky(sky);
        this._transitioning = this._transitionable.untransitioned();
        this.recalculate(new EvaluationParameters(0));
    }
    setSky(sky, options = {}) {
        if (this._validate(validateSky, sky, options))
            return;
        if (!sky) {
            sky = {
                'sky-color': 'transparent',
                'horizon-color': 'transparent',
                'fog-color': 'transparent',
                'fog-ground-blend': 1,
                'atmosphere-blend': 0,
            };
        }
        for (const name in sky) {
            const value = sky[name];
            if (name.endsWith(TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
            }
            else {
                this._transitionable.setValue(name, value);
            }
        }
    }
    getSky() {
        return this._transitionable.serialize();
    }
    updateTransitions(parameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }
    hasTransition() {
        return this._transitioning.hasTransition();
    }
    recalculate(parameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }
    _validate(validate, value, options = {}) {
        if ((options === null || options === void 0 ? void 0 : options.validate) === false) {
            return false;
        }
        return emitValidationErrors(this, validate.call(validateStyle, extend({
            value,
            style: { glyphs: true, sprite: true },
            styleSpec
        })));
    }
    calculateFogBlendOpacity(pitch) {
        if (pitch < 60)
            return 0;
        if (pitch < 70)
            return (pitch - 60) / 10;
        return 1;
    }
}
//# sourceMappingURL=sky.js.map