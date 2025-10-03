export const webpSupported = {
    supported: false,
    testSupport
};
let glForTesting;
let webpCheckComplete = false;
let webpImgTest;
let webpImgTestOnloadComplete = false;
if (typeof document !== 'undefined') {
    webpImgTest = document.createElement('img');
    webpImgTest.onload = () => {
        if (glForTesting)
            testWebpTextureUpload(glForTesting);
        glForTesting = null;
        webpImgTestOnloadComplete = true;
    };
    webpImgTest.onerror = () => {
        webpCheckComplete = true;
        glForTesting = null;
    };
    webpImgTest.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=';
}
function testSupport(gl) {
    if (webpCheckComplete || !webpImgTest)
        return;
    if (webpImgTestOnloadComplete) {
        testWebpTextureUpload(gl);
    }
    else {
        glForTesting = gl;
    }
}
function testWebpTextureUpload(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webpImgTest);
        if (gl.isContextLost())
            return;
        webpSupported.supported = true;
    }
    catch (_a) {
    }
    gl.deleteTexture(texture);
    webpCheckComplete = true;
}
//# sourceMappingURL=webp_supported.js.map