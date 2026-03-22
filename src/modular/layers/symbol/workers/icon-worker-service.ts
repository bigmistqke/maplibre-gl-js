// src/modular/layers/symbol/workers/icon-worker-service.ts
import * as Comlink from 'comlink';
import type {Remote} from 'comlink';
import type {IconTileData, SpriteData} from '@modular/layers/symbol/icon-types.ts';

// Type-only import of the worker class — loaded via URL at runtime, not bundled inline
import type {SymbolWorkerIcon as SymbolWorkerIconType} from './symbol-worker-icon.ts';

export class IconWorkerService {
    private _worker: Worker;
    private _proxy: Remote<SymbolWorkerIconType>;

    constructor() {
        this._worker = new Worker(
            new URL('./symbol-worker-icon.ts', import.meta.url),
            {type: 'module'},
        );
        this._proxy = Comlink.wrap<SymbolWorkerIconType>(this._worker);
    }

    /**
   * Push sprite metadata to the worker. Call this once ImageManager has loaded.
   * atlasEntries come from AtlasResult.entries (subset of the fields the worker needs).
   */
    async updateImages(
        spriteData: SpriteData,
        atlasEntries: { [name: string]: { atlasX: number; atlasY: number } },
    ): Promise<void> {
        await this._proxy.updateImages(spriteData, atlasEntries);
    }

    async request(
        key: string,
        url: string,
        sourceLayer: string,
        iconField: string,
    ): Promise<IconTileData | null> {
        return this._proxy.request(key, url, sourceLayer, iconField);
    }

    requestFromPbf(
        key: string,
        pbfBuffer: ArrayBuffer,
        sourceLayer: string,
        iconField: string,
    ): void {
        void this._proxy.requestFromPbf(key, pbfBuffer, sourceLayer, iconField);
    }

    cancel(key: string): void {
        void this._proxy.cancel(key);
    }

    async getBucket(key: string): Promise<IconTileData | null> {
        return this._proxy.getBucket(key);
    }

    destroy(): void {
        this._proxy[Comlink.releaseProxy]();
        this._worker.terminate();
    }
}
