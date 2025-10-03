import { DOM } from '../../util/dom';
const defaultOptions = {
    maxWidth: 100,
    unit: 'metric'
};
export class ScaleControl {
    constructor(options) {
        this._onMove = () => {
            updateScale(this._map, this._container, this.options);
        };
        this.setUnit = (unit) => {
            this.options.unit = unit;
            updateScale(this._map, this._container, this.options);
        };
        this.options = Object.assign(Object.assign({}, defaultOptions), options);
    }
    getDefaultPosition() {
        return 'bottom-left';
    }
    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-scale', map.getContainer());
        this._map.on('move', this._onMove);
        this._onMove();
        return this._container;
    }
    onRemove() {
        DOM.remove(this._container);
        this._map.off('move', this._onMove);
        this._map = undefined;
    }
}
function updateScale(map, container, options) {
    const optWidth = options && options.maxWidth || 100;
    const y = map._container.clientHeight / 2;
    const x = map._container.clientWidth / 2;
    const left = map.unproject([x - optWidth / 2, y]);
    const right = map.unproject([x + optWidth / 2, y]);
    const globeWidth = Math.round(map.project(right).x - map.project(left).x);
    const maxWidth = Math.min(optWidth, globeWidth, map._container.clientWidth);
    const maxMeters = left.distanceTo(right);
    if (options && options.unit === 'imperial') {
        const maxFeet = 3.2808 * maxMeters;
        if (maxFeet > 5280) {
            const maxMiles = maxFeet / 5280;
            setScale(container, maxWidth, maxMiles, map._getUIString('ScaleControl.Miles'));
        }
        else {
            setScale(container, maxWidth, maxFeet, map._getUIString('ScaleControl.Feet'));
        }
    }
    else if (options && options.unit === 'nautical') {
        const maxNauticals = maxMeters / 1852;
        setScale(container, maxWidth, maxNauticals, map._getUIString('ScaleControl.NauticalMiles'));
    }
    else if (maxMeters >= 1000) {
        setScale(container, maxWidth, maxMeters / 1000, map._getUIString('ScaleControl.Kilometers'));
    }
    else {
        setScale(container, maxWidth, maxMeters, map._getUIString('ScaleControl.Meters'));
    }
}
function setScale(container, maxWidth, maxDistance, unit) {
    const distance = getRoundNum(maxDistance);
    const ratio = distance / maxDistance;
    container.style.width = `${maxWidth * ratio}px`;
    container.innerHTML = `${distance}&nbsp;${unit}`;
}
function getDecimalRoundNum(d) {
    const multiplier = Math.pow(10, Math.ceil(-Math.log(d) / Math.LN10));
    return Math.round(d * multiplier) / multiplier;
}
function getRoundNum(num) {
    const pow10 = Math.pow(10, (`${Math.floor(num)}`).length - 1);
    let d = num / pow10;
    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
            d >= 3 ? 3 :
                d >= 2 ? 2 :
                    d >= 1 ? 1 : getDecimalRoundNum(d);
    return pow10 * d;
}
//# sourceMappingURL=scale_control.js.map