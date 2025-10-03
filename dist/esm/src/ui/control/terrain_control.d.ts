import type { Map } from '../map';
import type { IControl } from './control';
import type { TerrainSpecification } from '@maplibre/maplibre-gl-style-spec';
export declare class TerrainControl implements IControl {
    options: TerrainSpecification;
    _map: Map;
    _container: HTMLElement;
    _terrainButton: HTMLButtonElement;
    constructor(options: TerrainSpecification);
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    _toggleTerrain: () => void;
    _updateTerrainIcon: () => void;
}
//# sourceMappingURL=terrain_control.d.ts.map