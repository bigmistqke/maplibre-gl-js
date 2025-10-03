import { Texture } from '../render/texture';
import { type Context } from './context';
import { type Framebuffer } from './framebuffer';
export type PoolObject = {
    id: number;
    fbo: Framebuffer;
    texture: Texture;
    stamp: number;
    inUse: boolean;
};
export declare class RenderPool {
    private readonly _context;
    private readonly _size;
    private readonly _tileSize;
    private _objects;
    private _recentlyUsed;
    private _stamp;
    constructor(_context: Context, _size: number, _tileSize: number);
    destruct(): void;
    private _createObject;
    getObjectForId(id: number): PoolObject;
    useObject(obj: PoolObject): void;
    stampObject(obj: PoolObject): void;
    getOrCreateFreeObject(): PoolObject;
    freeObject(obj: PoolObject): void;
    freeAllObjects(): void;
    isFull(): boolean;
}
//# sourceMappingURL=render_pool.d.ts.map