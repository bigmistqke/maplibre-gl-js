// src/mini/layers/terrain/terrain-shaders.ts
// No #version directives here — _ensureProgram in TerrainPlugin prepends '#version 300 es\n'
// so it is always the absolute first line. GLSL ES 3.00 vertex shaders default to highp float.

export const TERRAIN_VERT = /* glsl */`
in vec2 a_pos;           // grid position [0,1]×[0,1]
uniform sampler2D u_dem;
uniform float u_exaggeration;
out vec2 v_uv;

void main() {
  vec4 dem = texture(u_dem, a_pos);
  // Mapbox terrain-RGB decoding — result is metres above sea level
  float elevation = (dem.r * 255.0 * 65536.0
                   + dem.g * 255.0 * 256.0
                   + dem.b * 255.0) * 0.1 - 10000.0;
  vec2 tilePos = a_pos * 4096.0;
  // elevation in metres; u_matrix Z-scale (pixelsPerMeter) converts to world pixels
  gl_Position = projectTileWithElevation(tilePos, elevation * u_exaggeration);
  v_uv = a_pos;
}
`

export const TERRAIN_FRAG = /* glsl */`
precision mediump float;
uniform sampler2D u_map_texture;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  // FBO texture Y=0 is at the bottom (OpenGL convention), but the tile was rendered
  // into the FBO with Y=0 at the top (tile space). Flip v_uv.y to correct the orientation.
  fragColor = texture(u_map_texture, vec2(v_uv.x, 1.0 - v_uv.y));
}
`
