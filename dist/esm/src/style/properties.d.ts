import { type Color, type StylePropertySpecification, type Feature, type FeatureState, type StylePropertyExpression, type SourceExpression, type CompositeExpression, type TransitionSpecification, type PropertyValueSpecification } from '@maplibre/maplibre-gl-style-spec';
import { EvaluationParameters } from './evaluation_parameters';
import { type CanonicalTileID } from '../source/tile_id';
type TimePoint = number;
export type CrossFaded<T> = {
    to: T;
    from: T;
};
export interface Property<T, R> {
    specification: StylePropertySpecification;
    possiblyEvaluate(value: PropertyValue<T, R>, parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): R;
    interpolate(a: R, b: R, t: number): R;
}
export declare class PropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValueSpecification<T> | void;
    expression: StylePropertyExpression;
    constructor(property: Property<T, R>, value: PropertyValueSpecification<T> | void, globalState: Record<string, any>);
    isDataDriven(): boolean;
    getGlobalStateRefs(): Set<string>;
    possiblyEvaluate(parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): R;
}
export type TransitionParameters = {
    now: TimePoint;
    transition: TransitionSpecification;
};
declare class TransitionablePropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    transition: TransitionSpecification | void;
    constructor(property: Property<T, R>, globalState: Record<string, any>);
    transitioned(parameters: TransitionParameters, prior: TransitioningPropertyValue<T, R>): TransitioningPropertyValue<T, R>;
    untransitioned(): TransitioningPropertyValue<T, R>;
}
export declare class Transitionable<Props> {
    _properties: Properties<Props>;
    _values: {
        [K in keyof Props]: TransitionablePropertyValue<any, unknown>;
    };
    private _globalState;
    constructor(properties: Properties<Props>, globalState: Record<string, any>);
    getValue<S extends keyof Props, T>(name: S): PropertyValueSpecification<T> | void;
    setValue<S extends keyof Props, T>(name: S, value: PropertyValueSpecification<T> | void): void;
    getTransition<S extends keyof Props>(name: S): TransitionSpecification | void;
    setTransition<S extends keyof Props>(name: S, value: TransitionSpecification | void): void;
    serialize(): any;
    transitioned(parameters: TransitionParameters, prior: Transitioning<Props>): Transitioning<Props>;
    untransitioned(): Transitioning<Props>;
}
declare class TransitioningPropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    prior: TransitioningPropertyValue<T, R>;
    begin: TimePoint;
    end: TimePoint;
    constructor(property: Property<T, R>, value: PropertyValue<T, R>, prior: TransitioningPropertyValue<T, R>, transition: TransitionSpecification, now: TimePoint);
    possiblyEvaluate(parameters: EvaluationParameters, canonical: CanonicalTileID, availableImages: Array<string>): R;
}
export declare class Transitioning<Props> {
    _properties: Properties<Props>;
    _values: {
        [K in keyof Props]: PossiblyEvaluatedPropertyValue<unknown>;
    };
    constructor(properties: Properties<Props>);
    possiblyEvaluate(parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): PossiblyEvaluated<Props, any>;
    hasTransition(): boolean;
}
export declare class Layout<Props> {
    _properties: Properties<Props>;
    _values: {
        [K in keyof Props]: PropertyValue<any, PossiblyEvaluatedPropertyValue<any>>;
    };
    private _globalState;
    constructor(properties: Properties<Props>, globalState: Record<string, any>);
    hasValue<S extends keyof Props>(name: S): boolean;
    getValue<S extends keyof Props>(name: S): any;
    setValue<S extends keyof Props>(name: S, value: any): void;
    serialize(): any;
    possiblyEvaluate(parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): PossiblyEvaluated<Props, any>;
}
type PossiblyEvaluatedValue<T> = {
    kind: 'constant';
    value: T;
} | SourceExpression | CompositeExpression;
export declare class PossiblyEvaluatedPropertyValue<T> {
    property: DataDrivenProperty<T>;
    value: PossiblyEvaluatedValue<T>;
    parameters: EvaluationParameters;
    constructor(property: DataDrivenProperty<T>, value: PossiblyEvaluatedValue<T>, parameters: EvaluationParameters);
    isConstant(): boolean;
    constantOr(value: T): T;
    evaluate(feature: Feature, featureState: FeatureState, canonical?: CanonicalTileID, availableImages?: Array<string>): T;
}
export declare class PossiblyEvaluated<Props, PossibleEvaluatedProps> {
    _properties: Properties<Props>;
    _values: PossibleEvaluatedProps;
    constructor(properties: Properties<Props>);
    get<S extends keyof PossibleEvaluatedProps>(name: S): PossibleEvaluatedProps[S];
}
export declare class DataConstantProperty<T> implements Property<T, T> {
    specification: StylePropertySpecification;
    constructor(specification: StylePropertySpecification);
    possiblyEvaluate(value: PropertyValue<T, T>, parameters: EvaluationParameters): T;
    interpolate(a: T, b: T, t: number): T;
}
export declare class DataDrivenProperty<T> implements Property<T, PossiblyEvaluatedPropertyValue<T>> {
    specification: StylePropertySpecification;
    overrides: any;
    constructor(specification: StylePropertySpecification, overrides?: any);
    possiblyEvaluate(value: PropertyValue<T, PossiblyEvaluatedPropertyValue<T>>, parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): PossiblyEvaluatedPropertyValue<T>;
    interpolate(a: PossiblyEvaluatedPropertyValue<T>, b: PossiblyEvaluatedPropertyValue<T>, t: number): PossiblyEvaluatedPropertyValue<T>;
    evaluate(value: PossiblyEvaluatedValue<T>, parameters: EvaluationParameters, feature: Feature, featureState: FeatureState, canonical?: CanonicalTileID, availableImages?: Array<string>): T;
}
export declare class CrossFadedDataDrivenProperty<T> extends DataDrivenProperty<CrossFaded<T>> {
    possiblyEvaluate(value: PropertyValue<CrossFaded<T>, PossiblyEvaluatedPropertyValue<CrossFaded<T>>>, parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): PossiblyEvaluatedPropertyValue<CrossFaded<T>>;
    evaluate(value: PossiblyEvaluatedValue<CrossFaded<T>>, globals: EvaluationParameters, feature: Feature, featureState: FeatureState, canonical?: CanonicalTileID, availableImages?: Array<string>): CrossFaded<T>;
    _calculate(min: T, mid: T, max: T, parameters: EvaluationParameters): CrossFaded<T>;
    interpolate(a: PossiblyEvaluatedPropertyValue<CrossFaded<T>>): PossiblyEvaluatedPropertyValue<CrossFaded<T>>;
}
export declare class CrossFadedProperty<T> implements Property<T, CrossFaded<T>> {
    specification: StylePropertySpecification;
    constructor(specification: StylePropertySpecification);
    possiblyEvaluate(value: PropertyValue<T, CrossFaded<T>>, parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): CrossFaded<T>;
    _calculate(min: T, mid: T, max: T, parameters: EvaluationParameters): CrossFaded<T>;
    interpolate(a?: CrossFaded<T> | null): CrossFaded<T>;
}
export declare class ColorRampProperty implements Property<Color, boolean> {
    specification: StylePropertySpecification;
    constructor(specification: StylePropertySpecification);
    possiblyEvaluate(value: PropertyValue<Color, boolean>, parameters: EvaluationParameters, canonical?: CanonicalTileID, availableImages?: Array<string>): boolean;
    interpolate(): boolean;
}
export declare class Properties<Props> {
    properties: Props;
    defaultPropertyValues: {
        [K in keyof Props]: PropertyValue<unknown, any>;
    };
    defaultTransitionablePropertyValues: {
        [K in keyof Props]: TransitionablePropertyValue<unknown, unknown>;
    };
    defaultTransitioningPropertyValues: {
        [K in keyof Props]: TransitioningPropertyValue<unknown, unknown>;
    };
    defaultPossiblyEvaluatedValues: {
        [K in keyof Props]: PossiblyEvaluatedPropertyValue<unknown>;
    };
    overridableProperties: Array<string>;
    constructor(properties: Props);
}
export {};
//# sourceMappingURL=properties.d.ts.map