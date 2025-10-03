import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { ErrorEvent } from '../util/evented';
export const validateStyle = validateStyleMin;
export const validateSource = validateStyle.source;
export const validateLight = validateStyle.light;
export const validateSky = validateStyle.sky;
export const validateTerrain = validateStyle.terrain;
export const validateFilter = validateStyle.filter;
export const validatePaintProperty = validateStyle.paintProperty;
export const validateLayoutProperty = validateStyle.layoutProperty;
export function emitValidationErrors(emitter, errors) {
    let hasErrors = false;
    if (errors && errors.length) {
        for (const error of errors) {
            emitter.fire(new ErrorEvent(new Error(error.message)));
            hasErrors = true;
        }
    }
    return hasErrors;
}
//# sourceMappingURL=validate_style.js.map