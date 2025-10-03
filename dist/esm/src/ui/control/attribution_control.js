import { DOM } from '../../util/dom';
export const defaultAttributionControlOptions = {
    compact: true,
    customAttribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a>'
};
export class AttributionControl {
    constructor(options = defaultAttributionControlOptions) {
        this._toggleAttribution = () => {
            if (this._container.classList.contains('maplibregl-compact')) {
                if (this._container.classList.contains('maplibregl-compact-show')) {
                    this._container.setAttribute('open', '');
                    this._container.classList.remove('maplibregl-compact-show');
                }
                else {
                    this._container.classList.add('maplibregl-compact-show');
                    this._container.removeAttribute('open');
                }
            }
        };
        this._updateData = (e) => {
            if (e && (e.sourceDataType === 'metadata' || e.sourceDataType === 'visibility' || e.dataType === 'style' || e.type === 'terrain')) {
                this._updateAttributions();
            }
        };
        this._updateCompact = () => {
            if (this._map.getCanvasContainer().offsetWidth <= 640 || this._compact) {
                if (this._compact === false) {
                    this._container.setAttribute('open', '');
                }
                else if (!this._container.classList.contains('maplibregl-compact') && !this._container.classList.contains('maplibregl-attrib-empty')) {
                    this._container.setAttribute('open', '');
                    this._container.classList.add('maplibregl-compact', 'maplibregl-compact-show');
                }
            }
            else {
                this._container.setAttribute('open', '');
                if (this._container.classList.contains('maplibregl-compact')) {
                    this._container.classList.remove('maplibregl-compact', 'maplibregl-compact-show');
                }
            }
        };
        this._updateCompactMinimize = () => {
            if (this._container.classList.contains('maplibregl-compact')) {
                if (this._container.classList.contains('maplibregl-compact-show')) {
                    this._container.classList.remove('maplibregl-compact-show');
                }
            }
        };
        this.options = options;
    }
    getDefaultPosition() {
        return 'bottom-right';
    }
    onAdd(map) {
        this._map = map;
        this._compact = this.options.compact;
        this._container = DOM.create('details', 'maplibregl-ctrl maplibregl-ctrl-attrib');
        this._compactButton = DOM.create('summary', 'maplibregl-ctrl-attrib-button', this._container);
        this._compactButton.addEventListener('click', this._toggleAttribution);
        this._setElementTitle(this._compactButton, 'ToggleAttribution');
        this._innerContainer = DOM.create('div', 'maplibregl-ctrl-attrib-inner', this._container);
        this._updateAttributions();
        this._updateCompact();
        this._map.on('styledata', this._updateData);
        this._map.on('sourcedata', this._updateData);
        this._map.on('terrain', this._updateData);
        this._map.on('resize', this._updateCompact);
        this._map.on('drag', this._updateCompactMinimize);
        return this._container;
    }
    onRemove() {
        DOM.remove(this._container);
        this._map.off('styledata', this._updateData);
        this._map.off('sourcedata', this._updateData);
        this._map.off('terrain', this._updateData);
        this._map.off('resize', this._updateCompact);
        this._map.off('drag', this._updateCompactMinimize);
        this._map = undefined;
        this._compact = undefined;
        this._attribHTML = undefined;
    }
    _setElementTitle(element, title) {
        const str = this._map._getUIString(`AttributionControl.${title}`);
        element.title = str;
        element.setAttribute('aria-label', str);
    }
    _updateAttributions() {
        if (!this._map.style)
            return;
        let attributions = [];
        if (this.options.customAttribution) {
            if (Array.isArray(this.options.customAttribution)) {
                attributions = attributions.concat(this.options.customAttribution.map(attribution => {
                    if (typeof attribution !== 'string')
                        return '';
                    return attribution;
                }));
            }
            else if (typeof this.options.customAttribution === 'string') {
                attributions.push(this.options.customAttribution);
            }
        }
        if (this._map.style.stylesheet) {
            const stylesheet = this._map.style.stylesheet;
            this.styleOwner = stylesheet.owner;
            this.styleId = stylesheet.id;
        }
        const sourceCaches = this._map.style.sourceCaches;
        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used || sourceCache.usedForTerrain) {
                const source = sourceCache.getSource();
                if (source.attribution && attributions.indexOf(source.attribution) < 0) {
                    attributions.push(source.attribution);
                }
            }
        }
        attributions = attributions.filter(e => String(e).trim());
        attributions.sort((a, b) => a.length - b.length);
        attributions = attributions.filter((attrib, i) => {
            for (let j = i + 1; j < attributions.length; j++) {
                if (attributions[j].indexOf(attrib) >= 0) {
                    return false;
                }
            }
            return true;
        });
        const attribHTML = attributions.join(' | ');
        if (attribHTML === this._attribHTML)
            return;
        this._attribHTML = attribHTML;
        if (attributions.length) {
            this._innerContainer.innerHTML = DOM.sanitize(attribHTML);
            this._container.classList.remove('maplibregl-attrib-empty');
        }
        else {
            this._container.classList.add('maplibregl-attrib-empty');
        }
        this._updateCompact();
        this._editLink = null;
    }
}
//# sourceMappingURL=attribution_control.js.map