import {describe, it, expect} from 'vitest';
import {StyleEvaluator} from '@modular/renderer/style-evaluator.ts';

describe('StyleEvaluator', () => {
    it('returns layer paint properties as-is when literal', () => {
        const evaluator = new StyleEvaluator();
        const layer = {type: 'background', color: '#ff0000', opacity: 0.5};
        const result = evaluator.evaluate(layer as any, 10);
        expect(result['color']).toBe('#ff0000');
        expect(result['opacity']).toBe(0.5);
    });

    it('excludes structural fields (type, source, sourceLayer, id, onAdd)', () => {
        const evaluator = new StyleEvaluator();
        const layer = {type: 'fill', source: 'buildings', sourceLayer: 'building', id: 'my-layer', color: '#ccc'};
        const result = evaluator.evaluate(layer as any, 10);
        expect(result['type']).toBeUndefined();
        expect(result['source']).toBeUndefined();
        expect(result['sourceLayer']).toBeUndefined();
        expect(result['id']).toBeUndefined();
        expect(result['color']).toBe('#ccc');
    });

    it('excludes function-valued properties', () => {
        const evaluator = new StyleEvaluator();
        const layer = {type: 'background', color: '#000', draw: () => {}};
        const result = evaluator.evaluate(layer as any, 10);
        expect(result['draw']).toBeUndefined();
    });

    it('returns empty object for layer with no paint properties', () => {
        const evaluator = new StyleEvaluator();
        const layer = {type: 'background'};
        const result = evaluator.evaluate(layer as any, 10);
        expect(Object.keys(result)).toHaveLength(0);
    });
});
