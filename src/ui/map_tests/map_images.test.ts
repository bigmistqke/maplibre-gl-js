import {beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {type StyleImageInterface} from '../../style/style_image';
import {assertedNotNullish} from '../../util/util';

beforeEach(() => {
    beforeMapTest();
    // eslint-disable-next-line -- setting fetch to null to prevent network requests in tests
    global.fetch = null as any;
});

test('listImages', async () => {
    const map = createMap();

    await map.once('load');
    expect(map.listImages()).toHaveLength(0);

    map.addImage('img', {width: 1, height: 1, data: new Uint8Array(4)});

    const images = map.listImages();
    expect(images).toHaveLength(1);
    expect(images[0]).toBe('img');  
});

test('listImages throws an error if called before "load"', () => {
    const map = createMap();
    expect(() => {
        map.listImages();
    }).toThrow(Error);
});

test('map fires `styleimagemissing` for missing icons', async () => {
    const map = createMap();

    const id = 'missing-image';

    const sampleImage = {width: 2, height: 1, data: new Uint8Array(8)};

    let called: string | undefined;
    map.on('styleimagemissing', e => {
        map.addImage(e.id, sampleImage);
        called = e.id;
    });

    expect(map.hasImage(id)).toBeFalsy();

    const generatedImage = await assertedNotNullish(map.style).imageManager.getImages([id]);
    const image = assertedNotNullish(generatedImage[id]);
    const imageData = assertedNotNullish(image.data);
    expect(imageData.width).toEqual(sampleImage.width);
    expect(imageData.height).toEqual(sampleImage.height);
    expect(imageData.data).toEqual(sampleImage.data);
    expect(called).toBe(id);
    expect(map.hasImage(id)).toBeTruthy();
});

test('map getImage matches addImage, uintArray', () => {
    const map = createMap();
    const id = 'add-get-uint';
    const inputImage = {width: 2, height: 1, data: new Uint8Array(8)};

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = assertedNotNullish(map.getImage(id));
    const gotImageData = assertedNotNullish(gotImage.data);
    expect(gotImageData.width).toEqual(inputImage.width);
    expect(gotImageData.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, uintClampedArray', () => {
    const map = createMap();
    const id = 'add-get-uint-clamped';
    const inputImage = {width: 1, height: 2, data: new Uint8ClampedArray(8)};

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = assertedNotNullish(map.getImage(id));
    const gotImageData = assertedNotNullish(gotImage.data);
    expect(gotImageData.width).toEqual(inputImage.width);
    expect(gotImageData.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, ImageData', () => {
    const map = createMap();
    const id = 'add-get-image-data';
    const inputImage = new ImageData(1, 3);

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = assertedNotNullish(map.getImage(id));
    const gotImageData = assertedNotNullish(gotImage.data);
    expect(gotImageData.width).toEqual(inputImage.width);
    expect(gotImageData.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface uint', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-uint';
    const inputImage: StyleImageInterface = {
        width: 3,
        height: 1,
        data: new Uint8Array(12)
    };

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = assertedNotNullish(map.getImage(id));
    const gotImageData = assertedNotNullish(gotImage.data);
    expect(gotImageData.width).toEqual(inputImage.width);
    expect(gotImageData.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface clamped', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-clamped';
    const inputImage: StyleImageInterface = {
        width: 4,
        height: 1,
        data: new Uint8ClampedArray(16)
    };

    map.addImage(id, inputImage);
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = assertedNotNullish(map.getImage(id));
    const gotImageData = assertedNotNullish(gotImage.data);
    expect(gotImageData.width).toEqual(inputImage.width);
    expect(gotImageData.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(false);
});

test('map getImage matches addImage, StyleImageInterface SDF', () => {
    const map = createMap();
    const id = 'add-get-style-image-iface-sdf';
    const inputImage: StyleImageInterface = {
        width: 5,
        height: 1,
        data: new Uint8Array(20)
    };

    map.addImage(id, inputImage, {sdf: true});
    expect(map.hasImage(id)).toBeTruthy();

    const gotImage = assertedNotNullish(map.getImage(id));
    const gotImageData = assertedNotNullish(gotImage.data);
    expect(gotImageData.width).toEqual(inputImage.width);
    expect(gotImageData.height).toEqual(inputImage.height);
    expect(gotImage.sdf).toBe(true);
});

test('map does not fire `styleimagemissing` for empty icon values', async () => {
    const map = createMap();

    await map.once('load');

    map.addSource('foo', {
        type: 'geojson',
        data: {type: 'Point', coordinates: [0, 0]}
    });
    map.addLayer({
        id: 'foo',
        type: 'symbol',
        source: 'foo',
        layout: {
            'icon-image': ['case', true, '', '']
        }
    });

    const spy = vi.fn();
    map.on('styleimagemissing', spy);

    await map.once('idle');
    expect(spy).not.toHaveBeenCalled();
});
