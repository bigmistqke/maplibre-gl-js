import type { Map } from '../map';
import type { ControlPosition, IControl } from './control';
export type LogoControlOptions = {
    compact?: boolean;
};
export declare class LogoControl implements IControl {
    options: LogoControlOptions;
    _map: Map;
    _compact: boolean;
    _container: HTMLElement;
    constructor(options?: LogoControlOptions);
    getDefaultPosition(): ControlPosition;
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    _updateCompact: () => void;
}
//# sourceMappingURL=logo_control.d.ts.map