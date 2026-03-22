// src/modular/layers/symbol/base/tile-fetcher.ts

export interface TileFetcherOptions<T> {
    fetch: (key: string, data: ArrayBuffer) => Promise<T | null>;
    onReady: (key: string, result: T) => void;
}

type TileState = 'fetching' | 'ready' | 'invalidated';

export class TileFetcher<T> {
    private _fetch: TileFetcherOptions<T>['fetch'];
    private _onReady: TileFetcherOptions<T>['onReady'];
    private _state = new Map<string, TileState>();
    private _results = new Map<string, T>();
    /** Monotonic version per key — evict/invalidate bumps it to ignore stale resolves */
    private _version = new Map<string, number>();

    constructor(options: TileFetcherOptions<T>) {
        this._fetch = options.fetch;
        this._onReady = options.onReady;
    }

    request(key: string, data: ArrayBuffer): void {
        const state = this._state.get(key);
        if (state === 'fetching' || state === 'ready') return;

        this._state.set(key, 'fetching');
        const ver = (this._version.get(key) ?? 0) + 1;
        this._version.set(key, ver);

        this._fetch(key, data).then(result => {
            // Stale if evicted or invalidated+re-requested since we started
            if (this._version.get(key) !== ver) return;
            if (result === null) {
                this._state.delete(key);
                return;
            }
            this._state.set(key, 'ready');
            this._results.set(key, result);
            this._onReady(key, result);
        });
    }

    get(key: string): T | null {
        return this._results.get(key) ?? null;
    }

    hasPending(key: string): boolean {
        return this._state.get(key) === 'fetching';
    }

    invalidate(key: string): void {
        if (!this._state.has(key)) return;
        // Bump version to ignore any in-flight resolve
        this._version.set(key, (this._version.get(key) ?? 0) + 1);
        // Keep old result available, but mark as invalidated so request() works
        this._state.set(key, 'invalidated');
    }

    evict(key: string): void {
        this._version.set(key, (this._version.get(key) ?? 0) + 1);
        this._state.delete(key);
        this._results.delete(key);
    }

    evictAll(): void {
        for (const key of [...this._state.keys()]) this.evict(key);
    }
}
