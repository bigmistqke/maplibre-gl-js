import { DOM } from '../../util/dom';
export class GlobeControl {
    constructor() {
        this._toggleProjection = () => {
            var _a;
            const currentProjection = (_a = this._map.getProjection()) === null || _a === void 0 ? void 0 : _a.type;
            if (currentProjection === 'mercator' || !currentProjection) {
                this._map.setProjection({ type: 'globe' });
            }
            else {
                this._map.setProjection({ type: 'mercator' });
            }
            this._updateGlobeIcon();
        };
        this._updateGlobeIcon = () => {
            var _a;
            this._globeButton.classList.remove('maplibregl-ctrl-globe');
            this._globeButton.classList.remove('maplibregl-ctrl-globe-enabled');
            if (((_a = this._map.getProjection()) === null || _a === void 0 ? void 0 : _a.type) === 'globe') {
                this._globeButton.classList.add('maplibregl-ctrl-globe-enabled');
                this._globeButton.title = this._map._getUIString('GlobeControl.Disable');
            }
            else {
                this._globeButton.classList.add('maplibregl-ctrl-globe');
                this._globeButton.title = this._map._getUIString('GlobeControl.Enable');
            }
        };
    }
    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._globeButton = DOM.create('button', 'maplibregl-ctrl-globe', this._container);
        DOM.create('span', 'maplibregl-ctrl-icon', this._globeButton).setAttribute('aria-hidden', 'true');
        this._globeButton.type = 'button';
        this._globeButton.addEventListener('click', this._toggleProjection);
        this._updateGlobeIcon();
        this._map.on('styledata', this._updateGlobeIcon);
        return this._container;
    }
    onRemove() {
        DOM.remove(this._container);
        this._map.off('styledata', this._updateGlobeIcon);
        this._globeButton.removeEventListener('click', this._toggleProjection);
        this._map = undefined;
    }
}
//# sourceMappingURL=globe_control.js.map