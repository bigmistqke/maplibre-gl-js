import { LngLat } from './lng_lat';
export class LngLatBounds {
    constructor(sw, ne) {
        if (!sw) {
        }
        else if (ne) {
            this.setSouthWest(sw).setNorthEast(ne);
        }
        else if (Array.isArray(sw)) {
            if (sw.length === 4) {
                this.setSouthWest([sw[0], sw[1]]).setNorthEast([sw[2], sw[3]]);
            }
            else {
                this.setSouthWest(sw[0]).setNorthEast(sw[1]);
            }
        }
    }
    setNorthEast(ne) {
        this._ne = ne instanceof LngLat ? new LngLat(ne.lng, ne.lat) : LngLat.convert(ne);
        return this;
    }
    setSouthWest(sw) {
        this._sw = sw instanceof LngLat ? new LngLat(sw.lng, sw.lat) : LngLat.convert(sw);
        return this;
    }
    extend(obj) {
        const sw = this._sw, ne = this._ne;
        let sw2, ne2;
        if (obj instanceof LngLat) {
            sw2 = obj;
            ne2 = obj;
        }
        else if (obj instanceof LngLatBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;
            if (!sw2 || !ne2)
                return this;
        }
        else {
            if (Array.isArray(obj)) {
                if (obj.length === 4 || obj.every(Array.isArray)) {
                    const lngLatBoundsObj = obj;
                    return this.extend(LngLatBounds.convert(lngLatBoundsObj));
                }
                else {
                    const lngLatObj = obj;
                    return this.extend(LngLat.convert(lngLatObj));
                }
            }
            else if (obj && ('lng' in obj || 'lon' in obj) && 'lat' in obj) {
                return this.extend(LngLat.convert(obj));
            }
            return this;
        }
        if (!sw && !ne) {
            this._sw = new LngLat(sw2.lng, sw2.lat);
            this._ne = new LngLat(ne2.lng, ne2.lat);
        }
        else {
            sw.lng = Math.min(sw2.lng, sw.lng);
            sw.lat = Math.min(sw2.lat, sw.lat);
            ne.lng = Math.max(ne2.lng, ne.lng);
            ne.lat = Math.max(ne2.lat, ne.lat);
        }
        return this;
    }
    getCenter() {
        return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2);
    }
    getSouthWest() { return this._sw; }
    getNorthEast() { return this._ne; }
    getNorthWest() { return new LngLat(this.getWest(), this.getNorth()); }
    getSouthEast() { return new LngLat(this.getEast(), this.getSouth()); }
    getWest() { return this._sw.lng; }
    getSouth() { return this._sw.lat; }
    getEast() { return this._ne.lng; }
    getNorth() { return this._ne.lat; }
    toArray() {
        return [this._sw.toArray(), this._ne.toArray()];
    }
    toString() {
        return `LngLatBounds(${this._sw.toString()}, ${this._ne.toString()})`;
    }
    isEmpty() {
        return !(this._sw && this._ne);
    }
    contains(lnglat) {
        const { lng, lat } = LngLat.convert(lnglat);
        const containsLatitude = this._sw.lat <= lat && lat <= this._ne.lat;
        let containsLongitude = this._sw.lng <= lng && lng <= this._ne.lng;
        if (this._sw.lng > this._ne.lng) {
            containsLongitude = this._sw.lng >= lng && lng >= this._ne.lng;
        }
        return containsLatitude && containsLongitude;
    }
    static convert(input) {
        if (input instanceof LngLatBounds)
            return input;
        if (!input)
            return input;
        return new LngLatBounds(input);
    }
    static fromLngLat(center, radius = 0) {
        const earthCircumferenceInMetersAtEquator = 40075017;
        const latAccuracy = 360 * radius / earthCircumferenceInMetersAtEquator, lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * center.lat);
        return new LngLatBounds(new LngLat(center.lng - lngAccuracy, center.lat - latAccuracy), new LngLat(center.lng + lngAccuracy, center.lat + latAccuracy));
    }
    adjustAntiMeridian() {
        const sw = new LngLat(this._sw.lng, this._sw.lat);
        const ne = new LngLat(this._ne.lng, this._ne.lat);
        if (sw.lng > ne.lng) {
            return new LngLatBounds(sw, new LngLat(ne.lng + 360, ne.lat));
        }
        return new LngLatBounds(sw, ne);
    }
}
//# sourceMappingURL=lng_lat_bounds.js.map