import { mat4 } from 'gl-matrix';
function getPixelPosMatrix(transform, tileID) {
    const t = mat4.create();
    mat4.translate(t, t, [1, 1, 0]);
    mat4.scale(t, t, [transform.width * 0.5, transform.height * 0.5, 1]);
    if (transform.calculatePosMatrix) {
        return mat4.multiply(t, t, transform.calculatePosMatrix(tileID.toUnwrapped()));
    }
    else {
        return t;
    }
}
function queryIncludes3DLayer(layers, styleLayers, sourceID) {
    if (layers) {
        for (const layerID of layers) {
            const layer = styleLayers[layerID];
            if (layer && layer.source === sourceID && layer.type === 'fill-extrusion') {
                return true;
            }
        }
    }
    else {
        for (const key in styleLayers) {
            const layer = styleLayers[key];
            if (layer.source === sourceID && layer.type === 'fill-extrusion') {
                return true;
            }
        }
    }
    return false;
}
export function queryRenderedFeatures(sourceCache, styleLayers, serializedLayers, queryGeometry, params, transform, getElevation) {
    var _a;
    const has3DLayer = queryIncludes3DLayer((_a = params === null || params === void 0 ? void 0 : params.layers) !== null && _a !== void 0 ? _a : null, styleLayers, sourceCache.id);
    const maxPitchScaleFactor = transform.maxPitchScaleFactor();
    const tilesIn = sourceCache.tilesIn(queryGeometry, maxPitchScaleFactor, has3DLayer);
    tilesIn.sort(sortTilesIn);
    const renderedFeatureLayers = [];
    for (const tileIn of tilesIn) {
        renderedFeatureLayers.push({
            wrappedTileID: tileIn.tileID.wrapped().key,
            queryResults: tileIn.tile.queryRenderedFeatures(styleLayers, serializedLayers, sourceCache._state, tileIn.queryGeometry, tileIn.cameraQueryGeometry, tileIn.scale, params, transform, maxPitchScaleFactor, getPixelPosMatrix(sourceCache.transform, tileIn.tileID), getElevation ? (x, y) => getElevation(tileIn.tileID, x, y) : undefined)
        });
    }
    const result = mergeRenderedFeatureLayers(renderedFeatureLayers);
    return convertFeaturesToMapFeatures(result, sourceCache);
}
export function queryRenderedSymbols(styleLayers, serializedLayers, sourceCaches, queryGeometry, params, collisionIndex, retainedQueryData) {
    const result = {};
    const renderedSymbols = collisionIndex.queryRenderedSymbols(queryGeometry);
    const bucketQueryData = [];
    for (const bucketInstanceId of Object.keys(renderedSymbols).map(Number)) {
        bucketQueryData.push(retainedQueryData[bucketInstanceId]);
    }
    bucketQueryData.sort(sortTilesIn);
    for (const queryData of bucketQueryData) {
        const bucketSymbols = queryData.featureIndex.lookupSymbolFeatures(renderedSymbols[queryData.bucketInstanceId], serializedLayers, queryData.bucketIndex, queryData.sourceLayerIndex, {
            filterSpec: params.filter,
            globalState: params.globalState
        }, params.layers, params.availableImages, styleLayers);
        for (const layerID in bucketSymbols) {
            const resultFeatures = result[layerID] = result[layerID] || [];
            const layerSymbols = bucketSymbols[layerID];
            layerSymbols.sort((a, b) => {
                const featureSortOrder = queryData.featureSortOrder;
                if (featureSortOrder) {
                    const sortedA = featureSortOrder.indexOf(a.featureIndex);
                    const sortedB = featureSortOrder.indexOf(b.featureIndex);
                    return sortedB - sortedA;
                }
                else {
                    return b.featureIndex - a.featureIndex;
                }
            });
            for (const symbolFeature of layerSymbols) {
                resultFeatures.push(symbolFeature);
            }
        }
    }
    return convertFeaturesToMapFeaturesMultiple(result, styleLayers, sourceCaches);
}
export function querySourceFeatures(sourceCache, params) {
    const tiles = sourceCache.getRenderableIds().map((id) => {
        return sourceCache.getTileByID(id);
    });
    const result = [];
    const dataTiles = {};
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const dataID = tile.tileID.canonical.key;
        if (!dataTiles[dataID]) {
            dataTiles[dataID] = true;
            tile.querySourceFeatures(result, params);
        }
    }
    return result;
}
function sortTilesIn(a, b) {
    const idA = a.tileID;
    const idB = b.tileID;
    return (idA.overscaledZ - idB.overscaledZ) || (idA.canonical.y - idB.canonical.y) || (idA.wrap - idB.wrap) || (idA.canonical.x - idB.canonical.x);
}
function mergeRenderedFeatureLayers(tiles) {
    const result = {};
    const wrappedIDLayerMap = {};
    for (const tile of tiles) {
        const queryResults = tile.queryResults;
        const wrappedID = tile.wrappedTileID;
        const wrappedIDLayers = wrappedIDLayerMap[wrappedID] = wrappedIDLayerMap[wrappedID] || {};
        for (const layerID in queryResults) {
            const tileFeatures = queryResults[layerID];
            const wrappedIDFeatures = wrappedIDLayers[layerID] = wrappedIDLayers[layerID] || {};
            const resultFeatures = result[layerID] = result[layerID] || [];
            for (const tileFeature of tileFeatures) {
                if (!wrappedIDFeatures[tileFeature.featureIndex]) {
                    wrappedIDFeatures[tileFeature.featureIndex] = true;
                    resultFeatures.push(tileFeature);
                }
            }
        }
    }
    return result;
}
function convertFeaturesToMapFeatures(result, sourceCache) {
    for (const layerID in result) {
        for (const featureWrapper of result[layerID]) {
            convertFeatureToMapFeature(featureWrapper, sourceCache);
        }
        ;
    }
    return result;
}
function convertFeaturesToMapFeaturesMultiple(result, styleLayers, sourceCaches) {
    for (const layerName in result) {
        for (const featureWrapper of result[layerName]) {
            const layer = styleLayers[layerName];
            const sourceCache = sourceCaches[layer.source];
            convertFeatureToMapFeature(featureWrapper, sourceCache);
        }
        ;
    }
    return result;
}
function convertFeatureToMapFeature(featureWrapper, sourceCache) {
    const feature = featureWrapper.feature;
    const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
    feature.source = feature.layer.source;
    if (feature.layer['source-layer']) {
        feature.sourceLayer = feature.layer['source-layer'];
    }
    feature.state = state;
}
//# sourceMappingURL=query_features.js.map