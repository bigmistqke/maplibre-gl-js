import { Texture } from '../render/texture';
export class RenderPool {
    constructor(_context, _size, _tileSize) {
        this._context = _context;
        this._size = _size;
        this._tileSize = _tileSize;
        this._objects = [];
        this._recentlyUsed = [];
        this._stamp = 0;
    }
    destruct() {
        for (const obj of this._objects) {
            obj.texture.destroy();
            obj.fbo.destroy();
        }
    }
    _createObject(id) {
        const fbo = this._context.createFramebuffer(this._tileSize, this._tileSize, true, true);
        const texture = new Texture(this._context, { width: this._tileSize, height: this._tileSize, data: null }, this._context.gl.RGBA);
        texture.bind(this._context.gl.LINEAR, this._context.gl.CLAMP_TO_EDGE);
        if (this._context.extTextureFilterAnisotropic) {
            this._context.gl.texParameterf(this._context.gl.TEXTURE_2D, this._context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this._context.extTextureFilterAnisotropicMax);
        }
        fbo.depthAttachment.set(this._context.createRenderbuffer(this._context.gl.DEPTH_STENCIL, this._tileSize, this._tileSize));
        fbo.colorAttachment.set(texture.texture);
        return { id, fbo, texture, stamp: -1, inUse: false };
    }
    getObjectForId(id) {
        return this._objects[id];
    }
    useObject(obj) {
        obj.inUse = true;
        this._recentlyUsed = this._recentlyUsed.filter(id => obj.id !== id);
        this._recentlyUsed.push(obj.id);
    }
    stampObject(obj) {
        obj.stamp = ++this._stamp;
    }
    getOrCreateFreeObject() {
        for (const id of this._recentlyUsed) {
            if (!this._objects[id].inUse)
                return this._objects[id];
        }
        if (this._objects.length >= this._size)
            throw new Error('No free RenderPool available, call freeAllObjects() required!');
        const obj = this._createObject(this._objects.length);
        this._objects.push(obj);
        return obj;
    }
    freeObject(obj) {
        obj.inUse = false;
    }
    freeAllObjects() {
        for (const obj of this._objects)
            this.freeObject(obj);
    }
    isFull() {
        if (this._objects.length < this._size) {
            return false;
        }
        return this._objects.some(o => !o.inUse) === false;
    }
}
//# sourceMappingURL=render_pool.js.map