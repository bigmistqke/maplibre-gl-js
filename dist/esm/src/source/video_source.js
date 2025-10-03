var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getVideo } from '../util/ajax';
import { ImageSource } from './image_source';
import { Texture } from '../render/texture';
import { Event, ErrorEvent } from '../util/evented';
import { ValidationError } from '@maplibre/maplibre-gl-style-spec';
export class VideoSource extends ImageSource {
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        this.roundZoom = true;
        this.type = 'video';
        this.options = options;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this._loaded = false;
            const options = this.options;
            this.urls = [];
            for (const url of options.urls) {
                this.urls.push(this.map._requestManager.transformRequest(url, "Source").url);
            }
            try {
                const video = yield getVideo(this.urls);
                this._loaded = true;
                if (!video) {
                    return;
                }
                this.video = video;
                this.video.loop = true;
                this.video.addEventListener('playing', () => {
                    this.map.triggerRepaint();
                });
                if (this.map) {
                    this.video.play();
                }
                this._finishLoading();
            }
            catch (err) {
                this.fire(new ErrorEvent(err));
            }
        });
    }
    pause() {
        if (this.video) {
            this.video.pause();
        }
    }
    play() {
        if (this.video) {
            this.video.play();
        }
    }
    seek(seconds) {
        if (this.video) {
            const seekableRange = this.video.seekable;
            if (seconds < seekableRange.start(0) || seconds > seekableRange.end(0)) {
                this.fire(new ErrorEvent(new ValidationError(`sources.${this.id}`, null, `Playback for this video can be set only between the ${seekableRange.start(0)} and ${seekableRange.end(0)}-second mark.`)));
            }
            else
                this.video.currentTime = seconds;
        }
    }
    getVideo() {
        return this.video;
    }
    onAdd(map) {
        if (this.map)
            return;
        this.map = map;
        this.load();
        if (this.video) {
            this.video.play();
            this.setCoordinates(this.coordinates);
        }
    }
    prepare() {
        if (Object.keys(this.tiles).length === 0 || this.video.readyState < 2) {
            return;
        }
        const context = this.map.painter.context;
        const gl = context.gl;
        if (!this.texture) {
            this.texture = new Texture(context, this.video, gl.RGBA);
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
        else if (!this.video.paused) {
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
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
            type: 'video',
            urls: this.urls,
            coordinates: this.coordinates
        };
    }
    hasTransition() {
        return this.video && !this.video.paused;
    }
}
//# sourceMappingURL=video_source.js.map