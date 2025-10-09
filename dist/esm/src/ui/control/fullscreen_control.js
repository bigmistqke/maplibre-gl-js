import { DOM } from '../../util/dom';
import { warnOnce } from '../../util/util';
import { Event, Evented } from '../../util/evented';
export class FullscreenControl extends Evented {
    constructor(options = {}) {
        super();
        this._onFullscreenChange = () => {
            var _a;
            let fullscreenElement = window.document.fullscreenElement ||
                window.document.mozFullScreenElement ||
                window.document.webkitFullscreenElement ||
                window.document.msFullscreenElement;
            while ((_a = fullscreenElement === null || fullscreenElement === void 0 ? void 0 : fullscreenElement.shadowRoot) === null || _a === void 0 ? void 0 : _a.fullscreenElement) {
                fullscreenElement = fullscreenElement.shadowRoot.fullscreenElement;
            }
            if ((fullscreenElement === this._container) !== this._fullscreen) {
                this._handleFullscreenChange();
            }
        };
        this._onClickFullscreen = () => {
            if (this._isFullscreen()) {
                this._exitFullscreen();
            }
            else {
                this._requestFullscreen();
            }
        };
        this._fullscreen = false;
        if (options && options.container) {
            if (options.container instanceof HTMLElement) {
                this._container = options.container;
            }
            else {
                warnOnce('Full screen control \'container\' must be a DOM element.');
            }
        }
        if ('onfullscreenchange' in document) {
            this._fullscreenchange = 'fullscreenchange';
        }
        else if ('onmozfullscreenchange' in document) {
            this._fullscreenchange = 'mozfullscreenchange';
        }
        else if ('onwebkitfullscreenchange' in document) {
            this._fullscreenchange = 'webkitfullscreenchange';
        }
        else if ('onmsfullscreenchange' in document) {
            this._fullscreenchange = 'MSFullscreenChange';
        }
    }
    onAdd(map) {
        this._map = map;
        if (!this._container)
            this._container = this._map.getContainer();
        this._controlContainer = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._setupUI();
        return this._controlContainer;
    }
    onRemove() {
        DOM.remove(this._controlContainer);
        this._map = null;
        window.document.removeEventListener(this._fullscreenchange, this._onFullscreenChange);
    }
    _setupUI() {
        const button = this._fullscreenButton = DOM.create('button', (('maplibregl-ctrl-fullscreen')), this._controlContainer);
        DOM.create('span', 'maplibregl-ctrl-icon', button).setAttribute('aria-hidden', 'true');
        button.type = 'button';
        this._updateTitle();
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen);
        window.document.addEventListener(this._fullscreenchange, this._onFullscreenChange);
    }
    _updateTitle() {
        const title = this._getTitle();
        this._fullscreenButton.setAttribute('aria-label', title);
        this._fullscreenButton.title = title;
    }
    _getTitle() {
        return this._map._getUIString(this._isFullscreen() ? 'FullscreenControl.Exit' : 'FullscreenControl.Enter');
    }
    _isFullscreen() {
        return this._fullscreen;
    }
    _handleFullscreenChange() {
        var _a, _b, _c;
        this._fullscreen = !this._fullscreen;
        this._fullscreenButton.classList.toggle('maplibregl-ctrl-shrink');
        this._fullscreenButton.classList.toggle('maplibregl-ctrl-fullscreen');
        this._updateTitle();
        if (this._fullscreen) {
            this.fire(new Event('fullscreenstart'));
            this._prevCooperativeGesturesEnabled = !!((_a = this._map.cooperativeGestures) === null || _a === void 0 ? void 0 : _a.isEnabled());
            (_b = this._map.cooperativeGestures) === null || _b === void 0 ? void 0 : _b.disable();
        }
        else {
            this.fire(new Event('fullscreenend'));
            if (this._prevCooperativeGesturesEnabled) {
                (_c = this._map.cooperativeGestures) === null || _c === void 0 ? void 0 : _c.enable();
            }
        }
    }
    _exitFullscreen() {
        if (window.document.exitFullscreen) {
            window.document.exitFullscreen();
        }
        else if (window.document.mozCancelFullScreen) {
            window.document.mozCancelFullScreen();
        }
        else if (window.document.msExitFullscreen) {
            window.document.msExitFullscreen();
        }
        else if (window.document.webkitCancelFullScreen) {
            window.document.webkitCancelFullScreen();
        }
        else {
            this._togglePseudoFullScreen();
        }
    }
    _requestFullscreen() {
        if (this._container.requestFullscreen) {
            this._container.requestFullscreen();
        }
        else if (this._container.mozRequestFullScreen) {
            this._container.mozRequestFullScreen();
        }
        else if (this._container.msRequestFullscreen) {
            this._container.msRequestFullscreen();
        }
        else if (this._container.webkitRequestFullscreen) {
            this._container.webkitRequestFullscreen();
        }
        else {
            this._togglePseudoFullScreen();
        }
    }
    _togglePseudoFullScreen() {
        this._container.classList.toggle('maplibregl-pseudo-fullscreen');
        this._handleFullscreenChange();
        this._map.resize();
    }
}
//# sourceMappingURL=fullscreen_control.js.map