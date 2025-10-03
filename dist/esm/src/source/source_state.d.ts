import { type Tile } from './tile';
import type { FeatureState } from '@maplibre/maplibre-gl-style-spec';
export type FeatureStates = {
    [featureId: string]: FeatureState;
};
export type LayerFeatureStates = {
    [layer: string]: FeatureStates;
};
export declare class SourceFeatureState {
    state: LayerFeatureStates;
    stateChanges: LayerFeatureStates;
    deletedStates: {};
    constructor();
    updateState(sourceLayer: string, featureId: number | string, newState: any): void;
    removeFeatureState(sourceLayer: string, featureId?: number | string, key?: string): void;
    getState(sourceLayer: string, featureId: number | string): FeatureState;
    initializeTileState(tile: Tile, painter: any): void;
    coalesceChanges(tiles: {
        [_ in any]: Tile;
    }, painter: any): void;
}
//# sourceMappingURL=source_state.d.ts.map