import {describe, test, expect, vi} from 'vitest';
import {extractFeatures} from './bucket_utils';
import {EvaluationParameters} from '../../style/evaluation_parameters';
import Point from '@mapbox/point-geometry';
import {CanonicalTileID} from '../../tile/tile_id';

import type {IndexedFeature, PopulateParameters} from '../bucket';

// Minimal mock layer
function createMockLayer(filterResult = true) {
    return {
        id: 'test-layer',
        type: 'fill',
        _featureFilter: {
            needGeometry: false,
            filter: () => filterResult,
        },
        layout: {
            get: (key: string) => ({
                isConstant: () => true,
                evaluate: () => undefined,
            }),
        },
        isStateDependent: () => false,
    } as any;
}

// Minimal mock feature
function createMockFeature(index: number, type: number = 3): IndexedFeature {
    return {
        feature: {
            type,
            properties: {name: `feature-${index}`},
            loadGeometry: () => [[new Point(0, 0), new Point(100, 0), new Point(100, 100), new Point(0, 0)]],
        } as any,
        id: index,
        index,
        sourceLayerIndex: 0,
    };
}

function createMockOptions(): PopulateParameters {
    return {
        featureIndex: {insert: vi.fn()} as any,
        iconDependencies: {},
        patternDependencies: {},
        glyphDependencies: {},
        dashDependencies: {},
        availableImages: [],
        subdivisionGranularity: {} as any,
    };
}

describe('extractFeatures', () => {
    test('filters features by layer filter', () => {
        const layer = createMockLayer(false); // reject all
        const features = [createMockFeature(0), createMockFeature(1)];
        const canonical = new CanonicalTileID(0, 0, 0);

        const result = extractFeatures(features, layer, 0, canonical, createMockOptions());
        expect(result).toHaveLength(0);
    });

    test('passes features through when filter accepts', () => {
        const layer = createMockLayer(true);
        const features = [createMockFeature(0), createMockFeature(1), createMockFeature(2)];
        const canonical = new CanonicalTileID(0, 0, 0);

        const result = extractFeatures(features, layer, 0, canonical, createMockOptions());
        expect(result).toHaveLength(3);
        expect(result[0].index).toBe(0);
        expect(result[1].index).toBe(1);
        expect(result[2].index).toBe(2);
    });

    test('sorts by sort key when provided', () => {
        const layer = createMockLayer(true);
        // Make sort key non-constant and return descending values
        layer.layout.get = (key: string) => {
            if (key === 'fill-sort-key') {
                return {
                    isConstant: () => false,
                    evaluate: (feature: any) => {
                        // Sort in reverse order by index
                        return -feature.properties.index;
                    },
                };
            }
            return {isConstant: () => true, evaluate: () => undefined};
        };

        const features = [createMockFeature(0), createMockFeature(1), createMockFeature(2)];
        // Give features index property for sort evaluation
        features.forEach((f, i) => {
            (f.feature as any).properties = {index: i};
        });

        const canonical = new CanonicalTileID(0, 0, 0);
        const result = extractFeatures(features, layer, 0, canonical, createMockOptions(), 'fill-sort-key');

        // Should be sorted by sort key (descending index → reversed order)
        expect(result[0].index).toBe(2);
        expect(result[1].index).toBe(1);
        expect(result[2].index).toBe(0);
    });

    test('extracts geometry from features', () => {
        const layer = createMockLayer(true);
        const features = [createMockFeature(0)];
        const canonical = new CanonicalTileID(0, 0, 0);

        const result = extractFeatures(features, layer, 0, canonical, createMockOptions());
        expect(result[0].geometry).toBeDefined();
        expect(result[0].geometry.length).toBeGreaterThan(0);
    });
});
