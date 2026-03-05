import {describe, test, expect, vi, type Mock} from 'vitest';
import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../tile/tile_id';
import {SymbolBucket} from '../data/bucket/symbol_bucket';
import {TileManager} from '../tile/tile_manager';
import {Tile} from '../tile/tile';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import {Painter, type RenderOptions} from './painter';
import {Program} from './program';
import {drawSymbols} from './draw_symbol';
import * as symbolProjection from '../symbol/projection';
import type {ZoomHistory} from '../style/zoom_history';
import type {Map} from '../ui/map';
import {type IReadonlyTransform} from '../geo/transform_interface';
import type {EvaluationParameters} from '../style/evaluation_parameters';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type Style} from '../style/style';
import {MercatorProjection} from '../geo/projection/mercator_projection';
import type {ProjectionData} from '../geo/projection/projection_data';
import type {CrossTileID, VariableOffset} from '../symbol/placement';

vi.mock('./painter');
vi.mock('./program');
vi.mock('../tile/tile_manager');
vi.mock('../tile/tile');
vi.mock('../data/bucket/symbol_bucket', () => {
    return {
        SymbolBucket: vi.fn()
    };
});

vi.mock('../symbol/projection');
(symbolProjection.getPitchedLabelPlaneMatrix as Mock).mockReturnValue(mat4.create());

function createMockTransform() {
    return {
        pitch: 0,
        labelPlaneMatrix: mat4.create(),
        getCircleRadiusCorrection: () => 1,
        angle: 0,
        zoom: 0,
        getProjectionData(_canonical: unknown, fallback: mat4): ProjectionData {
            return {
                mainMatrix: fallback,
                tileMercatorCoords: [0, 0, 1, 1],
                clippingPlane: [0, 0, 0, 0],
                projectionTransition: 0.0,
                fallbackMatrix: fallback,
            };
        },
    } as any as IReadonlyTransform;
}

describe('drawSymbol', () => {
    test('should not do anything', () => {
        // Painter is mocked via vi.mock, so constructor args are unused
        const mockPainter = new Painter(null as any, null as any); // Test mock
        mockPainter.renderPass = 'opaque';

        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        // renderPass is 'opaque' so drawSymbols returns immediately; args after painter are unused
        drawSymbols(mockPainter, null as any, null as any, null as any, null as any, renderOptions); // Test mock

        expect(mockPainter.colorModeForRenderPass).not.toHaveBeenCalled();
    });

    test('should call program.draw', () => {
        const painterMock = new Painter(null as any, null as any); // Test mock
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        painterMock.renderPass = 'translucent';
        painterMock.transform = createMockTransform();
        painterMock.options = {} as any;
        painterMock.style = {
            map: {},
            projection: new MercatorProjection()
        } as any as Style;

        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'symbol',
            layout: {},
            paint: {
                'text-opacity': 1
            }
        } as SymbolLayerSpecification;
        const layer = new SymbolStyleLayer(layerSpec, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix32f = mat4.create();
        const programMock = new Program(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any); // Test mock
        (painterMock.useProgram as Mock).mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null as any); // Test mock
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            },
            hasVisibleVertices: true
        } as any;
        bucketMock.iconSizeData = {
            kind: 'constant',
            layoutSize: 1
        };
        const tile = new Tile(tileId, 256);
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        tile.getBucket = () => bucketMock;
        tile.tileID = tileId;
        const tileManagerMock = new TileManager(null as any, null as any, null as any); // Test mock
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;
        tileManagerMock.getTile = (_a) => tile;

        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawSymbols(painterMock, tileManagerMock, layer, [tileId], null as any, renderOptions); // Test mock

        expect(programMock.draw).toHaveBeenCalledTimes(1);
    });

    test('should call updateLineLabels with rotateToLine === false if text-rotation-alignment is viewport-glyph', () => {

        const painterMock = new Painter(null as any, null as any); // Test mock
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        painterMock.renderPass = 'translucent';
        painterMock.transform = createMockTransform();
        painterMock.options = {} as any;

        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'symbol',
            layout: {
                'text-rotation-alignment': 'viewport-glyph',
                'text-field': 'ABC',
                'symbol-placement': 'line',
            },
            paint: {
                'text-opacity': 1
            }
        } as SymbolLayerSpecification;
        const layer = new SymbolStyleLayer(layerSpec, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix32f = mat4.create();
        const programMock = new Program(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any); // Test mock
        (painterMock.useProgram as Mock).mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null as any); // Test mock
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            },
            hasVisibleVertices: true
        } as any;
        bucketMock.iconSizeData = {
            kind: 'constant',
            layoutSize: 1
        };
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        (tile.getBucket as Mock).mockReturnValue(bucketMock);
        const tileManagerMock = new TileManager(null as any, null as any, null as any); // Test mock
        (tileManagerMock.getTile as Mock).mockReturnValue(tile);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;
        painterMock.style = {
            map: {},
            projection: new MercatorProjection()
        } as any as Style;

        const spy = vi.spyOn(symbolProjection, 'updateLineLabels');
        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawSymbols(painterMock, tileManagerMock, layer, [tileId], null as any, renderOptions); // Test mock

        expect(spy.mock.calls[0][7]).toBeFalsy(); // rotateToLine === false
    });

    test('transparent tile optimization should prevent program.draw from being called', () => {

        const painterMock = new Painter(null as any, null as any); // Test mock
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        painterMock.renderPass = 'translucent';
        painterMock.transform = createMockTransform();
        painterMock.options = {} as any;
        painterMock.style = {
            projection: new MercatorProjection()
        } as any as Style;

        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'symbol',
            layout: {},
            paint: {
                'text-opacity': 1
            }
        } as SymbolLayerSpecification;
        const layer = new SymbolStyleLayer(layerSpec, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix32f = mat4.create();
        const programMock = new Program(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any); // Test mock
        (painterMock.useProgram as Mock).mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null as any); // Test mock
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            },
            hasVisibleVertices: false // nark this bucket as having no visible vertices
        } as any;
        bucketMock.iconSizeData = {
            kind: 'constant',
            layoutSize: 1
        };
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        (tile.getBucket as Mock).mockReturnValue(bucketMock);
        const tileManagerMock = new TileManager(null as any, null as any, null as any); // Test mock
        (tileManagerMock.getTile as Mock).mockReturnValue(tile);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;

        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawSymbols(painterMock, tileManagerMock, layer, [tileId], null as any, renderOptions); // Test mock

        expect(programMock.draw).toHaveBeenCalledTimes(0);
    });
});
