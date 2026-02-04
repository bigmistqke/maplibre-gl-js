import {beforeEach, test, expect} from 'vitest';
import {Map} from '../map';
import {createMap, beforeMapTest} from '../../util/test/util';
import {assertedNotNullish} from '../../util/util';

beforeEach(() => {
    beforeMapTest();
    // Cast needed: intentionally clearing global.fetch for test isolation; global type doesn't allow null
    global.fetch = null as any as typeof global.fetch;
});

test('disable all handlers', () => {
    const map = createMap({interactive: false});

    expect(assertedNotNullish(map.boxZoom).isEnabled()).toBeFalsy();
    expect(assertedNotNullish(map.doubleClickZoom).isEnabled()).toBeFalsy();
    expect(assertedNotNullish(map.dragPan).isEnabled()).toBeFalsy();
    expect(assertedNotNullish(map.dragRotate).isEnabled()).toBeFalsy();
    expect(assertedNotNullish(map.keyboard).isEnabled()).toBeFalsy();
    expect(assertedNotNullish(map.scrollZoom).isEnabled()).toBeFalsy();
    expect(assertedNotNullish(map.touchZoomRotate).isEnabled()).toBeFalsy();
});

const handlerNames = [
    'scrollZoom',
    'boxZoom',
    'dragRotate',
    'dragPan',
    'keyboard',
    'doubleClickZoom',
    'touchZoomRotate'
] as const;
handlerNames.forEach((handlerName: string) => {
    test(`disable "${handlerName}" handler`, () => {
        const options: Record<string, any> = {};
        options[handlerName] = false;
        const map = createMap(options);

        const handler = map[handlerName as keyof Map];
        expect(assertedNotNullish(handler as any).isEnabled()).toBeFalsy();

    });
});
