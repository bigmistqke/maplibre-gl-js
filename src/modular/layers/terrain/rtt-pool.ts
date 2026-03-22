import type {FramebufferObject, RendererInternals} from '@modular/core/surface.ts';

export const FBO_SIZE = 512;

export class RTTPool {
    private _pool = new globalThis.Map<string, FramebufferObject>();
    // Stored from first getOrCreate call so evict() can destroy without needing internals.
    private _destroyFn: ((fb: FramebufferObject) => void) | null = null;

    getOrCreate(key: string, internals: RendererInternals): FramebufferObject {
        if (!this._destroyFn) this._destroyFn = (fb) => internals.destroyFramebuffer(fb);
        const cached = this._pool.get(key);
        if (cached) return cached;
        const fbo = internals.createFramebuffer(FBO_SIZE, FBO_SIZE);
        this._pool.set(key, fbo);
        return fbo;
    }

    /** Matches spec signature — no internals param. Destroyable because _destroyFn is stored. */
    evict(retainedKeys: Set<string>, onEvict?: (key: string) => void): void {
        for (const [key, fbo] of this._pool) {
            if (!retainedKeys.has(key)) {
                this._destroyFn?.(fbo);
                onEvict?.(key);
                this._pool.delete(key);
            }
        }
    }

    /** Uses stored _destroyFn — no internals arg needed, matches Surface.destroy() signature. */
    destroy(): void {
        for (const fbo of this._pool.values()) {
            this._destroyFn?.(fbo);
        }
        this._pool.clear();
        this._destroyFn = null;
    }
}
