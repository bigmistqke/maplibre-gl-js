import { DOM } from '../../util/dom';
import { Event } from '../../util/evented';
export class CooperativeGesturesHandler {
    constructor(map, options) {
        this._bypassKey = navigator.userAgent.indexOf('Mac') !== -1 ? 'metaKey' : 'ctrlKey';
        this._map = map;
        this._options = options;
        this._enabled = false;
    }
    isActive() {
        return false;
    }
    reset() { }
    _setupUI() {
        if (this._container)
            return;
        const mapCanvasContainer = this._map.getCanvasContainer();
        mapCanvasContainer.classList.add('maplibregl-cooperative-gestures');
        this._container = DOM.create('div', 'maplibregl-cooperative-gesture-screen', mapCanvasContainer);
        let desktopMessage = this._map._getUIString('CooperativeGesturesHandler.WindowsHelpText');
        if (this._bypassKey === 'metaKey') {
            desktopMessage = this._map._getUIString('CooperativeGesturesHandler.MacHelpText');
        }
        const mobileMessage = this._map._getUIString('CooperativeGesturesHandler.MobileHelpText');
        const desktopDiv = document.createElement('div');
        desktopDiv.className = 'maplibregl-desktop-message';
        desktopDiv.textContent = desktopMessage;
        this._container.appendChild(desktopDiv);
        const mobileDiv = document.createElement('div');
        mobileDiv.className = 'maplibregl-mobile-message';
        mobileDiv.textContent = mobileMessage;
        this._container.appendChild(mobileDiv);
        this._container.setAttribute('aria-hidden', 'true');
    }
    _destroyUI() {
        if (this._container) {
            DOM.remove(this._container);
            const mapCanvasContainer = this._map.getCanvasContainer();
            mapCanvasContainer.classList.remove('maplibregl-cooperative-gestures');
        }
        delete this._container;
    }
    enable() {
        this._setupUI();
        this._enabled = true;
    }
    disable() {
        this._enabled = false;
        this._destroyUI();
    }
    isEnabled() {
        return this._enabled;
    }
    isBypassed(event) {
        return event[this._bypassKey];
    }
    notifyGestureBlocked(gestureType, originalEvent) {
        if (!this._enabled)
            return;
        this._map.fire(new Event('cooperativegestureprevented', { gestureType, originalEvent }));
        this._container.classList.add('maplibregl-show');
        setTimeout(() => {
            this._container.classList.remove('maplibregl-show');
        }, 100);
    }
}
//# sourceMappingURL=cooperative_gestures.js.map