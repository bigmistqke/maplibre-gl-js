import potpack from 'potpack';
import { Event, ErrorEvent, Evented } from '../util/evented';
import { RGBAImage } from '../util/image';
import { ImagePosition } from './image_atlas';
import { Texture } from './texture';
import { renderStyleImage } from '../style/style_image';
import { warnOnce } from '../util/util';
const padding = 1;
export class ImageManager extends Evented {
    constructor() {
        super();
        this.images = {};
        this.updatedImages = {};
        this.callbackDispatchedThisFrame = {};
        this.loaded = false;
        this.requestors = [];
        this.patterns = {};
        this.atlasImage = new RGBAImage({ width: 1, height: 1 });
        this.dirty = true;
    }
    isLoaded() {
        return this.loaded;
    }
    setLoaded(loaded) {
        if (this.loaded === loaded) {
            return;
        }
        this.loaded = loaded;
        if (loaded) {
            for (const { ids, promiseResolve } of this.requestors) {
                promiseResolve(this._getImagesForIds(ids));
            }
            this.requestors = [];
        }
    }
    getImage(id) {
        const image = this.images[id];
        if (image && !image.data && image.spriteData) {
            const spriteData = image.spriteData;
            image.data = new RGBAImage({
                width: spriteData.width,
                height: spriteData.height
            }, spriteData.context.getImageData(spriteData.x, spriteData.y, spriteData.width, spriteData.height).data);
            image.spriteData = null;
        }
        return image;
    }
    addImage(id, image) {
        if (this.images[id])
            throw new Error(`Image id ${id} already exist, use updateImage instead`);
        if (this._validate(id, image)) {
            this.images[id] = image;
        }
    }
    _validate(id, image) {
        let valid = true;
        const data = image.data || image.spriteData;
        if (!this._validateStretch(image.stretchX, data && data.width)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "stretchX" value`)));
            valid = false;
        }
        if (!this._validateStretch(image.stretchY, data && data.height)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "stretchY" value`)));
            valid = false;
        }
        if (!this._validateContent(image.content, image)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "content" value`)));
            valid = false;
        }
        return valid;
    }
    _validateStretch(stretch, size) {
        if (!stretch)
            return true;
        let last = 0;
        for (const part of stretch) {
            if (part[0] < last || part[1] < part[0] || size < part[1])
                return false;
            last = part[1];
        }
        return true;
    }
    _validateContent(content, image) {
        if (!content)
            return true;
        if (content.length !== 4)
            return false;
        const spriteData = image.spriteData;
        const width = (spriteData && spriteData.width) || image.data.width;
        const height = (spriteData && spriteData.height) || image.data.height;
        if (content[0] < 0 || width < content[0])
            return false;
        if (content[1] < 0 || height < content[1])
            return false;
        if (content[2] < 0 || width < content[2])
            return false;
        if (content[3] < 0 || height < content[3])
            return false;
        if (content[2] < content[0])
            return false;
        if (content[3] < content[1])
            return false;
        return true;
    }
    updateImage(id, image, validate = true) {
        const oldImage = this.getImage(id);
        if (validate && (oldImage.data.width !== image.data.width || oldImage.data.height !== image.data.height)) {
            throw new Error(`size mismatch between old image (${oldImage.data.width}x${oldImage.data.height}) and new image (${image.data.width}x${image.data.height}).`);
        }
        image.version = oldImage.version + 1;
        this.images[id] = image;
        this.updatedImages[id] = true;
    }
    removeImage(id) {
        const image = this.images[id];
        delete this.images[id];
        delete this.patterns[id];
        if (image.userImage && image.userImage.onRemove) {
            image.userImage.onRemove();
        }
    }
    listImages() {
        return Object.keys(this.images);
    }
    getImages(ids) {
        return new Promise((resolve, _reject) => {
            let hasAllDependencies = true;
            if (!this.isLoaded()) {
                for (const id of ids) {
                    if (!this.images[id]) {
                        hasAllDependencies = false;
                    }
                }
            }
            if (this.isLoaded() || hasAllDependencies) {
                resolve(this._getImagesForIds(ids));
            }
            else {
                this.requestors.push({ ids, promiseResolve: resolve });
            }
        });
    }
    _getImagesForIds(ids) {
        const response = {};
        for (const id of ids) {
            let image = this.getImage(id);
            if (!image) {
                this.fire(new Event('styleimagemissing', { id }));
                image = this.getImage(id);
            }
            if (image) {
                response[id] = {
                    data: image.data.clone(),
                    pixelRatio: image.pixelRatio,
                    sdf: image.sdf,
                    version: image.version,
                    stretchX: image.stretchX,
                    stretchY: image.stretchY,
                    content: image.content,
                    textFitWidth: image.textFitWidth,
                    textFitHeight: image.textFitHeight,
                    hasRenderCallback: Boolean(image.userImage && image.userImage.render)
                };
            }
            else {
                warnOnce(`Image "${id}" could not be loaded. Please make sure you have added the image with map.addImage() or a "sprite" property in your style. You can provide missing images by listening for the "styleimagemissing" map event.`);
            }
        }
        return response;
    }
    getPixelSize() {
        const { width, height } = this.atlasImage;
        return { width, height };
    }
    getPattern(id) {
        const pattern = this.patterns[id];
        const image = this.getImage(id);
        if (!image) {
            return null;
        }
        if (pattern && pattern.position.version === image.version) {
            return pattern.position;
        }
        if (!pattern) {
            const w = image.data.width + padding * 2;
            const h = image.data.height + padding * 2;
            const bin = { w, h, x: 0, y: 0 };
            const position = new ImagePosition(bin, image);
            this.patterns[id] = { bin, position };
        }
        else {
            pattern.position.version = image.version;
        }
        this._updatePatternAtlas();
        return this.patterns[id].position;
    }
    bind(context) {
        const gl = context.gl;
        if (!this.atlasTexture) {
            this.atlasTexture = new Texture(context, this.atlasImage, gl.RGBA);
        }
        else if (this.dirty) {
            this.atlasTexture.update(this.atlasImage);
            this.dirty = false;
        }
        this.atlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }
    _updatePatternAtlas() {
        const bins = [];
        for (const id in this.patterns) {
            bins.push(this.patterns[id].bin);
        }
        const { w, h } = potpack(bins);
        const dst = this.atlasImage;
        dst.resize({ width: w || 1, height: h || 1 });
        for (const id in this.patterns) {
            const { bin } = this.patterns[id];
            const x = bin.x + padding;
            const y = bin.y + padding;
            const src = this.getImage(id).data;
            const w = src.width;
            const h = src.height;
            RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x, y }, { width: w, height: h });
            RGBAImage.copy(src, dst, { x: 0, y: h - 1 }, { x, y: y - 1 }, { width: w, height: 1 });
            RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x, y: y + h }, { width: w, height: 1 });
            RGBAImage.copy(src, dst, { x: w - 1, y: 0 }, { x: x - 1, y }, { width: 1, height: h });
            RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x: x + w, y }, { width: 1, height: h });
        }
        this.dirty = true;
    }
    beginFrame() {
        this.callbackDispatchedThisFrame = {};
    }
    dispatchRenderCallbacks(ids) {
        for (const id of ids) {
            if (this.callbackDispatchedThisFrame[id])
                continue;
            this.callbackDispatchedThisFrame[id] = true;
            const image = this.getImage(id);
            if (!image)
                warnOnce(`Image with ID: "${id}" was not found`);
            const updated = renderStyleImage(image);
            if (updated) {
                this.updateImage(id, image);
            }
        }
    }
}
//# sourceMappingURL=image_manager.js.map