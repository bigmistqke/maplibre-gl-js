import {type OverscaledTileID} from './tile_id';
import type {Tile} from './tile';
import {assertedNotNullish, assertNotNullish} from '../util/util';

/**
 * @internal
 * A [least-recently-used cache](https://en.wikipedia.org/wiki/Cache_algorithms)
 * with hash lookup made possible by keeping a list of keys in parallel to
 * an array of dictionary of values
 *
 * TileManager offloads currently unused tiles to this cache, and when a tile gets used again,
 * it is also removed from this cache. Thus addition is the only operation that counts as "usage"
 * for the purposes of LRU behaviour.
 */
export class TileCache {
    max: number;
    data: {
        [key: string]: Array<{
            value: Tile;
            timeout: ReturnType<typeof setTimeout> | undefined;
        }>;
    } | undefined;
    order: Array<string> | undefined;
    onRemove: (element: Tile) => void;
    /**
     * @param max - number of permitted values
     * @param onRemove - callback called with items when they expire
     */
    constructor(max: number, onRemove: (element: Tile) => void) {
        this.max = max;
        this.onRemove = onRemove;
        this.reset();
    }

    /**
     * Clear the cache
     *
     * @returns this cache
     */
    reset() {
        for (const key in this.data) {
            for (const removedData of this.data[key]) {
                if (removedData.timeout) clearTimeout(removedData.timeout);
                this.onRemove(removedData.value);
            }
        }

        this.data = {};
        this.order = [];

        return this;
    }

    /**
     * Add a key, value combination to the cache, trimming its size if this pushes
     * it over max length.
     *
     * @param tileID - lookup key for the item
     * @param data - tile data
     *
     * @returns this cache
     */
    add(tileID: OverscaledTileID, data: Tile, expiryTimeout: number | void) {
        const key = tileID.wrapped().key;
        const cacheData = assertedNotNullish(this.data);
        if (cacheData[key] === undefined) {
            cacheData[key] = [];
        }

        const dataWrapper: { value: Tile; timeout: ReturnType<typeof setTimeout> | undefined } = {
            value: data,
            timeout: undefined
        };

        if (expiryTimeout !== undefined) {
            dataWrapper.timeout = setTimeout(() => {
                this.remove(tileID, dataWrapper);
            }, expiryTimeout as number);
        }

        cacheData[key].push(dataWrapper);
        assertedNotNullish(this.order).push(key);

        if (assertedNotNullish(this.order).length > this.max) {
            const removedData = this._getAndRemoveByKey(assertedNotNullish(this.order)[0]);
            if (removedData) this.onRemove(removedData);
        }

        return this;
    }

    /**
     * Determine whether the value attached to `key` is present
     *
     * @param tileID - the key to be looked-up
     * @returns whether the cache has this value
     */
    has(tileID: OverscaledTileID): boolean {
        return tileID.wrapped().key in assertedNotNullish(this.data);
    }

    /**
     * Get the value attached to a specific key and remove data from cache.
     * If the key is not found, returns `null`
     *
     * @param tileID - the key to look up
     * @returns the tile data, or null if it isn't found
     */
    getAndRemove(tileID: OverscaledTileID): Tile | null {
        if (!this.has(tileID)) { return null; }
        return this._getAndRemoveByKey(tileID.wrapped().key);
    }

    /*
     * Get and remove the value with the specified key.
     */
    _getAndRemoveByKey(key: string): Tile {
        const data = assertedNotNullish(this.data)[key].shift();
        assertNotNullish(data, 'Expected cache data to exist for key');
        if (data.timeout) clearTimeout(data.timeout);

        if (assertedNotNullish(this.data)[key].length === 0) {
            delete assertedNotNullish(this.data)[key];
        }
        assertedNotNullish(this.order).splice(assertedNotNullish(this.order).indexOf(key), 1);

        return data.value;
    }

    /*
     * Get the value with the specified (wrapped tile) key.
     */
    getByKey(key: string): Tile | null {
        const data = assertedNotNullish(this.data)[key];
        return data ? data[0].value : null;
    }

    /**
     * Get the value attached to a specific key without removing data
     * from the cache. If the key is not found, returns `null`
     *
     * @param tileID - the key to look up
     * @returns the tile data, or null if it isn't found
     */
    get(tileID: OverscaledTileID): Tile | null {
        if (!this.has(tileID)) { return null; }

        const data = assertedNotNullish(this.data)[tileID.wrapped().key][0];
        return data.value;
    }

    /**
     * Remove a key/value combination from the cache.
     *
     * @param tileID - the key for the pair to delete
     * @param value - If a value is provided, remove that exact version of the value.
     * @returns this cache
     */
    remove(tileID: OverscaledTileID, value?: {
        value: Tile;
        timeout: ReturnType<typeof setTimeout> | undefined;
    }) {
        if (!this.has(tileID)) { return this; }
        const key = tileID.wrapped().key;

        const dataIndex = value === undefined ? 0 : assertedNotNullish(this.data)[key].indexOf(value);
        const data = assertedNotNullish(this.data)[key][dataIndex];
        assertedNotNullish(this.data)[key].splice(dataIndex, 1);
        if (data.timeout) clearTimeout(data.timeout);
        if (assertedNotNullish(this.data)[key].length === 0) {
            delete assertedNotNullish(this.data)[key];
        }
        this.onRemove(data.value);
        assertedNotNullish(this.order).splice(assertedNotNullish(this.order).indexOf(key), 1);

        return this;
    }

    /**
     * Change the max size of the cache.
     *
     * @param max - the max size of the cache
     * @returns this cache
     */
    setMaxSize(max: number): TileCache {
        this.max = max;

        while (assertedNotNullish(this.order).length > this.max) {
            const removedData = this._getAndRemoveByKey(assertedNotNullish(this.order)[0]);
            if (removedData) this.onRemove(removedData);
        }

        return this;
    }

    /**
     * Remove entries that do not pass a filter function. Used for removing
     * stale tiles from the cache.
     *
     * @param filterFn - Determines whether the tile is filtered. If the supplied function returns false, the tile will be filtered out.
     */
    filter(filterFn: (tile: Tile) => boolean) {
        const removed = [];
        for (const key in this.data) {
            for (const entry of this.data[key]) {
                if (!filterFn(entry.value)) {
                    removed.push(entry);
                }
            }
        }
        for (const r of removed) {
            this.remove(r.value.tileID, r);
        }
    }
}

export class BoundedLRUCache<K, V> {
    private maxEntries: number;
    private map: Map<K, V>;

    constructor(maxEntries: number) {
        this.maxEntries = maxEntries;
        this.map = new Map();
    }

    get(key: K): V | undefined {
        const value = this.map.get(key);
        if (value !== undefined) {
            // Move key to end (most recently used)
            this.map.delete(key);
            this.map.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.maxEntries) {
            // Delete oldest
            const oldestKey = assertedNotNullish(this.map.keys().next().value);
            this.map.delete(oldestKey);
        }
        this.map.set(key, value);
    }

    clear(): void {
        this.map.clear();
    }
}
