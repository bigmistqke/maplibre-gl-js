// src/modular/layers/symbol/base/tile-fetcher.test.ts
import {describe, it, expect, vi} from 'vitest';
import {TileFetcher} from '@modular/layers/symbol/base/tile-fetcher.ts';

describe('TileFetcher', () => {
    function createFetcher<T>(fetchFn: (key: string, data: ArrayBuffer) => Promise<T | null>) {
        const onReady = vi.fn<(key: string, result: T) => void>();
        const fetcher = new TileFetcher<T>({fetch: fetchFn, onReady});
        return {fetcher, onReady};
    }

    it('starts with no pending or ready keys', () => {
        const {fetcher} = createFetcher(async () => null);
        expect(fetcher.get('a')).toBeNull();
        expect(fetcher.hasPending('a')).toBe(false);
    });

    it('request() triggers fetch and calls onReady when resolved', async () => {
        const result = {data: 42};
        const fetchFn = vi.fn(async () => result);
        const {fetcher, onReady} = createFetcher(fetchFn);

        fetcher.request('tile-1', new ArrayBuffer(8));
        expect(fetcher.hasPending('tile-1')).toBe(true);

        await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith('tile-1', result));
        expect(fetcher.get('tile-1')).toBe(result);
        expect(fetcher.hasPending('tile-1')).toBe(false);
    });

    it('request() is a no-op if key is already fetching', async () => {
        const fetchFn = vi.fn(async () => ({v: 1}));
        const {fetcher} = createFetcher(fetchFn);

        fetcher.request('a', new ArrayBuffer(0));
        fetcher.request('a', new ArrayBuffer(0));

        await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    });

    it('request() is a no-op if key is already ready', async () => {
        const fetchFn = vi.fn(async () => ({v: 1}));
        const {fetcher} = createFetcher(fetchFn);

        fetcher.request('a', new ArrayBuffer(0));
        await vi.waitFor(() => expect(fetcher.get('a')).not.toBeNull());

        fetcher.request('a', new ArrayBuffer(0));
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('evict() removes ready result', async () => {
        const {fetcher} = createFetcher(async () => ({v: 1}));
        fetcher.request('a', new ArrayBuffer(0));
        await vi.waitFor(() => expect(fetcher.get('a')).not.toBeNull());

        fetcher.evict('a');
        expect(fetcher.get('a')).toBeNull();
        expect(fetcher.hasPending('a')).toBe(false);
    });

    it('evict() cancels in-flight fetch (onReady not called)', async () => {
        let resolve: () => void;
        const fetchFn = vi.fn(() => new Promise<{ v: number }>(r => { resolve = () => r({v: 1}); }));
        const {fetcher, onReady} = createFetcher(fetchFn);

        fetcher.request('a', new ArrayBuffer(0));
        expect(fetcher.hasPending('a')).toBe(true);

        fetcher.evict('a');
        expect(fetcher.hasPending('a')).toBe(false);

        resolve!();
        await Promise.resolve();
        expect(onReady).not.toHaveBeenCalled();
    });

    it('invalidate() allows re-fetch while keeping old result', async () => {
        let callCount = 0;
        const fetchFn = vi.fn(async () => ({v: ++callCount}));
        const {fetcher, onReady} = createFetcher(fetchFn);

        fetcher.request('a', new ArrayBuffer(0));
        await vi.waitFor(() => expect(fetcher.get('a')).toEqual({v: 1}));

        fetcher.invalidate('a');
        // Old result still available
        expect(fetcher.get('a')).toEqual({v: 1});

        // New request triggers a fresh fetch
        fetcher.request('a', new ArrayBuffer(0));
        expect(fetcher.hasPending('a')).toBe(true);
        await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
        expect(fetcher.get('a')).toEqual({v: 2});
    });

    it('null fetch result does not call onReady', async () => {
        const {fetcher, onReady} = createFetcher(async () => null);
        fetcher.request('a', new ArrayBuffer(0));
        await Promise.resolve();
        await Promise.resolve();
        expect(onReady).not.toHaveBeenCalled();
        expect(fetcher.get('a')).toBeNull();
    });

    it('evictAll() removes all keys', async () => {
        const {fetcher} = createFetcher(async () => ({v: 1}));
        fetcher.request('a', new ArrayBuffer(0));
        fetcher.request('b', new ArrayBuffer(0));
        await vi.waitFor(() => {
            expect(fetcher.get('a')).not.toBeNull();
            expect(fetcher.get('b')).not.toBeNull();
        });

        fetcher.evictAll();
        expect(fetcher.get('a')).toBeNull();
        expect(fetcher.get('b')).toBeNull();
    });
});
