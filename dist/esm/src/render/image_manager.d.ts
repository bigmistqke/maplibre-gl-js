import { Evented } from '../util/evented';
import { RGBAImage } from '../util/image';
import { ImagePosition } from './image_atlas';
import { Texture } from './texture';
import type { StyleImage } from '../style/style_image';
import type { Context } from '../gl/context';
import type { PotpackBox } from 'potpack';
import type { GetImagesResponse } from '../util/actor_messages';
type Pattern = {
    bin: PotpackBox;
    position: ImagePosition;
};
export declare class ImageManager extends Evented {
    images: {
        [_: string]: StyleImage;
    };
    updatedImages: {
        [_: string]: boolean;
    };
    callbackDispatchedThisFrame: {
        [_: string]: boolean;
    };
    loaded: boolean;
    requestors: Array<{
        ids: Array<string>;
        promiseResolve: (value: GetImagesResponse) => void;
    }>;
    patterns: {
        [_: string]: Pattern;
    };
    atlasImage: RGBAImage;
    atlasTexture: Texture;
    dirty: boolean;
    constructor();
    isLoaded(): boolean;
    setLoaded(loaded: boolean): void;
    getImage(id: string): StyleImage;
    addImage(id: string, image: StyleImage): void;
    _validate(id: string, image: StyleImage): boolean;
    _validateStretch(stretch: Array<[number, number]>, size: number): boolean;
    _validateContent(content: [number, number, number, number], image: StyleImage): boolean;
    updateImage(id: string, image: StyleImage, validate?: boolean): void;
    removeImage(id: string): void;
    listImages(): Array<string>;
    getImages(ids: Array<string>): Promise<GetImagesResponse>;
    _getImagesForIds(ids: Array<string>): GetImagesResponse;
    getPixelSize(): {
        width: number;
        height: number;
    };
    getPattern(id: string): ImagePosition;
    bind(context: Context): void;
    _updatePatternAtlas(): void;
    beginFrame(): void;
    dispatchRenderCallbacks(ids: Array<string>): void;
}
export {};
//# sourceMappingURL=image_manager.d.ts.map