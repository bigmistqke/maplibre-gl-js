const cache = new WeakMap();
export function isWebGL2(gl) {
    var _a;
    if (cache.has(gl)) {
        return cache.get(gl);
    }
    else {
        const value = (_a = gl.getParameter(gl.VERSION)) === null || _a === void 0 ? void 0 : _a.startsWith('WebGL 2.0');
        cache.set(gl, value);
        return value;
    }
}
//# sourceMappingURL=webgl2.js.map