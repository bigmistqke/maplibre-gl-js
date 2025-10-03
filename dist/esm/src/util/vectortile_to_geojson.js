export class GeoJSONFeature {
    constructor(vectorTileFeature, z, x, y, id) {
        this.type = 'Feature';
        this._vectorTileFeature = vectorTileFeature;
        vectorTileFeature._z = z;
        vectorTileFeature._x = x;
        vectorTileFeature._y = y;
        this.properties = vectorTileFeature.properties;
        this.id = id;
    }
    get geometry() {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(this._vectorTileFeature._x, this._vectorTileFeature._y, this._vectorTileFeature._z).geometry;
        }
        return this._geometry;
    }
    set geometry(g) {
        this._geometry = g;
    }
    toJSON() {
        const json = {
            geometry: this.geometry
        };
        for (const i in this) {
            if (i === '_geometry' || i === '_vectorTileFeature')
                continue;
            json[i] = (this)[i];
        }
        return json;
    }
}
//# sourceMappingURL=vectortile_to_geojson.js.map