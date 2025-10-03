import type { Map } from '../map';
import type { ControlPosition, IControl } from './control';
export type Unit = 'imperial' | 'metric' | 'nautical';
export type ScaleControlOptions = {
    maxWidth?: number;
    unit?: Unit;
};
export declare class ScaleControl implements IControl {
    _map: Map;
    _container: HTMLElement;
    options: ScaleControlOptions;
    constructor(options?: ScaleControlOptions);
    getDefaultPosition(): ControlPosition;
    _onMove: () => void;
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    setUnit: (unit: Unit) => void;
}
//# sourceMappingURL=scale_control.d.ts.map