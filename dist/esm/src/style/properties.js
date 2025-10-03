import { clone, extend, easeCubicInOut } from '../util/util';
import { interpolates, normalizePropertyExpression } from '@maplibre/maplibre-gl-style-spec';
import { register } from '../util/web_worker_transfer';
import { EvaluationParameters } from './evaluation_parameters';
export class PropertyValue {
    constructor(property, value, globalState) {
        this.property = property;
        this.value = value;
        this.expression = normalizePropertyExpression(value === undefined ? property.specification.default : value, property.specification, globalState);
    }
    isDataDriven() {
        return this.expression.kind === 'source' || this.expression.kind === 'composite';
    }
    getGlobalStateRefs() {
        return this.expression.globalStateRefs || new Set();
    }
    possiblyEvaluate(parameters, canonical, availableImages) {
        return this.property.possiblyEvaluate(this, parameters, canonical, availableImages);
    }
}
class TransitionablePropertyValue {
    constructor(property, globalState) {
        this.property = property;
        this.value = new PropertyValue(property, undefined, globalState);
    }
    transitioned(parameters, prior) {
        return new TransitioningPropertyValue(this.property, this.value, prior, extend({}, parameters.transition, this.transition), parameters.now);
    }
    untransitioned() {
        return new TransitioningPropertyValue(this.property, this.value, null, {}, 0);
    }
}
export class Transitionable {
    constructor(properties, globalState) {
        this._properties = properties;
        this._values = Object.create(properties.defaultTransitionablePropertyValues);
        this._globalState = globalState;
    }
    getValue(name) {
        return clone(this._values[name].value.value);
    }
    setValue(name, value) {
        if (!Object.prototype.hasOwnProperty.call(this._values, name)) {
            this._values[name] = new TransitionablePropertyValue(this._values[name].property, this._globalState);
        }
        this._values[name].value = new PropertyValue(this._values[name].property, value === null ? undefined : clone(value), this._globalState);
    }
    getTransition(name) {
        return clone(this._values[name].transition);
    }
    setTransition(name, value) {
        if (!Object.prototype.hasOwnProperty.call(this._values, name)) {
            this._values[name] = new TransitionablePropertyValue(this._values[name].property, this._globalState);
        }
        this._values[name].transition = clone(value) || undefined;
    }
    serialize() {
        const result = {};
        for (const property of Object.keys(this._values)) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }
            const transition = this.getTransition(property);
            if (transition !== undefined) {
                result[`${property}-transition`] = transition;
            }
        }
        return result;
    }
    transitioned(parameters, prior) {
        const result = new Transitioning(this._properties);
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].transitioned(parameters, prior._values[property]);
        }
        return result;
    }
    untransitioned() {
        const result = new Transitioning(this._properties);
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].untransitioned();
        }
        return result;
    }
}
class TransitioningPropertyValue {
    constructor(property, value, prior, transition, now) {
        this.property = property;
        this.value = value;
        this.begin = now + transition.delay || 0;
        this.end = this.begin + transition.duration || 0;
        if (property.specification.transition && (transition.delay || transition.duration)) {
            this.prior = prior;
        }
    }
    possiblyEvaluate(parameters, canonical, availableImages) {
        const now = parameters.now || 0;
        const finalValue = this.value.possiblyEvaluate(parameters, canonical, availableImages);
        const prior = this.prior;
        if (!prior) {
            return finalValue;
        }
        else if (now > this.end) {
            this.prior = null;
            return finalValue;
        }
        else if (this.value.isDataDriven()) {
            this.prior = null;
            return finalValue;
        }
        else if (now < this.begin) {
            return prior.possiblyEvaluate(parameters, canonical, availableImages);
        }
        else {
            const t = (now - this.begin) / (this.end - this.begin);
            return this.property.interpolate(prior.possiblyEvaluate(parameters, canonical, availableImages), finalValue, easeCubicInOut(t));
        }
    }
}
export class Transitioning {
    constructor(properties) {
        this._properties = properties;
        this._values = Object.create(properties.defaultTransitioningPropertyValues);
    }
    possiblyEvaluate(parameters, canonical, availableImages) {
        const result = new PossiblyEvaluated(this._properties);
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].possiblyEvaluate(parameters, canonical, availableImages);
        }
        return result;
    }
    hasTransition() {
        for (const property of Object.keys(this._values)) {
            if (this._values[property].prior) {
                return true;
            }
        }
        return false;
    }
}
export class Layout {
    constructor(properties, globalState) {
        this._properties = properties;
        this._values = Object.create(properties.defaultPropertyValues);
        this._globalState = globalState;
    }
    hasValue(name) {
        return this._values[name].value !== undefined;
    }
    getValue(name) {
        return clone(this._values[name].value);
    }
    setValue(name, value) {
        this._values[name] = new PropertyValue(this._values[name].property, value === null ? undefined : clone(value), this._globalState);
    }
    serialize() {
        const result = {};
        for (const property of Object.keys(this._values)) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }
        }
        return result;
    }
    possiblyEvaluate(parameters, canonical, availableImages) {
        const result = new PossiblyEvaluated(this._properties);
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].possiblyEvaluate(parameters, canonical, availableImages);
        }
        return result;
    }
}
export class PossiblyEvaluatedPropertyValue {
    constructor(property, value, parameters) {
        this.property = property;
        this.value = value;
        this.parameters = parameters;
    }
    isConstant() {
        return this.value.kind === 'constant';
    }
    constantOr(value) {
        if (this.value.kind === 'constant') {
            return this.value.value;
        }
        else {
            return value;
        }
    }
    evaluate(feature, featureState, canonical, availableImages) {
        return this.property.evaluate(this.value, this.parameters, feature, featureState, canonical, availableImages);
    }
}
export class PossiblyEvaluated {
    constructor(properties) {
        this._properties = properties;
        this._values = Object.create(properties.defaultPossiblyEvaluatedValues);
    }
    get(name) {
        return this._values[name];
    }
}
export class DataConstantProperty {
    constructor(specification) {
        this.specification = specification;
    }
    possiblyEvaluate(value, parameters) {
        if (value.isDataDriven())
            throw new Error('Value should not be data driven');
        return value.expression.evaluate(parameters);
    }
    interpolate(a, b, t) {
        const interpolationType = this.specification.type;
        const interpolationFn = interpolates[interpolationType];
        if (interpolationFn) {
            return interpolationFn(a, b, t);
        }
        else {
            return a;
        }
    }
}
export class DataDrivenProperty {
    constructor(specification, overrides) {
        this.specification = specification;
        this.overrides = overrides;
    }
    possiblyEvaluate(value, parameters, canonical, availableImages) {
        if (value.expression.kind === 'constant' || value.expression.kind === 'camera') {
            return new PossiblyEvaluatedPropertyValue(this, { kind: 'constant', value: value.expression.evaluate(parameters, null, {}, canonical, availableImages) }, parameters);
        }
        else {
            return new PossiblyEvaluatedPropertyValue(this, value.expression, parameters);
        }
    }
    interpolate(a, b, t) {
        if (a.value.kind !== 'constant' || b.value.kind !== 'constant') {
            return a;
        }
        if (a.value.value === undefined || b.value.value === undefined) {
            return new PossiblyEvaluatedPropertyValue(this, { kind: 'constant', value: undefined }, a.parameters);
        }
        const interpolationType = this.specification.type;
        const interpolationFn = interpolates[interpolationType];
        if (interpolationFn) {
            const interpolatedValue = interpolationFn(a.value.value, b.value.value, t);
            return new PossiblyEvaluatedPropertyValue(this, { kind: 'constant', value: interpolatedValue }, a.parameters);
        }
        else {
            return a;
        }
    }
    evaluate(value, parameters, feature, featureState, canonical, availableImages) {
        if (value.kind === 'constant') {
            return value.value;
        }
        else {
            return value.evaluate(parameters, feature, featureState, canonical, availableImages);
        }
    }
}
export class CrossFadedDataDrivenProperty extends DataDrivenProperty {
    possiblyEvaluate(value, parameters, canonical, availableImages) {
        if (value.value === undefined) {
            return new PossiblyEvaluatedPropertyValue(this, { kind: 'constant', value: undefined }, parameters);
        }
        else if (value.expression.kind === 'constant') {
            const evaluatedValue = value.expression.evaluate(parameters, null, {}, canonical, availableImages);
            const isImageExpression = value.property.specification.type === 'resolvedImage';
            const constantValue = isImageExpression && typeof evaluatedValue !== 'string' ? evaluatedValue.name : evaluatedValue;
            const constant = this._calculate(constantValue, constantValue, constantValue, parameters);
            return new PossiblyEvaluatedPropertyValue(this, { kind: 'constant', value: constant }, parameters);
        }
        else if (value.expression.kind === 'camera') {
            const cameraVal = this._calculate(value.expression.evaluate({ zoom: parameters.zoom - 1.0 }), value.expression.evaluate({ zoom: parameters.zoom }), value.expression.evaluate({ zoom: parameters.zoom + 1.0 }), parameters);
            return new PossiblyEvaluatedPropertyValue(this, { kind: 'constant', value: cameraVal }, parameters);
        }
        else {
            return new PossiblyEvaluatedPropertyValue(this, value.expression, parameters);
        }
    }
    evaluate(value, globals, feature, featureState, canonical, availableImages) {
        if (value.kind === 'source') {
            const constant = value.evaluate(globals, feature, featureState, canonical, availableImages);
            return this._calculate(constant, constant, constant, globals);
        }
        else if (value.kind === 'composite') {
            return this._calculate(value.evaluate({ zoom: Math.floor(globals.zoom) - 1.0 }, feature, featureState), value.evaluate({ zoom: Math.floor(globals.zoom) }, feature, featureState), value.evaluate({ zoom: Math.floor(globals.zoom) + 1.0 }, feature, featureState), globals);
        }
        else {
            return value.value;
        }
    }
    _calculate(min, mid, max, parameters) {
        const z = parameters.zoom;
        return z > parameters.zoomHistory.lastIntegerZoom ? { from: min, to: mid } : { from: max, to: mid };
    }
    interpolate(a) {
        return a;
    }
}
export class CrossFadedProperty {
    constructor(specification) {
        this.specification = specification;
    }
    possiblyEvaluate(value, parameters, canonical, availableImages) {
        if (value.value === undefined) {
            return undefined;
        }
        else if (value.expression.kind === 'constant') {
            const constant = value.expression.evaluate(parameters, null, {}, canonical, availableImages);
            return this._calculate(constant, constant, constant, parameters);
        }
        else {
            return this._calculate(value.expression.evaluate(new EvaluationParameters(Math.floor(parameters.zoom - 1.0), parameters)), value.expression.evaluate(new EvaluationParameters(Math.floor(parameters.zoom), parameters)), value.expression.evaluate(new EvaluationParameters(Math.floor(parameters.zoom + 1.0), parameters)), parameters);
        }
    }
    _calculate(min, mid, max, parameters) {
        const z = parameters.zoom;
        return z > parameters.zoomHistory.lastIntegerZoom ? { from: min, to: mid } : { from: max, to: mid };
    }
    interpolate(a) {
        return a;
    }
}
export class ColorRampProperty {
    constructor(specification) {
        this.specification = specification;
    }
    possiblyEvaluate(value, parameters, canonical, availableImages) {
        return !!value.expression.evaluate(parameters, null, {}, canonical, availableImages);
    }
    interpolate() { return false; }
}
export class Properties {
    constructor(properties) {
        this.properties = properties;
        this.defaultPropertyValues = {};
        this.defaultTransitionablePropertyValues = {};
        this.defaultTransitioningPropertyValues = {};
        this.defaultPossiblyEvaluatedValues = {};
        this.overridableProperties = [];
        for (const property in properties) {
            const prop = properties[property];
            if (prop.specification.overridable) {
                this.overridableProperties.push(property);
            }
            const defaultPropertyValue = this.defaultPropertyValues[property] =
                new PropertyValue(prop, undefined, undefined);
            const defaultTransitionablePropertyValue = this.defaultTransitionablePropertyValues[property] =
                new TransitionablePropertyValue(prop, undefined);
            this.defaultTransitioningPropertyValues[property] =
                defaultTransitionablePropertyValue.untransitioned();
            this.defaultPossiblyEvaluatedValues[property] =
                defaultPropertyValue.possiblyEvaluate({});
        }
    }
}
register('DataDrivenProperty', DataDrivenProperty);
register('DataConstantProperty', DataConstantProperty);
register('CrossFadedDataDrivenProperty', CrossFadedDataDrivenProperty);
register('CrossFadedProperty', CrossFadedProperty);
register('ColorRampProperty', ColorRampProperty);
//# sourceMappingURL=properties.js.map