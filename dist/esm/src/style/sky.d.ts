import { DataConstantProperty, type PossiblyEvaluated, Transitionable, type Transitioning, type TransitionParameters } from './properties';
import { Evented } from '../util/evented';
import { EvaluationParameters } from './evaluation_parameters';
import { type Color } from '@maplibre/maplibre-gl-style-spec';
import { type Mesh } from '../render/mesh';
import type { SkySpecification } from '@maplibre/maplibre-gl-style-spec';
import type { StyleSetterOptions } from './style';
type SkyProps = {
    'sky-color': DataConstantProperty<Color>;
    'horizon-color': DataConstantProperty<Color>;
    'fog-color': DataConstantProperty<Color>;
    'fog-ground-blend': DataConstantProperty<number>;
    'horizon-fog-blend': DataConstantProperty<number>;
    'sky-horizon-blend': DataConstantProperty<number>;
    'atmosphere-blend': DataConstantProperty<number>;
};
type SkyPropsPossiblyEvaluated = {
    'sky-color': Color;
    'horizon-color': Color;
    'fog-color': Color;
    'fog-ground-blend': number;
    'horizon-fog-blend': number;
    'sky-horizon-blend': number;
    'atmosphere-blend': number;
};
export declare class Sky extends Evented {
    properties: PossiblyEvaluated<SkyProps, SkyPropsPossiblyEvaluated>;
    mesh: Mesh | undefined;
    atmosphereMesh: Mesh | undefined;
    _transitionable: Transitionable<SkyProps>;
    _transitioning: Transitioning<SkyProps>;
    constructor(sky?: SkySpecification);
    setSky(sky?: SkySpecification, options?: StyleSetterOptions): void;
    getSky(): SkySpecification;
    updateTransitions(parameters: TransitionParameters): void;
    hasTransition(): boolean;
    recalculate(parameters: EvaluationParameters): void;
    _validate(validate: Function, value: unknown, options?: StyleSetterOptions): boolean;
    calculateFogBlendOpacity(pitch: number): number;
}
export {};
//# sourceMappingURL=sky.d.ts.map