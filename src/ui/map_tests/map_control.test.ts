import {beforeEach, test, expect, vi} from 'vitest';
import {Map} from '../map';
import {createMap, beforeMapTest} from '../../util/test/util';
import {type IControl} from '../control/control';

beforeEach(() => {
    beforeMapTest();
    // Cast needed: intentionally clearing global.fetch for test isolation; global type doesn't allow null
    global.fetch = null as any as typeof global.fetch;
});

test('addControl', () => {
    const map = createMap();
    const control = {
        onAdd(_: Map) {
            expect(map).toBe(_);
            return window.document.createElement('div');
        }
    } as any as IControl;
    map.addControl(control);
    expect(map._controls[0]).toBe(control);
});

test('removeControl errors on invalid arguments', () => {
    const map = createMap();
    const control = {} as any as IControl;
    const stub = vi.spyOn(console, 'error').mockImplementation(() => {});

    map.addControl(control);
    map.removeControl(control);
    expect(stub).toHaveBeenCalledTimes(2);

});

test('removeControl', () => {
    const map = createMap();
    const control = {
        onAdd() {
            return window.document.createElement('div');
        },
        onRemove(_: Map) {
            expect(map).toBe(_);
        }
    };
    map.addControl(control);
    map.removeControl(control);
    expect(map._controls).toHaveLength(0);

});

test('hasControl', () => {
    const map = createMap();
    function Ctrl(this: any) {
        // dummy constructor
    }
    Ctrl.prototype = {
        onAdd(_: Map) {
            return window.document.createElement('div');
        }
    };

    const control = new (Ctrl as any)() as any as IControl;
    expect(map.hasControl(control)).toBe(false);
    map.addControl(control);
    expect(map.hasControl(control)).toBe(true);
});
