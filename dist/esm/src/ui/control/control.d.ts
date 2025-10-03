import type { Map } from '../map';
export type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface IControl {
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
    readonly getDefaultPosition?: () => ControlPosition;
}
//# sourceMappingURL=control.d.ts.map