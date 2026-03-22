// src/modular/layers/symbol/glyph-manager.ts
import {loadGlyphRange, glyphRange} from '@modular/layers/symbol/glyph-loader.ts';
import {GlyphAtlas} from '@modular/layers/symbol/glyph-atlas.ts';
import type {GlyphMap, GlyphPositions, StyleGlyph} from '@modular/layers/symbol/types.ts';
import {createDebug} from '@modular/debug.ts';

const debug = createDebug('GlyphManager', false);

export class GlyphManager {
    private _url: string;
    /** Loaded glyphs per fontstack, keyed by codepoint */
    private _glyphs: { [stack: string]: { [id: number]: StyleGlyph | null } } = {};
    /** Ranges already loaded (or in-flight) per fontstack, keyed by range start */
    private _loadedRanges: { [stack: string]: { [range: number]: boolean | Promise<void> } } = {};

    /** Atlas is rebuilt whenever new ranges arrive */
    private _atlas: GlyphAtlas | null = null;
    /** Dirty flag: set when new glyphs loaded, cleared after buildAtlas() */
    private _atlasDirty = false;
    /** WebGL texture holding the current atlas */
    glyphAtlasTexture: WebGLTexture | null = null;
    /** Atlas positions for the current built atlas */
    glyphPositions: GlyphPositions = {};
    /** Incremented each time the atlas is rebuilt — used by TextLayer to detect stale UV buffers */
    _atlasVersion = 0;

    private _glyphsLoadedListeners: Array<(map: GlyphMap, positions: GlyphPositions) => void> = [];

    addGlyphsLoadedListener(cb: (map: GlyphMap, positions: GlyphPositions) => void): void {
        this._glyphsLoadedListeners.push(cb);
    }

    removeGlyphsLoadedListener(cb: (map: GlyphMap, positions: GlyphPositions) => void): void {
        const idx = this._glyphsLoadedListeners.indexOf(cb);
        if (idx !== -1) this._glyphsLoadedListeners.splice(idx, 1);
    }

    get atlas(): GlyphAtlas | null { return this._atlas; }

    constructor(options: { url: string }) {
        this._url = options.url;
    }

    /**
   * Ensure all listed codepoints are loaded for each fontstack.
   * Returns the full GlyphMap (including already-cached glyphs).
   * Resolves once all needed ranges have been fetched.
   */
    async getGlyphs(neededGlyphs: { [stack: string]: number[] }): Promise<GlyphMap> {
        const promises: Promise<void>[] = [];

        for (const stack in neededGlyphs) {
            if (!this._glyphs[stack]) this._glyphs[stack] = {};
            if (!this._loadedRanges[stack]) this._loadedRanges[stack] = {};

            const ids = neededGlyphs[stack];
            const neededRanges = new Set(ids.map(glyphRange));

            for (const range of neededRanges) {
                if (this._loadedRanges[stack][range]) continue;  // already loaded or in-flight

                const p = this._loadRange(stack, range);
                this._loadedRanges[stack][range] = p;
                promises.push(p);
            }
        }

        await Promise.all(promises);

        // Build result map from cache
        const result: GlyphMap = {};
        for (const stack in neededGlyphs) {
            result[stack] = {};
            for (const id of neededGlyphs[stack]) {
                result[stack][id] = this._glyphs[stack][id] ?? null;
            }
        }
        return result;
    }

    private async _loadRange(stack: string, range: number): Promise<void> {
        let rangeGlyphs!: { [id: number]: StyleGlyph | null };
        try {
            rangeGlyphs = await loadGlyphRange(stack, range, this._url);
        } catch (e) {
            // Clear the failed entry so the range can be retried
            delete this._loadedRanges[stack][range];
            throw e;
        }
        Object.assign(this._glyphs[stack], rangeGlyphs);
        this._atlasDirty = true;
        this._atlasVersion++;

        // Rebuild atlas positions (CPU-only — no gl needed) so callback receives fresh positions.
        // Leave _atlasDirty = true so buildAtlas() knows the GPU texture needs re-uploading.
        this._atlas = new GlyphAtlas(this._glyphs as GlyphMap);
        this.glyphPositions = this._atlas.positions;

        debug('range loaded, atlas rebuilt', {stack, range, version: this._atlasVersion, glyphs: Object.keys(rangeGlyphs).length});

        // Notify listeners (TextLayer → worker) with BOTH the partial glyph map and
        // the freshly computed atlas positions so the worker can set UV attributes.
        const partial: GlyphMap = {[stack]: rangeGlyphs};
        for (const cb of this._glyphsLoadedListeners) cb(partial, this.glyphPositions);
    }

    /**
   * (Re)build the glyph atlas from all loaded glyphs and upload to GPU.
   * Call this once per frame from TextLayer.draw() before binding the texture.
   * No-op if nothing changed since last call.
   */
    buildAtlas(gl: WebGLRenderingContext): void {
        if (!this._atlasDirty && this._atlas !== null) return;
        this._atlasDirty = false;
        debug('buildAtlas: uploading to GPU', {version: this._atlasVersion});

        // If _atlas is already current (rebuilt CPU-side in _loadRange), reuse it.
        // Otherwise rebuild from scratch (e.g. first call with no ranges loaded yet).
        if (!this._atlas) {
            this._atlas = new GlyphAtlas(this._glyphs as GlyphMap);
            this.glyphPositions = this._atlas.positions;
        }

        if (!this.glyphAtlasTexture) {
            this.glyphAtlasTexture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.glyphAtlasTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        // Expand single-channel SDF data to RGBA (4 bytes per pixel, value in all channels)
        const src = this._atlas.image.data;
        const rgba = new Uint8Array(src.length * 4);
        for (let i = 0; i < src.length; i++) {
            rgba[i * 4 + 0] = src[i];
            rgba[i * 4 + 1] = src[i];
            rgba[i * 4 + 2] = src[i];
            rgba[i * 4 + 3] = 255;
        }
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA,
            this._atlas.image.width, this._atlas.image.height,
            0, gl.RGBA, gl.UNSIGNED_BYTE,
            rgba,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    destroy(): void {
        this._glyphs = {};
        this._loadedRanges = {};
        this._atlas = null;
        this._atlasDirty = false;
        // Caller responsible for deleting glyphAtlasTexture from WebGL context
        this.glyphAtlasTexture = null;
        this._glyphsLoadedListeners.length = 0;
    }
}
