import {beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {assertedNotNullish} from '../../util/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = undefined as unknown as typeof global.fetch;
});

test('set tile LOD params for a specific source', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    map.addSource('source-id2', {type: 'raster', url: ''});

    expect(assertedNotNullish(map.getSource('source-id1')).calculateTileZoom).toBeUndefined();
    map.setSourceTileLodParams(1, 1, 'source-id1');
    expect(assertedNotNullish(map.getSource('source-id1')).calculateTileZoom).toBeDefined();
    expect(assertedNotNullish(map.getSource('source-id2')).calculateTileZoom).toBeUndefined();
});

test('set tile LOD params for all sources', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    map.addSource('source-id2', {type: 'raster', url: ''});

    expect(assertedNotNullish(map.getSource('source-id1')).calculateTileZoom).toBeUndefined();
    expect(assertedNotNullish(map.getSource('source-id2')).calculateTileZoom).toBeUndefined();
    map.setSourceTileLodParams(1, 1);
    expect(assertedNotNullish(map.getSource('source-id1')).calculateTileZoom).toBeDefined();
    expect(assertedNotNullish(map.getSource('source-id2')).calculateTileZoom).toBeDefined();
});

test('set tile LOD params for a non-existent source', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    map.addSource('source-id2', {type: 'raster', url: ''});

    expect(assertedNotNullish(map.getSource('source-id1')).calculateTileZoom).toBeUndefined();
    expect(assertedNotNullish(map.getSource('source-id2')).calculateTileZoom).toBeUndefined();
    expect(() => {map.setSourceTileLodParams(1, 1, 'non-existent-source-id');}).toThrowError();
    expect(assertedNotNullish(map.getSource('source-id1')).calculateTileZoom).toBeUndefined();
    expect(assertedNotNullish(map.getSource('source-id2')).calculateTileZoom).toBeUndefined();
});