var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { FeatureIndex } from '../data/feature_index';
import { CollisionBoxArray } from '../data/array_types.g';
import { DictionaryCoder } from '../util/dictionary_coder';
import { LineBucket } from '../data/bucket/line_bucket';
import { FillBucket } from '../data/bucket/fill_bucket';
import { FillExtrusionBucket } from '../data/bucket/fill_extrusion_bucket';
import { warnOnce, mapObject } from '../util/util';
import { ImageAtlas } from '../render/image_atlas';
import { GlyphAtlas } from '../render/glyph_atlas';
import { EvaluationParameters } from '../style/evaluation_parameters';
import { OverscaledTileID } from './tile_id';
import { registry } from '../registry';
export class WorkerTile {
    constructor(params) {
        this.tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        this.uid = params.uid;
        this.zoom = params.zoom;
        this.pixelRatio = params.pixelRatio;
        this.tileSize = params.tileSize;
        this.source = params.source;
        this.overscaling = this.tileID.overscaleFactor();
        this.showCollisionBoxes = params.showCollisionBoxes;
        this.collectResourceTiming = !!params.collectResourceTiming;
        this.returnDependencies = !!params.returnDependencies;
        this.promoteId = params.promoteId;
        this.inFlightDependencies = [];
    }
    parse(data, layerIndex, availableImages, actor, subdivisionGranularity) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            this.status = 'parsing';
            this.data = data;
            this.collisionBoxArray = new CollisionBoxArray();
            const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());
            const featureIndex = new FeatureIndex(this.tileID, this.promoteId);
            featureIndex.bucketLayerIDs = [];
            const buckets = {};
            const options = {
                featureIndex,
                iconDependencies: {},
                patternDependencies: {},
                glyphDependencies: {},
                availableImages,
                subdivisionGranularity
            };
            const layerFamilies = layerIndex.familiesBySource[this.source];
            for (const sourceLayerId in layerFamilies) {
                const sourceLayer = data.layers[sourceLayerId];
                if (!sourceLayer) {
                    continue;
                }
                if (sourceLayer.version === 1) {
                    warnOnce(`Vector tile source "${this.source}" layer "${sourceLayerId}" ` +
                        'does not use vector tile spec v2 and therefore may have some rendering errors.');
                }
                const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
                const features = [];
                for (let index = 0; index < sourceLayer.length; index++) {
                    const feature = sourceLayer.feature(index);
                    const id = featureIndex.getId(feature, sourceLayerId);
                    features.push({ feature, id, index, sourceLayerIndex });
                }
                for (const family of layerFamilies[sourceLayerId]) {
                    const layer = family[0];
                    if (layer.source !== this.source) {
                        warnOnce(`layer.source = ${layer.source} does not equal this.source = ${this.source}`);
                    }
                    if (layer.minzoom && this.zoom < Math.floor(layer.minzoom))
                        continue;
                    if (layer.maxzoom && this.zoom >= layer.maxzoom)
                        continue;
                    if (layer.visibility === 'none')
                        continue;
                    recalculateLayers(family, this.zoom, availableImages);
                    const bucket = buckets[layer.id] = layer.createBucket({
                        index: featureIndex.bucketLayerIDs.length,
                        layers: family,
                        zoom: this.zoom,
                        pixelRatio: this.pixelRatio,
                        overscaling: this.overscaling,
                        collisionBoxArray: this.collisionBoxArray,
                        sourceLayerIndex,
                        sourceID: this.source
                    });
                    bucket.populate(features, options, this.tileID.canonical);
                    featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
                }
            }
            const stacks = mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
            this.inFlightDependencies.forEach((request) => request === null || request === void 0 ? void 0 : request.abort());
            this.inFlightDependencies = [];
            let getGlyphsPromise = Promise.resolve({});
            if (Object.keys(stacks).length) {
                const abortController = new AbortController();
                this.inFlightDependencies.push(abortController);
                getGlyphsPromise = actor.sendAsync({ type: "GG", data: { stacks, source: this.source, tileID: this.tileID, type: 'glyphs' } }, abortController);
            }
            const icons = Object.keys(options.iconDependencies);
            let getIconsPromise = Promise.resolve({});
            if (icons.length) {
                const abortController = new AbortController();
                this.inFlightDependencies.push(abortController);
                getIconsPromise = actor.sendAsync({ type: "GI", data: { icons, source: this.source, tileID: this.tileID, type: 'icons' } }, abortController);
            }
            const patterns = Object.keys(options.patternDependencies);
            let getPatternsPromise = Promise.resolve({});
            if (patterns.length) {
                const abortController = new AbortController();
                this.inFlightDependencies.push(abortController);
                getPatternsPromise = actor.sendAsync({ type: "GI", data: { icons: patterns, source: this.source, tileID: this.tileID, type: 'patterns' } }, abortController);
            }
            const [glyphMap, iconMap, patternMap] = yield Promise.all([getGlyphsPromise, getIconsPromise, getPatternsPromise]);
            const glyphAtlas = new GlyphAtlas(glyphMap);
            const imageAtlas = new ImageAtlas(iconMap, patternMap);
            for (const key in buckets) {
                const bucket = buckets[key];
                if (registry.symbol.SymbolBucket && bucket instanceof registry.symbol.SymbolBucket) {
                    recalculateLayers(bucket.layers, this.zoom, availableImages);
                    (_b = (_a = registry.symbol).performSymbolLayout) === null || _b === void 0 ? void 0 : _b.call(_a, {
                        bucket,
                        glyphMap,
                        glyphPositions: glyphAtlas.positions,
                        imageMap: iconMap,
                        imagePositions: imageAtlas.iconPositions,
                        showCollisionBoxes: this.showCollisionBoxes,
                        canonical: this.tileID.canonical,
                        subdivisionGranularity: options.subdivisionGranularity
                    });
                }
                else if (bucket.hasPattern &&
                    (bucket instanceof LineBucket ||
                        bucket instanceof FillBucket ||
                        bucket instanceof FillExtrusionBucket)) {
                    recalculateLayers(bucket.layers, this.zoom, availableImages);
                    bucket.addFeatures(options, this.tileID.canonical, imageAtlas.patternPositions);
                }
            }
            this.status = 'done';
            return {
                buckets: Object.values(buckets).filter(b => !b.isEmpty()),
                featureIndex,
                collisionBoxArray: this.collisionBoxArray,
                glyphAtlasImage: glyphAtlas.image,
                imageAtlas,
                glyphMap: this.returnDependencies ? glyphMap : null,
                iconMap: this.returnDependencies ? iconMap : null,
                glyphPositions: this.returnDependencies ? glyphAtlas.positions : null
            };
        });
    }
}
function recalculateLayers(layers, zoom, availableImages) {
    const parameters = new EvaluationParameters(zoom);
    for (const layer of layers) {
        layer.recalculate(parameters, availableImages);
    }
}
//# sourceMappingURL=worker_tile.js.map