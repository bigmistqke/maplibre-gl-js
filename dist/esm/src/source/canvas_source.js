var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ImageSource } from './image_source';
import { Texture } from '../render/texture';
import { Event, ErrorEvent } from '../util/evented';
import { ValidationError } from '@maplibre/maplibre-gl-style-spec';
export class CanvasSource extends ImageSource {
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        if (!options.coordinates) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'missing required property "coordinates"')));
        }
        else if (!Array.isArray(options.coordinates) || options.coordinates.length !== 4 ||
            options.coordinates.some(c => !Array.isArray(c) || c.length !== 2 || c.some(l => typeof l !== 'number'))) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, '"coordinates" property must be an array of 4 longitude/latitude array pairs')));
        }
        if (options.animate && typeof options.animate !== 'boolean') {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'optional "animate" property must be a boolean value')));
        }
        if (!options.canvas) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, 'missing required property "canvas"')));
        }
        else if (typeof options.canvas !== 'string' && !(options.canvas instanceof HTMLCanvasElement)) {
            this.fire(new ErrorEvent(new ValidationError(`sources.${id}`, null, '"canvas" must be either a string representing the ID of the canvas element from which to read, or an HTMLCanvasElement instance')));
        }
        this.options = options;
        this.animate = options.animate !== undefined ? options.animate : true;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this._loaded = true;
            if (!this.canvas) {
                this.canvas = (this.options.canvas instanceof HTMLCanvasElement) ?
                    this.options.canvas :
                    document.getElementById(this.options.canvas);
            }
            this.width = this.canvas.width;
            this.height = this.canvas.height;
            if (this._hasInvalidDimensions()) {
                this.fire(new ErrorEvent(new Error('Canvas dimensions cannot be less than or equal to zero.')));
                return;
            }
            this.play = function () {
                this._playing = true;
                this.map.triggerRepaint();
            };
            this.pause = function () {
                if (this._playing) {
                    this.prepare();
                    this._playing = false;
                }
            };
            this._finishLoading();
        });
    }
    getCanvas() {
        return this.canvas;
    }
    onAdd(map) {
        this.map = map;
        this.load();
        if (this.canvas) {
            if (this.animate)
                this.play();
        }
    }
    onRemove() {
        this.pause();
    }
    prepare() {
        let resize = false;
        if (this.canvas.width !== this.width) {
            this.width = this.canvas.width;
            resize = true;
        }
        if (this.canvas.height !== this.height) {
            this.height = this.canvas.height;
            resize = true;
        }
        if (this._hasInvalidDimensions())
            return;
        if (Object.keys(this.tiles).length === 0)
            return;
        const context = this.map.painter.context;
        const gl = context.gl;
        if (!this.texture) {
            this.texture = new Texture(context, this.canvas, gl.RGBA, { premultiply: true });
        }
        else if (resize || this._playing) {
            this.texture.update(this.canvas, { premultiply: true });
        }
        let newTilesLoaded = false;
        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
                newTilesLoaded = true;
            }
        }
        if (newTilesLoaded) {
            this.fire(new Event('data', { dataType: 'source', sourceDataType: 'idle', sourceId: this.id }));
        }
    }
    serialize() {
        return {
            type: 'canvas',
            coordinates: this.coordinates
        };
    }
    hasTransition() {
        return this._playing;
    }
    _hasInvalidDimensions() {
        for (const x of [this.canvas.width, this.canvas.height]) {
            if (isNaN(x) || x <= 0)
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=canvas_source.js.map