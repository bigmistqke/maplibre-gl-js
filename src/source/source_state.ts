import {extend} from '../util/util';
import type {Tile} from '../tile/tile';
import type {FeatureState} from '@maplibre/maplibre-gl-style-spec';
import type {InViewTiles} from '../tile/tile_manager_in_view_tiles';

export type FeatureStates = {[featureId: string]: FeatureState};
export type LayerFeatureStates = {[layer: string]: FeatureStates};

// Types for tracking deletions - values can be null to indicate complete deletion
type FeatureDeletionState = {[key: string]: null} | null;
type LayerDeletionState = {[featureId: string]: FeatureDeletionState} | null;
type DeletedStates = {[sourceLayer: string]: LayerDeletionState};

/**
 * @internal
 * SourceFeatureState manages the state and pending changes
 * to features in a source, separated by source layer.
 * stateChanges and deletedStates batch all changes to the tile (updates and removes, respectively)
 * between coalesce() events. addFeatureState() and removeFeatureState() also update their counterpart's
 * list of changes, such that coalesce() can apply the proper state changes while agnostic to the order of operations.
 * In deletedStates, all null's denote complete removal of state at that scope
*/
export class SourceFeatureState {
    state: LayerFeatureStates;
    stateChanges: LayerFeatureStates;
    deletedStates: DeletedStates;
    revision: number;

    constructor() {
        this.state = {};
        this.stateChanges = {};
        this.deletedStates = {};
        this.revision = 0;
    }

    updateState(sourceLayer: string, featureId: number | string | undefined, newState: any) {
        const feature = String(featureId);
        this.stateChanges[sourceLayer] = this.stateChanges[sourceLayer] || {};
        this.stateChanges[sourceLayer][feature] = this.stateChanges[sourceLayer][feature] || {};
        extend(this.stateChanges[sourceLayer][feature], newState);

        if (this.deletedStates[sourceLayer] === null) {
            this.deletedStates[sourceLayer] = {};
            for (const ft in this.state[sourceLayer]) {
                if (ft !== feature) this.deletedStates[sourceLayer][ft] = null;
            }
        } else {
            const featureDeletionQueued = this.deletedStates[sourceLayer] && this.deletedStates[sourceLayer][feature] === null;
            if (featureDeletionQueued) {
                this.deletedStates[sourceLayer][feature] = {};
                for (const prop in this.state[sourceLayer][feature]) {
                    if (!newState[prop]) this.deletedStates[sourceLayer][feature][prop] = null;
                }
            } else {
                for (const key in newState) {
                    const deletionInQueue = this.deletedStates[sourceLayer] && this.deletedStates[sourceLayer][feature] && this.deletedStates[sourceLayer][feature][key] === null;
                    // @ts-expect-error - original code deletes nested property after && null check
                    if (deletionInQueue) delete this.deletedStates[sourceLayer][feature][key];
                }
            }
        }
    }

    removeFeatureState(sourceLayer: string, featureId?: number | string, key?: string) {
        const sourceLayerDeleted = this.deletedStates[sourceLayer] === null;
        if (sourceLayerDeleted) return;

        const feature = String(featureId);

        this.deletedStates[sourceLayer] = this.deletedStates[sourceLayer] || {};

        if (key && featureId !== undefined) {
            if (this.deletedStates[sourceLayer][feature] !== null) {
                this.deletedStates[sourceLayer][feature] = this.deletedStates[sourceLayer][feature] || {};
                this.deletedStates[sourceLayer][feature][key] = null;
            }
        } else if (featureId !== undefined) {
            const updateInQueue = this.stateChanges[sourceLayer] && this.stateChanges[sourceLayer][feature];
            if (updateInQueue) {
                this.deletedStates[sourceLayer][feature] = {};
                for (key in this.stateChanges[sourceLayer][feature]) this.deletedStates[sourceLayer][feature][key] = null;

            } else {
                this.deletedStates[sourceLayer][feature] = null;
            }
        } else {
            this.deletedStates[sourceLayer] = null;
        }

    }

    getState(sourceLayer: string, featureId: number | string | undefined) {
        const feature = String(featureId);
        const base = this.state[sourceLayer] || {};
        const changes = this.stateChanges[sourceLayer] || {};

        const reconciledState = extend({}, base[feature], changes[feature]);

        //return empty object if the whole source layer is awaiting deletion
        if (this.deletedStates[sourceLayer] === null) return {};
        else if (this.deletedStates[sourceLayer]) {
            const featureDeletions = this.deletedStates[sourceLayer][String(featureId)];
            if (featureDeletions === null) return {};
            for (const prop in featureDeletions) delete reconciledState[prop];
        }
        return reconciledState;
    }

    initializeTileState(tile: Tile, painter: any) {
        tile.setFeatureState(this.state, painter);
    }

    coalesceChanges(inViewTiles: InViewTiles, painter: any) {
        //track changes with full state objects, but only for features that got modified
        const featuresChanged: LayerFeatureStates = {};

        for (const sourceLayer in this.stateChanges) {
            this.state[sourceLayer]  = this.state[sourceLayer] || {};
            const layerStates: FeatureStates = {};
            for (const feature in this.stateChanges[sourceLayer]) {
                if (!this.state[sourceLayer][feature]) this.state[sourceLayer][feature] = {};
                extend(this.state[sourceLayer][feature], this.stateChanges[sourceLayer][feature]);
                layerStates[feature] = this.state[sourceLayer][feature];
            }
            featuresChanged[sourceLayer] = layerStates;
        }

        for (const sourceLayer in this.deletedStates) {
            this.state[sourceLayer]  = this.state[sourceLayer] || {};
            const layerStates: FeatureStates = {};

            if (this.deletedStates[sourceLayer] === null) {
                for (const ft in this.state[sourceLayer]) {
                    layerStates[ft] = {};
                    this.state[sourceLayer][ft] = {};
                }
            } else {
                const deletedLayer = this.deletedStates[sourceLayer];
                for (const feature in deletedLayer) {
                    const deleteWholeFeatureState = deletedLayer[feature] === null;
                    if (deleteWholeFeatureState) this.state[sourceLayer][feature] = {};
                    else {
                        const deletedFeature = deletedLayer[feature];
                        if (deletedFeature) {
                            for (const key of Object.keys(deletedFeature)) {
                                delete this.state[sourceLayer][feature][key];
                            }
                        }
                    }
                    layerStates[feature] = this.state[sourceLayer][feature];
                }
            }

            featuresChanged[sourceLayer] = featuresChanged[sourceLayer] || {};
            extend(featuresChanged[sourceLayer], layerStates);
        }

        this.stateChanges = {};
        this.deletedStates = {};

        if (Object.keys(featuresChanged).length === 0) return;

        this.revision++;

        inViewTiles.setFeatureState(featuresChanged, painter);
    }
}
