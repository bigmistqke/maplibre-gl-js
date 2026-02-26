/**
 * MapContext provides shared state via an upsert pattern.
 * Features create shared dependencies via `ensure()` — create if first, reuse if exists.
 */
export class MapContext {
    private _instances = new Map<any, any>();

    /**
     * Upsert: return existing instance or create new one.
     * Class constructor is the key — no strings.
     */
    ensure<T>(key: new (...args: any[]) => T, factory: () => T): T {
        if (!this._instances.has(key)) {
            this._instances.set(key, factory());
        }
        return this._instances.get(key);
    }

    /**
     * Lifecycle: call beginFrame on all created instances that support it.
     */
    beginFrame(): void {
        for (const instance of this._instances.values()) {
            if (typeof instance.beginFrame === 'function') instance.beginFrame();
        }
    }

    /**
     * Cleanup: destroy all created instances that support it.
     */
    destroy(): void {
        for (const instance of this._instances.values()) {
            if (typeof instance.destroy === 'function') instance.destroy();
        }
        this._instances.clear();
    }
}
