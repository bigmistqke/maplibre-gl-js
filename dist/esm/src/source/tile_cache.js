export class TileCache {
    constructor(max, onRemove) {
        this.max = max;
        this.onRemove = onRemove;
        this.reset();
    }
    reset() {
        for (const key in this.data) {
            for (const removedData of this.data[key]) {
                if (removedData.timeout)
                    clearTimeout(removedData.timeout);
                this.onRemove(removedData.value);
            }
        }
        this.data = {};
        this.order = [];
        return this;
    }
    add(tileID, data, expiryTimeout) {
        const key = tileID.wrapped().key;
        if (this.data[key] === undefined) {
            this.data[key] = [];
        }
        const dataWrapper = {
            value: data,
            timeout: undefined
        };
        if (expiryTimeout !== undefined) {
            dataWrapper.timeout = setTimeout(() => {
                this.remove(tileID, dataWrapper);
            }, expiryTimeout);
        }
        this.data[key].push(dataWrapper);
        this.order.push(key);
        if (this.order.length > this.max) {
            const removedData = this._getAndRemoveByKey(this.order[0]);
            if (removedData)
                this.onRemove(removedData);
        }
        return this;
    }
    has(tileID) {
        return tileID.wrapped().key in this.data;
    }
    getAndRemove(tileID) {
        if (!this.has(tileID)) {
            return null;
        }
        return this._getAndRemoveByKey(tileID.wrapped().key);
    }
    _getAndRemoveByKey(key) {
        const data = this.data[key].shift();
        if (data.timeout)
            clearTimeout(data.timeout);
        if (this.data[key].length === 0) {
            delete this.data[key];
        }
        this.order.splice(this.order.indexOf(key), 1);
        return data.value;
    }
    getByKey(key) {
        const data = this.data[key];
        return data ? data[0].value : null;
    }
    get(tileID) {
        if (!this.has(tileID)) {
            return null;
        }
        const data = this.data[tileID.wrapped().key][0];
        return data.value;
    }
    remove(tileID, value) {
        if (!this.has(tileID)) {
            return this;
        }
        const key = tileID.wrapped().key;
        const dataIndex = value === undefined ? 0 : this.data[key].indexOf(value);
        const data = this.data[key][dataIndex];
        this.data[key].splice(dataIndex, 1);
        if (data.timeout)
            clearTimeout(data.timeout);
        if (this.data[key].length === 0) {
            delete this.data[key];
        }
        this.onRemove(data.value);
        this.order.splice(this.order.indexOf(key), 1);
        return this;
    }
    setMaxSize(max) {
        this.max = max;
        while (this.order.length > this.max) {
            const removedData = this._getAndRemoveByKey(this.order[0]);
            if (removedData)
                this.onRemove(removedData);
        }
        return this;
    }
    filter(filterFn) {
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
//# sourceMappingURL=tile_cache.js.map