import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest, createStyle} from '../../util/test/util';
import {type EvaluationParameters} from '../../style/evaluation_parameters';
import {Style} from '../../style/style';
import {config} from '../../util/config';

beforeEach(() => {
    beforeMapTest();
    // Cast needed: intentionally clearing global.fetch for test isolation; global type doesn't allow null
    global.fetch = null as any as typeof global.fetch;
});

describe('mapOptions', () => {
    test('maxTileCacheZoomLevels: Default value is set', () => {
        const map = createMap();
        expect(map._maxTileCacheZoomLevels).toBe(config.MAX_TILE_CACHE_ZOOM_LEVELS);
    });

    test('interactive: tabindex is set accordingly to the interactiveness', () => {
        expect(createMap({interactive: true}).getCanvas().getAttribute('tabindex')).toBe('0');
        expect(createMap({interactive: false}).getCanvas().getAttribute('tabindex')).toBe('-1');
        expect(createMap({locale: {'Map.Title': 'Alt label'}}).getCanvas().getAttribute('aria-label')).toBe('Alt label');
    });

    test('maxTileCacheZoomLevels: Value can be set via map options', () => {
        const map = createMap({maxTileCacheZoomLevels: 1});
        expect(map._maxTileCacheZoomLevels).toBe(1);
    });

    test('Style validation is enabled by default', () => {
        let validationOption = false;
        vi.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options?: any) => {
            validationOption = options?.validate ?? false;
        });
        createMap();
        expect(validationOption).toBeTruthy();
    });

    test('Style validation disabled using mapOptions', () => {
        let validationOption = true;
        vi.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options?: any) => {
            validationOption = options?.validate ?? true;
        });
        createMap({validateStyle: false});

        expect(validationOption).toBeFalsy();
    });

    test('fadeDuration is set after first idle event', async () => {
        let idleTriggered = false;
        const fadeDuration = 100;
        const spy = vi.spyOn(Style.prototype, 'update').mockImplementation((parameters: EvaluationParameters) => {
            if (!idleTriggered) {
                expect(parameters.fadeDuration).toBe(0);
            } else {
                expect(parameters.fadeDuration).toBe(fadeDuration);
            }
        });
        const style = createStyle();
        const map = createMap({style, fadeDuration});
        await map.once('idle');
        idleTriggered = true;
        map.zoomTo(0.5, {duration: 100});
        spy.mockRestore();
    });
});
