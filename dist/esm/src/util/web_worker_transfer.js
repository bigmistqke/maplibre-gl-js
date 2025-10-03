import { TransferableGridIndex } from './transferable_grid_index';
import { Color, CompoundExpression, expressions, ResolvedImage, StylePropertyFunction, StyleExpression, ZoomDependentExpression, ZoomConstantExpression } from '@maplibre/maplibre-gl-style-spec';
import { AJAXError } from './ajax';
import { isImageBitmap } from './util';
const registry = {};
export function register(name, klass, options = {}) {
    if (registry[name])
        throw new Error(`${name} is already registered.`);
    Object.defineProperty(klass, '_classRegistryKey', {
        value: name,
        writeable: false
    });
    registry[name] = {
        klass,
        omit: options.omit || [],
        shallow: options.shallow || []
    };
}
register('Object', Object);
register('Set', Set);
register('TransferableGridIndex', TransferableGridIndex);
register('Color', Color);
register('Error', Error);
register('AJAXError', AJAXError);
register('ResolvedImage', ResolvedImage);
register('StylePropertyFunction', StylePropertyFunction);
register('StyleExpression', StyleExpression, { omit: ['_evaluator'] });
register('ZoomDependentExpression', ZoomDependentExpression);
register('ZoomConstantExpression', ZoomConstantExpression);
register('CompoundExpression', CompoundExpression, { omit: ['_evaluate'] });
for (const name in expressions) {
    if (expressions[name]._classRegistryKey)
        continue;
    register(`Expression_${name}`, expressions[name]);
}
function isArrayBuffer(value) {
    return value && typeof ArrayBuffer !== 'undefined' &&
        (value instanceof ArrayBuffer || (value.constructor && value.constructor.name === 'ArrayBuffer'));
}
function getClassRegistryKey(input) {
    const klass = input.constructor;
    return input.$name || klass._classRegistryKey;
}
function isRegistered(input) {
    if (input === null || typeof input !== 'object') {
        return false;
    }
    const classRegistryKey = getClassRegistryKey(input);
    if (classRegistryKey && classRegistryKey !== 'Object') {
        return true;
    }
    return false;
}
function isSerializeHandledByBuiltin(input) {
    return (!isRegistered(input) && (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp ||
        input instanceof Blob ||
        input instanceof Error ||
        isArrayBuffer(input) ||
        isImageBitmap(input) ||
        ArrayBuffer.isView(input) ||
        input instanceof ImageData));
}
export function serialize(input, transferables) {
    if (isSerializeHandledByBuiltin(input)) {
        if (isArrayBuffer(input) || isImageBitmap(input)) {
            if (transferables) {
                transferables.push(input);
            }
        }
        if (ArrayBuffer.isView(input)) {
            const view = input;
            if (transferables) {
                transferables.push(view.buffer);
            }
        }
        if (input instanceof ImageData) {
            if (transferables) {
                transferables.push(input.data.buffer);
            }
        }
        return input;
    }
    if (Array.isArray(input)) {
        const serialized = [];
        for (const item of input) {
            serialized.push(serialize(item, transferables));
        }
        return serialized;
    }
    if (typeof input !== 'object') {
        throw new Error(`can't serialize object of type ${typeof input}`);
    }
    const classRegistryKey = getClassRegistryKey(input);
    if (!classRegistryKey) {
        throw new Error(`can't serialize object of unregistered class ${input.constructor.name}`);
    }
    if (!registry[classRegistryKey])
        throw new Error(`${classRegistryKey} is not registered.`);
    const { klass } = registry[classRegistryKey];
    const properties = klass.serialize ?
        klass.serialize(input, transferables) : {};
    if (!klass.serialize) {
        for (const key in input) {
            if (!input.hasOwnProperty(key))
                continue;
            if (registry[classRegistryKey].omit.indexOf(key) >= 0)
                continue;
            const property = input[key];
            properties[key] = registry[classRegistryKey].shallow.indexOf(key) >= 0 ?
                property :
                serialize(property, transferables);
        }
        if (input instanceof Error) {
            properties.message = input.message;
        }
    }
    else {
        if (transferables && properties === transferables[transferables.length - 1]) {
            throw new Error('statically serialized object won\'t survive transfer of $name property');
        }
    }
    if (properties.$name) {
        throw new Error('$name property is reserved for worker serialization logic.');
    }
    if (classRegistryKey !== 'Object') {
        properties.$name = classRegistryKey;
    }
    return properties;
}
export function deserialize(input) {
    if (isSerializeHandledByBuiltin(input)) {
        return input;
    }
    if (Array.isArray(input)) {
        return input.map(deserialize);
    }
    if (typeof input !== 'object') {
        throw new Error(`can't deserialize object of type ${typeof input}`);
    }
    const classRegistryKey = getClassRegistryKey(input) || 'Object';
    if (!registry[classRegistryKey]) {
        throw new Error(`can't deserialize unregistered class ${classRegistryKey}`);
    }
    const { klass } = registry[classRegistryKey];
    if (!klass) {
        throw new Error(`can't deserialize unregistered class ${classRegistryKey}`);
    }
    if (klass.deserialize) {
        return klass.deserialize(input);
    }
    const result = Object.create(klass.prototype);
    for (const key of Object.keys(input)) {
        if (key === '$name')
            continue;
        const value = input[key];
        result[key] = registry[classRegistryKey].shallow.indexOf(key) >= 0 ? value : deserialize(value);
    }
    return result;
}
//# sourceMappingURL=web_worker_transfer.js.map