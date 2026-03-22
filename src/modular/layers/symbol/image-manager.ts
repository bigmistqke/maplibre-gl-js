import {loadSprite} from '@modular/layers/symbol/sprite-loader.ts';
import {buildAtlas} from '@modular/layers/symbol/image-atlas.ts';
import type {SpriteData} from '@modular/layers/symbol/icon-types.ts';
import type {AtlasEntry, AtlasResult} from '@modular/layers/symbol/image-atlas.ts';

export type ImageManagerOptions = {
    url: string;
};

export type ImageReadyCallback = (spriteData: SpriteData, atlas: AtlasResult) => void;

export class ImageManager {
    private _url: string;
    private _spriteData: SpriteData | null = null;
    private _atlas: AtlasResult | null = null;
    private _callbacks: ImageReadyCallback[] = [];
    private _abortController: AbortController | null = null;
    private _loaded = false;

    constructor(options: ImageManagerOptions) {
        this._url = options.url;
    }

    /**
   * Begin loading the sprite. Safe to call multiple times — only loads once.
   * Calls onReady immediately if already loaded.
   */
    load(onReady?: ImageReadyCallback): void {
        if (onReady) {
            if (this._loaded && this._spriteData && this._atlas) {
                onReady(this._spriteData, this._atlas);
                return;
            }
            this._callbacks.push(onReady);
        }

        if (this._abortController) return;  // already loading

        this._abortController = new AbortController();
        loadSprite(this._url, this._abortController.signal).then(({data, image}) => {
            this._spriteData = data;
            this._atlas = buildAtlas(data, image);
            this._loaded = true;
            for (const cb of this._callbacks) cb(this._spriteData, this._atlas);
            this._callbacks = [];
        }).catch(() => {
            // silently ignore abort errors; re-throw real errors in debug mode
        });
    }

    /** True once sprite.json + sprite.png have been successfully loaded and packed. */
    get isLoaded(): boolean {
        return this._loaded;
    }

    /** Sprite metadata, or null if not yet loaded. */
    get spriteData(): SpriteData | null {
        return this._spriteData;
    }

    /** Atlas result, or null if not yet loaded. */
    get atlas(): AtlasResult | null {
        return this._atlas;
    }

    /** Look up an entry in the atlas by sprite name. Returns null if not found or not loaded. */
    getEntry(name: string): AtlasEntry | null {
        return this._atlas?.entries[name] ?? null;
    }

    destroy(): void {
        this._abortController?.abort();
        this._abortController = null;
        this._callbacks = [];
    }
}
