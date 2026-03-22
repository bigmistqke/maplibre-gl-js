import type {TileID} from '@modular/core/types.ts';

/**
 * CrossTileIndex — assigns persistent IDs to labels across tiles and zoom levels.
 *
 * Adapted from MapLibre's cross_tile_symbol_index.ts. Labels are matched by
 * their key (murmur3 hash of text) and anchor position, with tolerance for
 * coordinate rounding differences across zoom levels.
 *
 * STUB: KDBush — MapLibre uses KDBush for >128 symbols per key for O(n log n)
 *       range queries. Linear search is fine for current data volumes.
 *
 * STUB: Antimeridian wrap — MapLibre adjusts tile wrap values when user pans
 *       across the date line. We don't handle wrapping yet.
 */

export type LabelData = {
    /** murmur3 hash of label text */
    key: number;
    /** Anchor X in tile coords (0..4096) */
    anchorX: number;
    /** Anchor Y in tile coords (0..4096) */
    anchorY: number;
    /** 0 = unassigned, >0 = assigned persistent ID */
    crossTileID: number;
};

const EXTENT = 4096;
// Round anchor positions to roughly 4 pixel grid
const roundingFactor = 512 / EXTENT / 2;

interface SymbolsByKeyEntry {
    positions: { x: number; y: number }[];
    crossTileIDs: number[];
}

class CrossTileIDs {
    private _maxID = 0;
    generate(): number {
        return ++this._maxID;
    }
}

function isChildOf(child: TileID, parent: TileID): boolean {
    if (child.z <= parent.z) return false;
    const zDiff = child.z - parent.z;
    return (
        Math.floor(child.x / Math.pow(2, zDiff)) === parent.x &&
    Math.floor(child.y / Math.pow(2, zDiff)) === parent.y
    );
}

function scaledTo(tile: TileID, targetZoom: number): TileID {
    const zDiff = tile.z - targetZoom;
    const x = Math.floor(tile.x / Math.pow(2, zDiff));
    const y = Math.floor(tile.y / Math.pow(2, zDiff));
    return {z: targetZoom, x, y, key: `${targetZoom}/${x}/${y}`};
}

class TileSymbolIndex {
    private _symbolsByKey: Record<number, SymbolsByKeyEntry> = {};

    constructor(
        public tileID: TileID,
        labels: LabelData[],
    ) {
    // Group labels by key
        const byKey = new Map<number, LabelData[]>();
        for (const label of labels) {
            const group = byKey.get(label.key);
            if (group) {
                group.push(label);
            } else {
                byKey.set(label.key, [label]);
            }
        }

        for (const [key, group] of byKey) {
            const positions = group.map((l) => ({
                x: Math.floor(l.anchorX * roundingFactor),
                y: Math.floor(l.anchorY * roundingFactor),
            }));
            const crossTileIDs = group.map((l) => l.crossTileID);
            this._symbolsByKey[key] = {positions, crossTileIDs};
        }
    }

    getScaledCoordinates(
        label: LabelData,
        sourceTileID: TileID,
    ): { x: number; y: number } {
        const zDiff = sourceTileID.z - this.tileID.z;
        const scale = roundingFactor / Math.pow(2, zDiff);
        const xWorld = (sourceTileID.x * EXTENT + label.anchorX) * scale;
        const yWorld = (sourceTileID.y * EXTENT + label.anchorY) * scale;
        const xOffset = this.tileID.x * EXTENT * roundingFactor;
        const yOffset = this.tileID.y * EXTENT * roundingFactor;
        return {
            x: Math.floor(xWorld - xOffset),
            y: Math.floor(yWorld - yOffset),
        };
    }

    findMatches(
        labels: LabelData[],
        sourceTileID: TileID,
        usedIDs: Set<number>,
    ): void {
        const tolerance =
            this.tileID.z < sourceTileID.z
                ? 1
                : Math.pow(2, this.tileID.z - sourceTileID.z);

        for (const label of labels) {
            if (label.crossTileID) continue;

            const entry = this._symbolsByKey[label.key];
            if (!entry) continue;

            const scaled = this.getScaledCoordinates(label, sourceTileID);

            for (let i = 0; i < entry.positions.length; i++) {
                const pos = entry.positions[i];
                const crossTileID = entry.crossTileIDs[i];
                if (
                    Math.abs(pos.x - scaled.x) <= tolerance &&
          Math.abs(pos.y - scaled.y) <= tolerance &&
          !usedIDs.has(crossTileID)
                ) {
                    usedIDs.add(crossTileID);
                    label.crossTileID = crossTileID;
                    break;
                }
            }
        }
    }

    getCrossTileIDsLists(): number[][] {
        return Object.values(this._symbolsByKey).map((e) => e.crossTileIDs);
    }
}

class CrossTileSymbolLayerIndex {
    // indexes[zoom][tileKey] = TileSymbolIndex
    indexes: Record<number, Record<string, TileSymbolIndex>> = {};
    usedCrossTileIDs: Record<number, Set<number>> = {};

    addTile(
        tileID: TileID,
        labels: LabelData[],
        crossTileIDs: CrossTileIDs,
    ): void {
    // If this tile already exists, remove its used IDs first
        if (this.indexes[tileID.z]?.[tileID.key]) {
            this._removeTileCrossTileIDs(
                tileID.z,
                this.indexes[tileID.z][tileID.key],
            );
        }

        // Reset all crossTileIDs
        for (const label of labels) {
            label.crossTileID = 0;
        }

        if (!this.usedCrossTileIDs[tileID.z]) {
            this.usedCrossTileIDs[tileID.z] = new Set();
        }
        const zoomUsedIDs = this.usedCrossTileIDs[tileID.z];

        // Match against existing tiles at other zoom levels
        for (const zoomStr in this.indexes) {
            const zoom = Number(zoomStr);
            const zoomIndexes = this.indexes[zoom];

            if (zoom > tileID.z) {
                // Check child tiles
                for (const key in zoomIndexes) {
                    const childIndex = zoomIndexes[key];
                    if (isChildOf(childIndex.tileID, tileID)) {
                        childIndex.findMatches(labels, tileID, zoomUsedIDs);
                    }
                }
            } else {
                // Check parent tile
                const parentCoord = scaledTo(tileID, zoom);
                const parentIndex = zoomIndexes[parentCoord.key];
                if (parentIndex) {
                    parentIndex.findMatches(labels, tileID, zoomUsedIDs);
                }
            }
        }

        // Assign new IDs to unmatched labels
        for (const label of labels) {
            if (!label.crossTileID) {
                label.crossTileID = crossTileIDs.generate();
                zoomUsedIDs.add(label.crossTileID);
            }
        }

        // Store the index
        if (!this.indexes[tileID.z]) {
            this.indexes[tileID.z] = {};
        }
        this.indexes[tileID.z][tileID.key] = new TileSymbolIndex(tileID, labels);
    }

    removeStaleTiles(activeTileKeys: Set<string>): void {
        for (const z in this.indexes) {
            const zoomIndexes = this.indexes[z];
            for (const tileKey in zoomIndexes) {
                if (!activeTileKeys.has(tileKey)) {
                    this._removeTileCrossTileIDs(Number(z), zoomIndexes[tileKey]);
                    delete zoomIndexes[tileKey];
                }
            }
        }
    }

    private _removeTileCrossTileIDs(
        zoom: number,
        index: TileSymbolIndex,
    ): void {
        const usedIDs = this.usedCrossTileIDs[zoom];
        if (!usedIDs) return;
        for (const list of index.getCrossTileIDsLists()) {
            for (const id of list) {
                usedIDs.delete(id);
            }
        }
    }
}

export class CrossTileIndex {
    private _layerIndexes: Record<string, CrossTileSymbolLayerIndex> = {};
    private _crossTileIDs = new CrossTileIDs();

    addTile(layerID: string, tileID: TileID, labels: LabelData[]): void {
        if (!this._layerIndexes[layerID]) {
            this._layerIndexes[layerID] = new CrossTileSymbolLayerIndex();
        }
        this._layerIndexes[layerID].addTile(tileID, labels, this._crossTileIDs);
    }

    removeStaleTiles(layerID: string, activeTileKeys: Set<string>): void {
        const layerIndex = this._layerIndexes[layerID];
        if (layerIndex) {
            layerIndex.removeStaleTiles(activeTileKeys);
        }
    }
}
