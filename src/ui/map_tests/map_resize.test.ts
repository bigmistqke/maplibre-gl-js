import {describe, beforeEach, test, expect, vi} from 'vitest';
import {MercatorProjection} from '../../geo/projection/mercator_projection';
import {createMap, beforeMapTest, sleep} from '../../util/test/util';
import {assertedNotNullish} from '../../util/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = undefined as unknown as typeof global.fetch;
});

describe('resize', () => {
    test('sets width and height from container clients', () => {
        const map = createMap(),
            container = map.getContainer();

        Object.defineProperty(container, 'clientWidth', {value: 250});
        Object.defineProperty(container, 'clientHeight', {value: 250});
        map.resize();

        expect(map.transform.width).toBe(250);
        expect(map.transform.height).toBe(250);

    });

    test('fires movestart, move, resize, and moveend events', () => {
        const map = createMap(),
            events: string[] = [];

        (['movestart', 'move', 'resize', 'moveend'] as const).forEach((event) => {
            map.on(event, (e: {type: string}) => {
                events.push(e.type);
            });
        });

        map.resize();
        expect(events).toEqual(['movestart', 'move', 'resize', 'moveend']);

    });

    test('listen to window resize event', () => {
        const spy = vi.fn();
        global.ResizeObserver = vi.fn().mockImplementation(() => ({
            observe: spy
        }));

        createMap();

        expect(spy).toHaveBeenCalled();
    });

    test('do not resize if trackResize is false', () => {
        let observerCallback: ((entries?: unknown[]) => void) | undefined;
        global.ResizeObserver = vi.fn().mockImplementation((c: (entries?: unknown[]) => void) => ({
            observe: () => { observerCallback = c; }
        }));

        const map = createMap({trackResize: false});

        const spyA = vi.spyOn(map, 'stop');
        const spyB = vi.spyOn(map, '_update');
        const spyC = vi.spyOn(map, 'resize');

        assertedNotNullish(observerCallback)();

        expect(spyA).not.toHaveBeenCalled();
        expect(spyB).not.toHaveBeenCalled();
        expect(spyC).not.toHaveBeenCalled();
    });

    test('do resize if trackResize is true (default)', async () => {
        let observerCallback: ((entries?: unknown[]) => void) | undefined;
        global.ResizeObserver = vi.fn().mockImplementation((c: (entries?: unknown[]) => void) => ({
            observe: () => { observerCallback = c; }
        }));

        const map = createMap();

        assertedNotNullish(map.style).projection = new MercatorProjection();
        const resizeSpy = vi.spyOn(map, 'resize');
        const redrawSpy = vi.spyOn(map, 'redraw');
        const renderSpy = vi.spyOn(map, '_render');

        // The initial "observe" event fired by ResizeObserver should be captured/muted
        // in the map constructor

        assertedNotNullish(observerCallback)();
        expect(resizeSpy).not.toHaveBeenCalled();
        expect(redrawSpy).not.toHaveBeenCalled();
        expect(renderSpy).not.toHaveBeenCalled();

        // The next "observe" event should fire a resize and redraw
        // Resizing canvas clears it immediately. This is why synchronous "redraw" is necessary

        assertedNotNullish(observerCallback)();
        expect(resizeSpy).toHaveBeenCalledTimes(1);
        expect(redrawSpy).toHaveBeenCalledTimes(1);
        expect(renderSpy).toHaveBeenCalledTimes(1);

        // Additional "observe" events should be throttled
        assertedNotNullish(observerCallback)();
        assertedNotNullish(observerCallback)();
        assertedNotNullish(observerCallback)();
        assertedNotNullish(observerCallback)();
        expect(resizeSpy).toHaveBeenCalledTimes(1);
        expect(redrawSpy).toHaveBeenCalledTimes(1);
        await sleep(100);
        expect(resizeSpy).toHaveBeenCalledTimes(2);
        expect(redrawSpy).toHaveBeenCalledTimes(2);
    });

    test('width and height correctly rounded', () => {
        const map = createMap();
        const container = map.getContainer();

        Object.defineProperty(container, 'clientWidth', {value: 250.6});
        Object.defineProperty(container, 'clientHeight', {value: 250.6});
        map.resize();

        expect(map.getCanvas().width).toBe(250);
        expect(map.getCanvas().height).toBe(250);
        expect(assertedNotNullish(map.painter).width).toBe(250);
        expect(assertedNotNullish(map.painter).height).toBe(250);
    });
});
