export class BoundingVolumeCache {
    constructor(boundingVolumeFactory) {
        this._cachePrevious = new Map();
        this._cache = new Map();
        this._hadAnyChanges = false;
        this._boundingVolumeFactory = boundingVolumeFactory;
    }
    swapBuffers() {
        if (!this._hadAnyChanges) {
            return;
        }
        const oldCache = this._cachePrevious;
        this._cachePrevious = this._cache;
        this._cache = oldCache;
        this._cache.clear();
        this._hadAnyChanges = false;
    }
    getTileBoundingVolume(tileID, wrap, elevation, options) {
        const key = `${tileID.z}_${tileID.x}_${tileID.y}_${(options === null || options === void 0 ? void 0 : options.terrain) ? 't' : ''}`;
        const cached = this._cache.get(key);
        if (cached) {
            return cached;
        }
        const cachedPrevious = this._cachePrevious.get(key);
        if (cachedPrevious) {
            this._cache.set(key, cachedPrevious);
            return cachedPrevious;
        }
        const boundingVolume = this._boundingVolumeFactory(tileID, wrap, elevation, options);
        this._cache.set(key, boundingVolume);
        this._hadAnyChanges = true;
        return boundingVolume;
    }
}
//# sourceMappingURL=bounding_volume_cache.js.map