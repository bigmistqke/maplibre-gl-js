import {beforeAll, describe, test, expect} from 'vitest';
import {FillExtrusionBucket} from './fill_extrusion_bucket';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters';
import {type ZoomHistory} from '../../style/zoom_history';
import {type BucketParameters} from '../bucket';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile';
import {type VectorTileLayer} from '@mapbox/vector-tile';
import {assertedNotNullish} from '../../util/util';
import {CanonicalTileID} from '../../source/tile_id';

function createFillExtrusionBucket({id, layout, paint, globalState, availableImages}: CreateBucketParameters): FillExtrusionBucket {
    const layer = new FillExtrusionStyleLayer({
        id,
        type: 'fill-extrusion',
        layout,
        paint
    } as LayerSpecification, assertedNotNullish(globalState, 'globalState must be defined'));
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters,
        assertedNotNullish(availableImages, 'availableImages must be defined'));

    return new FillExtrusionBucket({layers: [layer]} as BucketParameters<FillExtrusionStyleLayer>);
}

describe('FillExtrusionBucket', () => {
    let sourceLayer: VectorTileLayer;
    beforeAll(() => {
        // Load fill extrusion features from fixture tile.
        sourceLayer = loadVectorTile().layers.water;
    });

    test('FillExtrusionBucket fill-pattern with global-state', () => {
        const availableImages: string[] = [];
        const bucket = createFillExtrusionBucket({id: 'test',
            paint: {'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']]},
            globalState: {pattern: 'test-pattern'},
            availableImages
        });

        bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions(availableImages), new CanonicalTileID(0, 0, 0));

        expect(assertedNotNullish(bucket.features, 'bucket.features must be defined').length).toBeGreaterThan(0);
        expect(assertedNotNullish(bucket.features, 'bucket.features must be defined')[0].patterns).toEqual({
            test: {min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern'}
        });
    });
});
