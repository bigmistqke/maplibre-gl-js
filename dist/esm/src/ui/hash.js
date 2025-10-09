import { throttle } from '../util/throttle';
import { LngLat } from '../geo/lng_lat';
export class Hash {
    constructor(hashName) {
        this._getCurrentHash = () => {
            const hash = window.location.hash.replace('#', '');
            if (this._hashName) {
                let keyval;
                hash.split('&').map(part => part.split('=')).forEach(part => {
                    if (part[0] === this._hashName) {
                        keyval = part;
                    }
                });
                return (keyval ? keyval[1] || '' : '').split('/');
            }
            return hash.split('/');
        };
        this._onHashChange = () => {
            var _a, _b;
            const hash = this._getCurrentHash();
            if (!this._isValidHash(hash)) {
                return false;
            }
            const bearing = ((_a = this._map.dragRotate) === null || _a === void 0 ? void 0 : _a.isEnabled()) && ((_b = this._map.touchZoomRotate) === null || _b === void 0 ? void 0 : _b.isEnabled()) ? +(hash[3] || 0) : this._map.getBearing();
            this._map.jumpTo({
                center: [+hash[2], +hash[1]],
                zoom: +hash[0],
                bearing,
                pitch: +(hash[4] || 0)
            });
            return true;
        };
        this._updateHashUnthrottled = () => {
            const location = window.location.href.replace(/(#.*)?$/, this.getHashString());
            window.history.replaceState(window.history.state, null, location);
        };
        this._removeHash = () => {
            const currentHash = this._getCurrentHash();
            if (currentHash.length === 0) {
                return;
            }
            const baseHash = currentHash.join('/');
            let targetHash = baseHash;
            if (targetHash.split('&').length > 0) {
                targetHash = targetHash.split('&')[0];
            }
            if (this._hashName) {
                targetHash = `${this._hashName}=${baseHash}`;
            }
            let replaceString = window.location.hash.replace(targetHash, '');
            if (replaceString.startsWith('#&')) {
                replaceString = replaceString.slice(0, 1) + replaceString.slice(2);
            }
            else if (replaceString === '#') {
                replaceString = '';
            }
            let location = window.location.href.replace(/(#.+)?$/, replaceString);
            location = location.replace('&&', '&');
            window.history.replaceState(window.history.state, null, location);
        };
        this._updateHash = throttle(this._updateHashUnthrottled, 30 * 1000 / 100);
        this._hashName = hashName && encodeURIComponent(hashName);
    }
    addTo(map) {
        this._map = map;
        addEventListener('hashchange', this._onHashChange, false);
        this._map.on('moveend', this._updateHash);
        return this;
    }
    remove() {
        removeEventListener('hashchange', this._onHashChange, false);
        this._map.off('moveend', this._updateHash);
        clearTimeout(this._updateHash());
        this._removeHash();
        delete this._map;
        return this;
    }
    getHashString(mapFeedback) {
        const center = this._map.getCenter(), zoom = Math.round(this._map.getZoom() * 100) / 100, precision = Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10), m = Math.pow(10, precision), lng = Math.round(center.lng * m) / m, lat = Math.round(center.lat * m) / m, bearing = this._map.getBearing(), pitch = this._map.getPitch();
        let hash = '';
        if (mapFeedback) {
            hash += `/${lng}/${lat}/${zoom}`;
        }
        else {
            hash += `${zoom}/${lat}/${lng}`;
        }
        if (bearing || pitch)
            hash += (`/${Math.round(bearing * 10) / 10}`);
        if (pitch)
            hash += (`/${Math.round(pitch)}`);
        if (this._hashName) {
            const hashName = this._hashName;
            let found = false;
            const parts = window.location.hash.slice(1).split('&').map(part => {
                const key = part.split('=')[0];
                if (key === hashName) {
                    found = true;
                    return `${key}=${hash}`;
                }
                return part;
            }).filter(a => a);
            if (!found) {
                parts.push(`${hashName}=${hash}`);
            }
            return `#${parts.join('&')}`;
        }
        return `#${hash}`;
    }
    _isValidHash(hash) {
        if (hash.length < 3 || hash.some(isNaN)) {
            return false;
        }
        try {
            new LngLat(+hash[2], +hash[1]);
        }
        catch (_a) {
            return false;
        }
        const zoom = +hash[0];
        const bearing = +(hash[3] || 0);
        const pitch = +(hash[4] || 0);
        return zoom >= this._map.getMinZoom() && zoom <= this._map.getMaxZoom() &&
            bearing >= -180 && bearing <= 180 &&
            pitch >= this._map.getMinPitch() && pitch <= this._map.getMaxPitch();
    }
    ;
}
//# sourceMappingURL=hash.js.map