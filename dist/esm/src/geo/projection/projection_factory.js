import { registry } from '../../registry';
export function createProjectionFromName(name) {
    if (Array.isArray(name)) {
        const globeProjection = new registry.projection.globe.projection({ type: name });
        return {
            projection: globeProjection,
            transform: new registry.projection.globe.transform(),
            cameraHelper: new registry.projection.globe.cameraHelper(globeProjection),
        };
    }
    if (name === 'globe') {
        const globeProjection = new registry.projection.globe.projection({ type: [
                'interpolate',
                ['linear'],
                ['zoom'],
                11,
                'vertical-perspective',
                12,
                'mercator'
            ] });
        return {
            projection: globeProjection,
            transform: new registry.projection.globe.transform(),
            cameraHelper: new registry.projection.globe.cameraHelper(globeProjection),
        };
    }
    if (typeof name === 'string' && name in registry.projection) {
        return {
            projection: new registry.projection[name].projection(),
            transform: new registry.projection[name].transform(),
            cameraHelper: new registry.projection[name].cameraHelper(),
        };
    }
    throw `Unknown projection name: ${name}. Falling back to mercator projection.`;
}
//# sourceMappingURL=projection_factory.js.map