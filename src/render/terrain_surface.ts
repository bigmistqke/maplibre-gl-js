import {mat4} from 'gl-matrix';
import {drawDepth, drawCoords} from './draw_terrain';
import {Terrain} from './terrain';
import {RenderToTexture} from './render_to_texture';
import type {Surface} from '../core/surface';
import type {ShaderExtension} from '../core/shader_extension';
import type {TerrainData} from './terrain';
import type {Painter} from './painter';
import type {LngLat} from '../geo/lng_lat';
import type {MercatorCoordinate} from '../geo/mercator_coordinate';
import type {OverscaledTileID} from '../tile/tile_id';
import type {IReadonlyTransform, ITransform} from '../geo/transform_interface';
import type {Style} from '../style/style';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import Point from '@mapbox/point-geometry';

const TERRAIN_SHADER_EXTENSION: ShaderExtension = {
    key: 'terrain',
    defines: ['#define TERRAIN3D;'],
};

/**
 * Surface implementation backed by a 3D terrain DEM mesh.
 * Wraps the existing {@link Terrain} class, delegating all calls.
 */
export class TerrainSurface implements Surface {
    readonly shaderExtensions: readonly ShaderExtension[] = [TERRAIN_SHADER_EXTENSION];
    tileKey(tileID: {x: number; y: number; z: number}): string { return `${tileID.z}_${tileID.x}_${tileID.y}_t`; }
    renderToTexture: RenderToTexture | null = null;
    private _terrain: Terrain;
    private _transform: IReadonlyTransform;
    private _facilitator = {dirty: true, matrix: mat4.identity(new Float64Array(16) as any), renderTime: 0};
    private _style: Style | null = null;
    private _dataCallback: ((e: any) => void) | null = null;

    /**
     * Create a fully-wired TerrainSurface: constructs Terrain, RTT,
     * subscribes to style data events for cache invalidation and elevation updates.
     */
    /**
     * Create a fully-wired TerrainSurface: constructs Terrain, RTT,
     * subscribes to style data events for cache invalidation and elevation updates.
     * @param getUpdateContext - called when source data arrives to get the current transform and centerClampedToGround
     */
    static create(
        painter: Painter,
        style: Style,
        options: TerrainSpecification,
        getUpdateContext: () => {transform: ITransform; centerClampedToGround: boolean},
    ): TerrainSurface {
        const tileManager = style.tileManagers[options.source];
        if (!tileManager) throw new Error(`cannot load terrain, because there exists no source with ID: ${options.source}`);

        const terrain = new Terrain(painter, tileManager, options);
        const surface = new TerrainSurface(terrain);
        surface.renderToTexture = new RenderToTexture(painter, terrain);
        surface._style = style;

        const {transform, centerClampedToGround} = getUpdateContext();
        surface.update(transform, centerClampedToGround);

        surface._dataCallback = e => {
            if (e.dataType === 'style') {
                terrain.tileManager.freeRtt();
            } else if (e.dataType === 'source' && e.tile) {
                if (e.sourceId === options.source) {
                    const ctx = getUpdateContext();
                    surface.update(ctx.transform, ctx.centerClampedToGround);
                }
                if (e.source?.type === 'image') {
                    terrain.tileManager.freeRtt();
                } else {
                    terrain.tileManager.freeRtt(e.tile.tileID);
                }
            }
        };
        style.on('data', surface._dataCallback);

        return surface;
    }

    constructor(terrain: Terrain) {
        this._terrain = terrain;
    }

    get terrain(): Terrain { return this._terrain; }
    get options(): TerrainSpecification { return this._terrain.options; }
    get isRenderingToTexture(): boolean { return this.renderToTexture != null; }

    destroy(): void {
        if (this._dataCallback && this._style) {
            this._style.off('data', this._dataCallback);
            this._dataCallback = null;
        }
        this._terrain.tileManager.destruct();
        this.renderToTexture?.destruct();
    }

    markDirty(): void { this._facilitator.dirty = true; }

    update(transform: ITransform, centerClampedToGround: boolean): void {
        this._transform = transform;
        this._terrain.tileManager.update(transform, this._terrain);
        transform.setMinElevationForCurrentTile(this._terrain.getMinTileElevationForLngLatZoom(transform.center, transform.tileZoom));
        if (!this._elevationFrozen && centerClampedToGround) {
            transform.setElevation(this._terrain.getElevationForLngLatZoom(transform.center, transform.tileZoom));
        }
    }

    getElevation(lnglat: LngLat): number {
        return this._terrain.getElevationForLngLat(lnglat, this._transform);
    }

    getElevationForZoom(lnglat: LngLat, zoom: number): number {
        return this._terrain.getElevationForLngLatZoom(lnglat, zoom);
    }

    getMinElevationForZoom(lnglat: LngLat, zoom: number): number {
        return this._terrain.getMinTileElevationForLngLatZoom(lnglat, zoom);
    }

    getElevationForTile(tileID: OverscaledTileID, x: number, y: number, extent?: number): number {
        return this._terrain.getElevation(tileID, x, y, extent);
    }

    getElevationCallback(tileID: OverscaledTileID): ((x: number, y: number) => number) | null {
        return (x: number, y: number) => this._terrain.getElevation(tileID, x, y);
    }

    getMinMaxElevation(tileID: OverscaledTileID): {min: number; max: number} {
        const result = this._terrain.getMinMaxElevation(tileID);
        return {min: result.minElevation ?? 0, max: result.maxElevation ?? 0};
    }

    screenToCoordinate(point: Point): MercatorCoordinate | null {
        return this._terrain.pointCoordinate(point);
    }

    depthAtPoint(point: Point): number {
        return this._terrain.depthAtPoint(point);
    }

    isOccluded(screenPos: Point, lngLat: LngLat, offset: Point, transform: IReadonlyTransform): {base: boolean; center: boolean} {
        const forgiveness = .006;
        const elevation = this.getElevation(lngLat);
        const terrainDistance = this.depthAtPoint(screenPos);
        const markerDistance = transform.lngLatToCameraDepth(lngLat, elevation);
        const baseOccluded = markerDistance - terrainDistance >= forgiveness;
        if (!baseOccluded) return {base: false, center: false};

        const metersToCenter = -offset.y / transform.pixelsPerMeter;
        const elevationToCenter = Math.sin(transform.pitch * Math.PI / 180) * metersToCenter;
        const terrainDistanceCenter = this.depthAtPoint(new Point(screenPos.x, screenPos.y - offset.y));
        const markerDistanceCenter = transform.lngLatToCameraDepth(lngLat, elevation + elevationToCenter);
        const centerOccluded = markerDistanceCenter - terrainDistanceCenter >= forgiveness;
        return {base: true, center: centerOccluded};
    }

    isPointOnSurface(point: Point): boolean {
        return this._terrain.pointCoordinate(point) != null;
    }

    getBindings(tileID: OverscaledTileID): TerrainData | null {
        return this._terrain.getTerrainData(tileID);
    }

    renderFrame(painter: Painter): void {
        this._updateDepthAndCoords(painter, false);

        const style = painter.style;
        const layerIds = style._order;
        const tileManagers = style.tileManagers;
        const renderOptions = painter._renderOptions;

        if (this.renderToTexture) {
            this.renderToTexture.prepareForRender(style, painter.transform.zoom);

            // Offscreen pass — only for layers RTT doesn't handle (e.g. custom)
            painter.renderPass = 'offscreen';
            for (const layerId of layerIds) {
                const layer = style._layers[layerId];
                if (!layer.hasOffscreenPass() || layer.isHidden(painter.transform.zoom)) continue;
                if (this.renderToTexture.handlesLayer(layer.type)) continue;

                const coords = painter._coordsDescending[layer.source];
                if (layer.type !== 'custom' && !coords.length) continue;

                painter.renderLayer(painter, tileManagers[layer.source], layer, coords, renderOptions, 'offscreen');
            }

            painter._prepareMainFramebuffer();

            // No opaque pass — RTT renders all layers bottom-to-top in translucent
            painter.renderPass = 'translucent';
            painter.opaquePassCutoff = 0;

            for (painter.currentLayer = 0; painter.currentLayer < layerIds.length; painter.currentLayer++) {
                const layer = style._layers[layerIds[painter.currentLayer]];

                // RTT intercepts layers it handles (fill, line, raster, heatmap, etc.)
                if (this.renderToTexture.renderLayer(layer, renderOptions)) continue;

                // Non-RTT layers (symbols, custom) render directly
                const coords = (layer.type === 'symbol' ? painter._coordsDescendingSymbol : painter._coordsDescending)[layer.source];
                painter._renderTileClippingMasks(layer, painter._coordsAscending[layer.source], true);
                painter.renderLayer(painter, tileManagers[layer.source], layer, coords, renderOptions, 'translucent');
            }

            painter._finalizeMainPass();
        } else {
            // No RTT — use default flat passes
            painter._renderPasses();
        }
    }

    allowVariableZoom(): boolean { return true; }

    private _elevationFrozen = false;
    get isElevationFrozen(): boolean { return this._elevationFrozen; }
    freezeElevation(): void { this._elevationFrozen = true; }
    unfreezeElevation(): void { this._elevationFrozen = false; }

    ensureFrameBuffers(painter: Painter): void {
        this._updateDepthAndCoords(painter, true);
    }

    private _updateDepthAndCoords(painter: Painter, requireExact: boolean): void {
        const prevMatrix = this._facilitator.matrix;
        const currMatrix = painter.transform.modelViewProjectionMatrix;

        let doUpdate = this._facilitator.dirty;
        doUpdate ||= requireExact ? !mat4.exactEquals(prevMatrix, currMatrix) : !mat4.equals(prevMatrix, currMatrix);
        doUpdate ||= this._terrain.tileManager.anyTilesAfterTime(this._facilitator.renderTime);

        if (!doUpdate) {
            return;
        }

        mat4.copy(prevMatrix, currMatrix);
        this._facilitator.renderTime = Date.now();
        this._facilitator.dirty = false;
        drawDepth(painter, this._terrain);
        drawCoords(painter, this._terrain);
    }
}
