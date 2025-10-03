import { interpolates, latest as styleSpec } from '@maplibre/maplibre-gl-style-spec';
import { sphericalToCartesian } from '../util/util';
import { Evented } from '../util/evented';
import { validateStyle, validateLight, emitValidationErrors } from './validate_style';
import { Properties, Transitionable, DataConstantProperty } from './properties';
class LightPositionProperty {
    constructor() {
        this.specification = styleSpec.light.position;
    }
    possiblyEvaluate(value, parameters) {
        return sphericalToCartesian(value.expression.evaluate(parameters));
    }
    interpolate(a, b, t) {
        return {
            x: interpolates.number(a.x, b.x, t),
            y: interpolates.number(a.y, b.y, t),
            z: interpolates.number(a.z, b.z, t),
        };
    }
}
const TRANSITION_SUFFIX = '-transition';
let lightProperties;
export class Light extends Evented {
    constructor(lightOptions) {
        super();
        lightProperties = lightProperties || new Properties({
            'anchor': new DataConstantProperty(styleSpec.light.anchor),
            'position': new LightPositionProperty(),
            'color': new DataConstantProperty(styleSpec.light.color),
            'intensity': new DataConstantProperty(styleSpec.light.intensity),
        });
        this._transitionable = new Transitionable(lightProperties, undefined);
        this.setLight(lightOptions);
        this._transitioning = this._transitionable.untransitioned();
    }
    getLight() {
        return this._transitionable.serialize();
    }
    setLight(light, options = {}) {
        if (this._validate(validateLight, light, options)) {
            return;
        }
        for (const name in light) {
            const value = light[name];
            if (name.endsWith(TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
            }
            else {
                this._transitionable.setValue(name, value);
            }
        }
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
    _validate(validate, value, options) {
        if (options && options.validate === false) {
            return false;
        }
        return emitValidationErrors(this, validate.call(validateStyle, {
            value,
            style: { glyphs: true, sprite: true },
            styleSpec
        }));
    }
}
//# sourceMappingURL=light.js.map