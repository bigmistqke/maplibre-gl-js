/* eslint-disable key-spacing */
import {RGBAImage} from '../util/image';
import {register} from '../util/web_worker_transfer';
import potpack from 'potpack';
import {assertedNotNullish} from '../util/util';

import type {StyleImage} from '../style/style_image';
import {type TextFit} from '../style/style_image';
import type {ImageManager} from './image_manager';
import type {Texture} from './texture';
import type {Rect} from './glyph_atlas';
import type {GetImagesResponse} from '../util/actor_messages';

const IMAGE_PADDING: number = 1;
export {IMAGE_PADDING};

export class ImagePosition {
    paddedRect: Rect ;
    pixelRatio: number ;
    version: number | undefined;
    stretchY: Array<[number, number]> | undefined;
    stretchX: Array<[number, number]> | undefined;
    content: [number, number, number, number] | undefined;
    textFitWidth: TextFit | undefined;
    textFitHeight: TextFit | undefined;

    constructor(paddedRect: Rect, {
        pixelRatio,
        version,
        stretchX,
        stretchY,
        content,
        textFitWidth,
        textFitHeight
    }: StyleImage) {
        this.paddedRect = paddedRect;
        this.pixelRatio = pixelRatio;
        this.stretchX = stretchX;
        this.stretchY = stretchY;
        this.content = content;
        this.version = version;
        this.textFitWidth = textFitWidth;
        this.textFitHeight = textFitHeight;
    }

    get tl(): [number, number] {
        return [
            this.paddedRect.x + IMAGE_PADDING,
            this.paddedRect.y + IMAGE_PADDING
        ];
    }

    get br(): [number, number] {
        return [
            this.paddedRect.x + this.paddedRect.w - IMAGE_PADDING,
            this.paddedRect.y + this.paddedRect.h - IMAGE_PADDING
        ];
    }

    get tlbr(): Array<number> {
        return this.tl.concat(this.br);
    }

    get displaySize(): [number, number] {
        return [
            (this.paddedRect.w - IMAGE_PADDING * 2) / this.pixelRatio,
            (this.paddedRect.h - IMAGE_PADDING * 2) / this.pixelRatio
        ];
    }
}

/**
 * A class holding all the images
 */
export class ImageAtlas {
    image: RGBAImage;
    iconPositions: Record<string, ImagePosition>;
    patternPositions: Record<string, ImagePosition>;
    haveRenderCallbacks: Array<string>;
    uploaded?: boolean;

    constructor(icons: GetImagesResponse, patterns: GetImagesResponse) {
        const iconPositions: Record<string, ImagePosition> = {}, patternPositions: Record<string, ImagePosition> = {};
        this.haveRenderCallbacks = [];

        const bins: Rect[] = [];

        this.addImages(icons, iconPositions, bins);
        this.addImages(patterns, patternPositions, bins);

        const {w, h} = potpack(bins);
        const image = new RGBAImage({width: w || 1, height: h || 1});

        for (const id in icons) {
            const src = icons[id];
            const srcData = assertedNotNullish(src.data);
            const bin = iconPositions[id].paddedRect;
            RGBAImage.copy(srcData, image, {x: 0, y: 0}, {x: bin.x + IMAGE_PADDING, y: bin.y + IMAGE_PADDING}, srcData);
        }

        for (const id in patterns) {
            const src = patterns[id];
            const srcData = assertedNotNullish(src.data);
            const bin = patternPositions[id].paddedRect;
            const x = bin.x + IMAGE_PADDING,
                y = bin.y + IMAGE_PADDING,
                w = srcData.width,
                h = srcData.height;

            RGBAImage.copy(srcData, image, {x: 0, y: 0}, {x, y}, srcData);
            // Add 1 pixel wrapped padding on each side of the image.
            RGBAImage.copy(srcData, image, {x: 0, y: h - 1}, {x, y: y - 1}, {width: w, height: 1}); // T
            RGBAImage.copy(srcData, image, {x: 0, y:     0}, {x, y: y + h}, {width: w, height: 1}); // B
            RGBAImage.copy(srcData, image, {x: w - 1, y: 0}, {x: x - 1, y}, {width: 1, height: h}); // L
            RGBAImage.copy(srcData, image, {x: 0,     y: 0}, {x: x + w, y}, {width: 1, height: h}); // R
        }

        this.image = image;
        this.iconPositions = iconPositions;
        this.patternPositions = patternPositions;
    }

    addImages(images: Record<string, StyleImage>, positions: Record<string, ImagePosition>, bins: Array<Rect>) {
        for (const id in images) {
            const src = images[id];
            const srcData = assertedNotNullish(src.data);
            const bin = {
                x: 0,
                y: 0,
                w: srcData.width + 2 * IMAGE_PADDING,
                h: srcData.height + 2 * IMAGE_PADDING,
            };
            bins.push(bin);
            positions[id] = new ImagePosition(bin, src);

            if (src.hasRenderCallback) {
                this.haveRenderCallbacks.push(id);
            }
        }
    }

    patchUpdatedImages(imageManager: ImageManager, texture: Texture) {
        imageManager.dispatchRenderCallbacks(this.haveRenderCallbacks);
        for (const name in imageManager.updatedImages) {
            this.patchUpdatedImage(assertedNotNullish(this.iconPositions[name]), imageManager.getImage(name), texture);
            this.patchUpdatedImage(assertedNotNullish(this.patternPositions[name]), imageManager.getImage(name), texture);
        }
    }

    patchUpdatedImage(position: ImagePosition | undefined, image: StyleImage | undefined, texture: Texture) {
        if (!position || !image) return;

        if (position.version === image.version) return;

        position.version = image.version;
        const [x, y] = position.tl;
        texture.update(assertedNotNullish(image.data), undefined, {x, y});
    }

}

register('ImagePosition', ImagePosition);
register('ImageAtlas', ImageAtlas);
