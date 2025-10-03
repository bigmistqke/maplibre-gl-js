import { NullType } from '@maplibre/maplibre-gl-style-spec';
import { register } from '../util/web_worker_transfer';
export class FormatSectionOverride {
    constructor(defaultValue) {
        if (defaultValue.property.overrides === undefined)
            throw new Error('overrides must be provided to instantiate FormatSectionOverride class');
        this.type = defaultValue.property.overrides ? defaultValue.property.overrides.runtimeType : NullType;
        this.defaultValue = defaultValue;
    }
    evaluate(ctx) {
        if (ctx.formattedSection) {
            const overrides = this.defaultValue.property.overrides;
            if (overrides && overrides.hasOverride(ctx.formattedSection)) {
                return overrides.getOverride(ctx.formattedSection);
            }
        }
        if (ctx.feature && ctx.featureState) {
            return this.defaultValue.evaluate(ctx.feature, ctx.featureState);
        }
        return this.defaultValue.property.specification.default;
    }
    eachChild(fn) {
        if (!this.defaultValue.isConstant()) {
            const expr = this.defaultValue.value;
            fn(expr._styleExpression.expression);
        }
    }
    outputDefined() {
        return false;
    }
    serialize() {
        return null;
    }
}
register('FormatSectionOverride', FormatSectionOverride, { omit: ['defaultValue'] });
//# sourceMappingURL=format_section_override.js.map