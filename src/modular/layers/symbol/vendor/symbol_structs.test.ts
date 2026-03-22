import {describe, it, expect} from 'vitest';
import {createStructArray} from '@modular/core/struct-array.ts';
import {
    SymbolLineVertexLayout, GlyphOffsetLayout, DynamicLayoutLayout,
    CollisionBoxLayout, SymbolInstanceLayout, PlacedSymbolLayout,
    TextAnchorOffsetLayout, CollisionVertexLayout, OpacityLayout,
} from '@modular/layers/symbol/vendor/symbol_structs.ts';

describe('SymbolLineVertexLayout', () => {
    it('has stride 6 and correct fields', () => {
        expect(SymbolLineVertexLayout.stride).toBe(6);
        const arr = createStructArray(SymbolLineVertexLayout);
        arr.emplaceBack(100, 200, 500);
        expect(arr.getx(0)).toBe(100);
        expect(arr.gety(0)).toBe(200);
        expect(arr.gettileUnitDistanceFromAnchor(0)).toBe(500);
    });
});

describe('GlyphOffsetLayout', () => {
    it('has stride 4 and correct fields', () => {
        expect(GlyphOffsetLayout.stride).toBe(4);
        const arr = createStructArray(GlyphOffsetLayout);
        arr.emplaceBack(42.5);
        expect(arr.getoffsetX(0)).toBeCloseTo(42.5);
    });
});

describe('DynamicLayoutLayout', () => {
    it('has stride 12 and correct fields', () => {
        expect(DynamicLayoutLayout.stride).toBe(12);
        const arr = createStructArray(DynamicLayoutLayout);
        arr.emplaceBack(1.0, 2.0, 0.5);
        expect(arr.float32[0]).toBeCloseTo(1.0);
        expect(arr.float32[1]).toBeCloseTo(2.0);
        expect(arr.float32[2]).toBeCloseTo(0.5);
    });
});

describe('CollisionBoxLayout', () => {
    it('has stride 20 and round-trips correctly', () => {
        expect(CollisionBoxLayout.stride).toBe(20);
        const arr = createStructArray(CollisionBoxLayout);
        arr.emplaceBack(10, 20, -5, -10, 5, 10, 42, 3, 7);
        const row = arr.get(0);
        expect(row.anchorPointX).toBe(10);
        expect(row.anchorPointY).toBe(20);
        expect(row.x1).toBe(-5);
        expect(row.y1).toBe(-10);
        expect(row.x2).toBe(5);
        expect(row.y2).toBe(10);
        expect(row.featureIndex).toBe(42);
        expect(row.sourceLayerIndex).toBe(3);
        expect(row.bucketIndex).toBe(7);
    });
});

describe('SymbolInstanceLayout', () => {
    it('has stride 64 and round-trips representative fields', () => {
        expect(SymbolInstanceLayout.stride).toBe(64);
        const arr = createStructArray(SymbolInstanceLayout);
        // 28 fields — fill with identifiable values
        arr.emplaceBack(
            100, 200,       // anchorX, anchorY
            1, 2, 3, 4,     // justified/vertical text symbol indices
            5, 6,            // placed icon indices
            7,               // key
            10, 11,          // textBoxStart/End
            12, 13,          // verticalTextBoxStart/End
            14, 15,          // iconBoxStart/End
            16, 17,          // verticalIconBoxStart/End
            18,              // featureIndex
            19, 20,          // numHorizontal/VerticalGlyphVertices
            21, 22,          // numIcon/VerticalIconVertices
            23,              // useRuntimeCollisionCircles
            999,             // crossTileID
            1.5, 2.5,        // textBoxScale, collisionCircleDiameter
            30, 31,          // textAnchorOffsetStart/End
        );
        const row = arr.get(0);
        expect(row.anchorX).toBe(100);
        expect(row.anchorY).toBe(200);
        expect(row.rightJustifiedTextSymbolIndex).toBe(1);
        expect(row.key).toBe(7);
        expect(row.featureIndex).toBe(18);
        expect(row.crossTileID).toBe(999);
        expect(row.textBoxScale).toBeCloseTo(1.5);
        expect(row.collisionCircleDiameter).toBeCloseTo(2.5);
        expect(row.textAnchorOffsetStartIndex).toBe(30);
        expect(row.textAnchorOffsetEndIndex).toBe(31);
    });
});

describe('PlacedSymbolLayout', () => {
    it('has stride 48 and round-trips correctly', () => {
        expect(PlacedSymbolLayout.stride).toBe(48);
        const arr = createStructArray(PlacedSymbolLayout);
        arr.emplaceBack(
            50, 60,          // anchorX, anchorY
            10, 5,           // glyphStartIndex, numGlyphs
            100, 200, 50,    // vertexStartIndex, lineStartIndex, lineLength
            3, 16, 24,       // segment, lowerSize, upperSize
            1.5, -2.5,       // lineOffsetX, lineOffsetY
            1, 0, 0,         // writingMode, placedOrientation, hidden
            777,             // crossTileID
            -1,              // associatedIconIndex
        );
        const row = arr.get(0);
        expect(row.anchorX).toBe(50);
        expect(row.anchorY).toBe(60);
        expect(row.glyphStartIndex).toBe(10);
        expect(row.numGlyphs).toBe(5);
        expect(row.vertexStartIndex).toBe(100);
        expect(row.lineStartIndex).toBe(200);
        expect(row.lineLength).toBe(50);
        expect(row.segment).toBe(3);
        expect(row.lineOffsetX).toBeCloseTo(1.5);
        expect(row.lineOffsetY).toBeCloseTo(-2.5);
        expect(row.writingMode).toBe(1);
        expect(row.placedOrientation).toBe(0);
        expect(row.hidden).toBe(0);
        expect(row.crossTileID).toBe(777);
        expect(row.associatedIconIndex).toBe(-1);
    });
});

describe('TextAnchorOffsetLayout', () => {
    it('has stride 12 and round-trips correctly', () => {
        expect(TextAnchorOffsetLayout.stride).toBe(12);
        const arr = createStructArray(TextAnchorOffsetLayout);
        arr.emplaceBack(5, 1.25, -3.75);
        const row = arr.get(0);
        expect(row.textAnchor).toBe(5);
        expect(row.textOffset0).toBeCloseTo(1.25);
        expect(row.textOffset1).toBeCloseTo(-3.75);
    });
});

describe('CollisionVertexLayout', () => {
    it('has stride 12 and round-trips correctly', () => {
        expect(CollisionVertexLayout.stride).toBe(12);
        const arr = createStructArray(CollisionVertexLayout);
        arr.emplaceBack(1, 0, 3.5, -4.5);
        const row = arr.get(0);
        expect(row.placed).toBe(1);
        expect(row.notUsed).toBe(0);
        expect(row.shiftX).toBeCloseTo(3.5);
        expect(row.shiftY).toBeCloseTo(-4.5);
    });
});

describe('OpacityLayout', () => {
    it('has stride 4 and round-trips correctly', () => {
        expect(OpacityLayout.stride).toBe(4);
        const arr = createStructArray(OpacityLayout);
        arr.emplaceBack(0xFFFFFFFF);
        expect(arr.get(0).targetOpacity).toBe(0xFFFFFFFF);
    });
});
