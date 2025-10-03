import type { Expression, EvaluationContext, Type } from '@maplibre/maplibre-gl-style-spec';
import { type PossiblyEvaluatedPropertyValue } from './properties';
export declare class FormatSectionOverride<T> implements Expression {
    type: Type;
    defaultValue: PossiblyEvaluatedPropertyValue<T>;
    constructor(defaultValue: PossiblyEvaluatedPropertyValue<T>);
    evaluate(ctx: EvaluationContext): any;
    eachChild(fn: (_: Expression) => void): void;
    outputDefined(): boolean;
    serialize(): any;
}
//# sourceMappingURL=format_section_override.d.ts.map