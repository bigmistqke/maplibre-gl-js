import Benchmark from '../lib/benchmark';

import {latest as spec, convertFunction, isFunction, createFunction, createPropertyExpression} from '@maplibre/maplibre-gl-style-spec';
import fetchStyle from '../lib/fetch_style';

import type {StyleSpecification, StylePropertyExpression, StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

interface DataT {
    propertySpec: StylePropertySpecification;
    rawValue: unknown;
    rawExpression: unknown;
    compiledFunction: StylePropertyExpression;
    compiledExpression: StylePropertyExpression;
}

class ExpressionBenchmark extends Benchmark {
    data: Array<DataT> = [];
    style: string | StyleSpecification;

    constructor(style: string | StyleSpecification) {
        super();
        this.style = style;
    }

    async setup() {
        const json = await fetchStyle(this.style);
        this.data = [];

        for (const layer of json.layers) {
            // some older layers still use the deprecated `ref property` instead of `type`
            // if we don't filter out these older layers, the logic below will cause a fatal error
            if (!layer.type) {
                continue;
            }

            const expressionData = (rawValue: unknown, propertySpec: StylePropertySpecification): DataT => {
                const rawExpression = convertFunction(rawValue, propertySpec);
                const compiledFunction = createFunction(rawValue, propertySpec) as StylePropertyExpression;
                const compiledExpression = createPropertyExpression(rawExpression, propertySpec);
                if (compiledExpression.result === 'error') {
                    throw new Error(compiledExpression.value.map(err => `${err.key}: ${err.message}`).join(', '));
                }
                return {
                    propertySpec,
                    rawValue,
                    rawExpression,
                    compiledFunction,
                    compiledExpression: compiledExpression.value
                };
            };

            if (layer.paint) {
                for (const key in layer.paint) {
                    if (isFunction((layer.paint as any)[key])) {
                        const paintSpecObj = (spec as any)[`paint_${layer.type}`];
                        if (paintSpecObj && paintSpecObj[key]) {
                            this.data.push(expressionData((layer.paint as any)[key], paintSpecObj[key]));
                        }
                    }
                }
            }

            if (layer.layout) {
                for (const key in layer.layout) {
                    if (isFunction((layer.layout as any)[key])) {
                        const layoutSpecObj = (spec as any)[`layout_${layer.type}`];
                        if (layoutSpecObj && layoutSpecObj[key]) {
                            this.data.push(expressionData((layer.layout as any)[key], layoutSpecObj[key]));
                        }
                    }
                }
            }
        }
    }
}

export class FunctionCreate extends ExpressionBenchmark {
    bench() {
        for (const {rawValue, propertySpec} of this.data) {
            createFunction(rawValue, propertySpec);
        }
    }
}

export class FunctionEvaluate extends ExpressionBenchmark {
    bench() {
        for (const {compiledFunction} of this.data) {
            compiledFunction.evaluate({zoom: 0});
        }
    }
}

export class ExpressionCreate extends ExpressionBenchmark {
    bench() {
        for (const {rawExpression, propertySpec} of this.data) {
            createPropertyExpression(rawExpression, propertySpec);
        }
    }
}

export class ExpressionEvaluate extends ExpressionBenchmark {
    bench() {
        for (const {compiledExpression} of this.data) {
            compiledExpression.evaluate({zoom: 0});
        }
    }
}
