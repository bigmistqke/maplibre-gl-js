import type { Map } from '../map';
import type { IControl } from './control';
export declare class GlobeControl implements IControl {
    _map: Map;
    _container: HTMLElement;
    _globeButton: HTMLButtonElement;
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    _toggleProjection: () => void;
    _updateGlobeIcon: () => void;
}
//# sourceMappingURL=globe_control.d.ts.map