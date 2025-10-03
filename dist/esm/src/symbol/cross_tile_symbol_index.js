import KDBush from 'kdbush';
import { EXTENT } from '../data/extent';
const roundingFactor = 512 / EXTENT / 2;
export const KDBUSH_THRESHHOLD = 128;
class TileLayerIndex {
    constructor(tileID, symbolInstances, bucketInstanceId) {
        this.tileID = tileID;
        this.bucketInstanceId = bucketInstanceId;
        this._symbolsByKey = {};
        const symbolInstancesByKey = new Map();
        for (let i = 0; i < symbolInstances.length; i++) {
            const symbolInstance = symbolInstances.get(i);
            const key = symbolInstance.key;
            const instances = symbolInstancesByKey.get(key);
            if (instances) {
                instances.push(symbolInstance);
            }
            else {
                symbolInstancesByKey.set(key, [symbolInstance]);
            }
        }
        for (const [key, symbols] of symbolInstancesByKey) {
            const positions = symbols.map(symbolInstance => ({ x: Math.floor(symbolInstance.anchorX * roundingFactor), y: Math.floor(symbolInstance.anchorY * roundingFactor) }));
            const crossTileIDs = symbols.map(v => v.crossTileID);
            const entry = { positions, crossTileIDs };
            if (entry.positions.length > KDBUSH_THRESHHOLD) {
                const index = new KDBush(entry.positions.length, 16, Uint16Array);
                for (const { x, y } of entry.positions)
                    index.add(x, y);
                index.finish();
                delete entry.positions;
                entry.index = index;
            }
            this._symbolsByKey[key] = entry;
        }
    }
    getScaledCoordinates(symbolInstance, childTileID) {
        const { x: localX, y: localY, z: localZ } = this.tileID.canonical;
        const { x, y, z } = childTileID.canonical;
        const zDifference = z - localZ;
        const scale = roundingFactor / Math.pow(2, zDifference);
        const xWorld = (x * EXTENT + symbolInstance.anchorX) * scale;
        const yWorld = (y * EXTENT + symbolInstance.anchorY) * scale;
        const xOffset = localX * EXTENT * roundingFactor;
        const yOffset = localY * EXTENT * roundingFactor;
        const result = {
            x: Math.floor(xWorld - xOffset),
            y: Math.floor(yWorld - yOffset)
        };
        return result;
    }
    findMatches(symbolInstances, newTileID, zoomCrossTileIDs) {
        const tolerance = this.tileID.canonical.z < newTileID.canonical.z ? 1 : Math.pow(2, this.tileID.canonical.z - newTileID.canonical.z);
        for (let i = 0; i < symbolInstances.length; i++) {
            const symbolInstance = symbolInstances.get(i);
            if (symbolInstance.crossTileID) {
                continue;
            }
            const entry = this._symbolsByKey[symbolInstance.key];
            if (!entry) {
                continue;
            }
            const scaledSymbolCoord = this.getScaledCoordinates(symbolInstance, newTileID);
            if (entry.index) {
                const indexes = entry.index.range(scaledSymbolCoord.x - tolerance, scaledSymbolCoord.y - tolerance, scaledSymbolCoord.x + tolerance, scaledSymbolCoord.y + tolerance).sort();
                for (const i of indexes) {
                    const crossTileID = entry.crossTileIDs[i];
                    if (!zoomCrossTileIDs[crossTileID]) {
                        zoomCrossTileIDs[crossTileID] = true;
                        symbolInstance.crossTileID = crossTileID;
                        break;
                    }
                }
            }
            else if (entry.positions) {
                for (let i = 0; i < entry.positions.length; i++) {
                    const thisTileSymbol = entry.positions[i];
                    const crossTileID = entry.crossTileIDs[i];
                    if (Math.abs(thisTileSymbol.x - scaledSymbolCoord.x) <= tolerance &&
                        Math.abs(thisTileSymbol.y - scaledSymbolCoord.y) <= tolerance &&
                        !zoomCrossTileIDs[crossTileID]) {
                        zoomCrossTileIDs[crossTileID] = true;
                        symbolInstance.crossTileID = crossTileID;
                        break;
                    }
                }
            }
        }
    }
    getCrossTileIDsLists() {
        return Object.values(this._symbolsByKey).map(({ crossTileIDs }) => crossTileIDs);
    }
}
class CrossTileIDs {
    constructor() {
        this.maxCrossTileID = 0;
    }
    generate() {
        return ++this.maxCrossTileID;
    }
}
class CrossTileSymbolLayerIndex {
    constructor() {
        this.indexes = {};
        this.usedCrossTileIDs = {};
        this.lng = 0;
    }
    handleWrapJump(lng) {
        const wrapDelta = Math.round((lng - this.lng) / 360);
        if (wrapDelta !== 0) {
            for (const zoom in this.indexes) {
                const zoomIndexes = this.indexes[zoom];
                const newZoomIndex = {};
                for (const key in zoomIndexes) {
                    const index = zoomIndexes[key];
                    index.tileID = index.tileID.unwrapTo(index.tileID.wrap + wrapDelta);
                    newZoomIndex[index.tileID.key] = index;
                }
                this.indexes[zoom] = newZoomIndex;
            }
        }
        this.lng = lng;
    }
    addBucket(tileID, bucket, crossTileIDs) {
        if (this.indexes[tileID.overscaledZ] &&
            this.indexes[tileID.overscaledZ][tileID.key]) {
            if (this.indexes[tileID.overscaledZ][tileID.key].bucketInstanceId ===
                bucket.bucketInstanceId) {
                return false;
            }
            else {
                this.removeBucketCrossTileIDs(tileID.overscaledZ, this.indexes[tileID.overscaledZ][tileID.key]);
            }
        }
        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            symbolInstance.crossTileID = 0;
        }
        if (!this.usedCrossTileIDs[tileID.overscaledZ]) {
            this.usedCrossTileIDs[tileID.overscaledZ] = {};
        }
        const zoomCrossTileIDs = this.usedCrossTileIDs[tileID.overscaledZ];
        for (const zoom in this.indexes) {
            const zoomIndexes = this.indexes[zoom];
            if (Number(zoom) > tileID.overscaledZ) {
                for (const id in zoomIndexes) {
                    const childIndex = zoomIndexes[id];
                    if (childIndex.tileID.isChildOf(tileID)) {
                        childIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
                    }
                }
            }
            else {
                const parentCoord = tileID.scaledTo(Number(zoom));
                const parentIndex = zoomIndexes[parentCoord.key];
                if (parentIndex) {
                    parentIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
                }
            }
        }
        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            if (!symbolInstance.crossTileID) {
                symbolInstance.crossTileID = crossTileIDs.generate();
                zoomCrossTileIDs[symbolInstance.crossTileID] = true;
            }
        }
        if (this.indexes[tileID.overscaledZ] === undefined) {
            this.indexes[tileID.overscaledZ] = {};
        }
        this.indexes[tileID.overscaledZ][tileID.key] = new TileLayerIndex(tileID, bucket.symbolInstances, bucket.bucketInstanceId);
        return true;
    }
    removeBucketCrossTileIDs(zoom, removedBucket) {
        for (const crossTileIDs of removedBucket.getCrossTileIDsLists()) {
            for (const crossTileID of crossTileIDs) {
                delete this.usedCrossTileIDs[zoom][crossTileID];
            }
        }
    }
    removeStaleBuckets(currentIDs) {
        let tilesChanged = false;
        for (const z in this.indexes) {
            const zoomIndexes = this.indexes[z];
            for (const tileKey in zoomIndexes) {
                if (!currentIDs[zoomIndexes[tileKey].bucketInstanceId]) {
                    this.removeBucketCrossTileIDs(z, zoomIndexes[tileKey]);
                    delete zoomIndexes[tileKey];
                    tilesChanged = true;
                }
            }
        }
        return tilesChanged;
    }
}
export class CrossTileSymbolIndex {
    constructor() {
        this.layerIndexes = {};
        this.crossTileIDs = new CrossTileIDs();
        this.maxBucketInstanceId = 0;
        this.bucketsInCurrentPlacement = {};
    }
    addLayer(styleLayer, tiles, lng) {
        let layerIndex = this.layerIndexes[styleLayer.id];
        if (layerIndex === undefined) {
            layerIndex = this.layerIndexes[styleLayer.id] = new CrossTileSymbolLayerIndex();
        }
        let symbolBucketsChanged = false;
        const currentBucketIDs = {};
        layerIndex.handleWrapJump(lng);
        for (const tile of tiles) {
            const symbolBucket = tile.getBucket(styleLayer);
            if (!symbolBucket || styleLayer.id !== symbolBucket.layerIds[0])
                continue;
            if (!symbolBucket.bucketInstanceId) {
                symbolBucket.bucketInstanceId = ++this.maxBucketInstanceId;
            }
            if (layerIndex.addBucket(tile.tileID, symbolBucket, this.crossTileIDs)) {
                symbolBucketsChanged = true;
            }
            currentBucketIDs[symbolBucket.bucketInstanceId] = true;
        }
        if (layerIndex.removeStaleBuckets(currentBucketIDs)) {
            symbolBucketsChanged = true;
        }
        return symbolBucketsChanged;
    }
    pruneUnusedLayers(usedLayers) {
        const usedLayerMap = {};
        usedLayers.forEach((usedLayer) => {
            usedLayerMap[usedLayer] = true;
        });
        for (const layerId in this.layerIndexes) {
            if (!usedLayerMap[layerId]) {
                delete this.layerIndexes[layerId];
            }
        }
    }
}
//# sourceMappingURL=cross_tile_symbol_index.js.map