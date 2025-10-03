import type { Map } from '../map';
import type { ControlPosition, IControl } from './control';
import type { MapDataEvent } from '../events';
export type AttributionControlOptions = {
    compact?: boolean;
    customAttribution?: string | Array<string>;
};
export declare const defaultAttributionControlOptions: AttributionControlOptions;
export declare class AttributionControl implements IControl {
    options: AttributionControlOptions;
    _map: Map;
    _compact: boolean | undefined;
    _container: HTMLElement;
    _innerContainer: HTMLElement;
    _compactButton: HTMLElement;
    _editLink: HTMLAnchorElement;
    _attribHTML: string;
    styleId: string;
    styleOwner: string;
    constructor(options?: AttributionControlOptions);
    getDefaultPosition(): ControlPosition;
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    _setElementTitle(element: HTMLElement, title: 'ToggleAttribution' | 'MapFeedback'): void;
    _toggleAttribution: () => void;
    _updateData: (e: MapDataEvent) => void;
    _updateAttributions(): void;
    _updateCompact: () => void;
    _updateCompactMinimize: () => void;
}
//# sourceMappingURL=attribution_control.d.ts.map