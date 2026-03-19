// src/mini/layers/terrain/terrain-shaders.ts
// No #version directives here — _ensureProgram in TerrainPlugin prepends '#version 300 es\n'
// so it is always the absolute first line. GLSL ES 3.00 vertex shaders default to highp float.

export const TERRAIN_VERT = /* glsl */`
in vec2 a_pos;           // grid position [0,1]×[0,1]
uniform sampler2D u_dem;
uniform float u_exaggeration;

// Copied verbatim from MapLibre _prelude.vertex.glsl (TERRAIN3D block).
// u_terrain_unpack = [redFactor, greenFactor, blueFactor, baseShift]
//   mapbox encoding: [6553.6, 25.6, 0.1, 10000]
// u_terrain_dim = unpadded tile dimension (e.g. 256.0)
// DEM texture is (dim+2)×(dim+2) with 1px border padding on each side.
uniform vec4 u_terrain_unpack;
uniform float u_terrain_dim;

out vec2 v_uv;

// Sample raw elevation from a UV in [0,1] space of the padded DEM texture.
// Matches MapLibre's ele() in _prelude.vertex.glsl.
float ele(vec2 uv) {
  vec4 rgb = (texture(u_dem, uv) * 255.0) * u_terrain_unpack;
  return rgb.r + rgb.g + rgb.b - u_terrain_unpack.a;
}

// Bilinearly interpolate elevation in elevation space (not RGB space).
// Matches MapLibre's get_elevation() in _prelude.vertex.glsl, minus the
// u_terrain_matrix transform (not needed here — a_pos is already in DEM
// tile UV space [0,1] because the terrain plugin uses one FBO per DEM tile).
float get_elevation(vec2 pos) {
  // Map [0,1] → [1, dim+1] pixel coords inside the padded (dim+2)×(dim+2) texture
  vec2 coord = pos * u_terrain_dim + 1.0;
  vec2 f = fract(coord);
  // Centre of the floor pixel, normalised to [0,1] over the full padded texture
  vec2 c = (floor(coord) + 0.5) / (u_terrain_dim + 2.0);
  float d = 1.0 / (u_terrain_dim + 2.0);
  float tl = ele(c);
  float tr = ele(c + vec2(d, 0.0));
  float bl = ele(c + vec2(0.0, d));
  float br = ele(c + vec2(d, d));
  return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

void main() {
  float elevation = get_elevation(a_pos);
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
