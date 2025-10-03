var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getJSON } from '../util/ajax';
import { RequestPerformance } from '../util/performance';
import rewind from '@mapbox/geojson-rewind';
import { fromVectorTileJs, GeoJSONWrapper } from '@maplibre/vt-pbf';
import { EXTENT } from '../data/extent';
import Supercluster from 'supercluster';
import geojsonvt from 'geojson-vt';
import { VectorTileWorkerSource } from './vector_tile_worker_source';
import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import { isAbortError } from '../util/abort_error';
import { isUpdateableGeoJSON, applySourceDiff, toUpdateable } from './geojson_source_diff';
export class GeoJSONWorkerSource extends VectorTileWorkerSource {
    constructor() {
        super(...arguments);
        this._dataUpdateable = new Map();
    }
    loadVectorTile(params, _abortController) {
        return __awaiter(this, void 0, void 0, function* () {
            const canonical = params.tileID.canonical;
            if (!this._geoJSONIndex) {
                throw new Error('Unable to parse the data into a cluster or geojson');
            }
            const geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
            if (!geoJSONTile) {
                return null;
            }
            const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features, { version: 2, extent: EXTENT });
            let pbf = fromVectorTileJs(geojsonWrapper);
            if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
                pbf = new Uint8Array(pbf);
            }
            return {
                vectorTile: geojsonWrapper,
                rawData: pbf.buffer
            };
        });
    }
    loadData(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this._pendingRequest) === null || _a === void 0 ? void 0 : _a.abort();
            const perf = (params && params.request && params.request.collectResourceTiming) ?
                new RequestPerformance(params.request) : false;
            this._pendingRequest = new AbortController();
            try {
                this._pendingData = this.loadAndProcessGeoJSON(params, this._pendingRequest);
                const data = yield this._pendingData;
                this._geoJSONIndex = params.cluster ?
                    new Supercluster(getSuperclusterOptions(params)).load(data.features) :
                    geojsonvt(data, params.geojsonVtOptions);
                this.loaded = {};
                const result = { data };
                if (perf) {
                    const resourceTimingData = perf.finish();
                    if (resourceTimingData) {
                        result.resourceTiming = {};
                        result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
                    }
                }
                return result;
            }
            catch (err) {
                delete this._pendingRequest;
                if (isAbortError(err)) {
                    return { abandoned: true };
                }
                throw err;
            }
        });
    }
    getData() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._pendingData;
        });
    }
    reloadTile(params) {
        const loaded = this.loaded, uid = params.uid;
        if (loaded && loaded[uid]) {
            return super.reloadTile(params);
        }
        else {
            return this.loadTile(params);
        }
    }
    loadAndProcessGeoJSON(params, abortController) {
        return __awaiter(this, void 0, void 0, function* () {
            let data = yield this.loadGeoJSON(params, abortController);
            delete this._pendingRequest;
            if (typeof data !== 'object') {
                throw new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`);
            }
            rewind(data, true);
            if (params.filter) {
                const compiled = createExpression(params.filter, { type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false });
                if (compiled.result === 'error')
                    throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
                const features = data.features.filter(feature => compiled.value.evaluate({ zoom: 0 }, feature));
                data = { type: 'FeatureCollection', features };
            }
            return data;
        });
    }
    loadGeoJSON(params, abortController) {
        return __awaiter(this, void 0, void 0, function* () {
            const { promoteId } = params;
            if (params.request) {
                const response = yield getJSON(params.request, abortController);
                this._dataUpdateable = isUpdateableGeoJSON(response.data, promoteId) ? toUpdateable(response.data, promoteId) : undefined;
                return response.data;
            }
            if (typeof params.data === 'string') {
                try {
                    const parsed = JSON.parse(params.data);
                    this._dataUpdateable = isUpdateableGeoJSON(parsed, promoteId) ? toUpdateable(parsed, promoteId) : undefined;
                    return parsed;
                }
                catch (_a) {
                    throw new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`);
                }
            }
            if (!params.dataDiff) {
                throw new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`);
            }
            if (!this._dataUpdateable) {
                throw new Error(`Cannot update existing geojson data in ${params.source}`);
            }
            applySourceDiff(this._dataUpdateable, params.dataDiff, promoteId);
            return { type: 'FeatureCollection', features: Array.from(this._dataUpdateable.values()) };
        });
    }
    removeSource(_params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._pendingRequest) {
                this._pendingRequest.abort();
            }
        });
    }
    getClusterExpansionZoom(params) {
        return this._geoJSONIndex.getClusterExpansionZoom(params.clusterId);
    }
    getClusterChildren(params) {
        return this._geoJSONIndex.getChildren(params.clusterId);
    }
    getClusterLeaves(params) {
        return this._geoJSONIndex.getLeaves(params.clusterId, params.limit, params.offset);
    }
}
function getSuperclusterOptions({ superclusterOptions, clusterProperties }) {
    if (!clusterProperties || !superclusterOptions)
        return superclusterOptions;
    const mapExpressions = {};
    const reduceExpressions = {};
    const globals = { accumulated: null, zoom: 0 };
    const feature = { properties: null };
    const propertyNames = Object.keys(clusterProperties);
    for (const key of propertyNames) {
        const [operator, mapExpression] = clusterProperties[key];
        const mapExpressionParsed = createExpression(mapExpression);
        const reduceExpressionParsed = createExpression(typeof operator === 'string' ? [operator, ['accumulated'], ['get', key]] : operator);
        mapExpressions[key] = mapExpressionParsed.value;
        reduceExpressions[key] = reduceExpressionParsed.value;
    }
    superclusterOptions.map = (pointProperties) => {
        feature.properties = pointProperties;
        const properties = {};
        for (const key of propertyNames) {
            properties[key] = mapExpressions[key].evaluate(globals, feature);
        }
        return properties;
    };
    superclusterOptions.reduce = (accumulated, clusterProperties) => {
        feature.properties = clusterProperties;
        for (const key of propertyNames) {
            globals.accumulated = accumulated[key];
            accumulated[key] = reduceExpressions[key].evaluate(globals, feature);
        }
    };
    return superclusterOptions;
}
//# sourceMappingURL=geojson_worker_source.js.map