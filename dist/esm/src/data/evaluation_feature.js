import { loadGeometry } from './load_geometry';
export function toEvaluationFeature(feature, needGeometry) {
    return { type: feature.type,
        id: feature.id,
        properties: feature.properties,
        geometry: needGeometry ? loadGeometry(feature) : [] };
}
//# sourceMappingURL=evaluation_feature.js.map