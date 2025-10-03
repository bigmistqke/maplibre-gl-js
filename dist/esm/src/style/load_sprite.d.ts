import type { SpriteSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { StyleImage } from './style_image';
import type { RequestManager } from '../util/request_manager';
export type LoadSpriteResult = {
    [spriteName: string]: {
        [id: string]: StyleImage;
    };
};
export declare function normalizeSpriteURL(url: string, format: string, extension: string): string;
export declare function loadSprite(originalSprite: SpriteSpecification, requestManager: RequestManager, pixelRatio: number, abortController: AbortController): Promise<LoadSpriteResult>;
//# sourceMappingURL=load_sprite.d.ts.map