import { describe, it, expect, vi } from 'vitest'
import { LineLayer } from './line'

function makeGL() {
  return {
    createBuffer: vi.fn().mockReturnValue({}), bindBuffer: vi.fn(), bufferData: vi.fn(),
    getAttribLocation: vi.fn().mockReturnValue(0), enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(), useProgram: vi.fn(),
    getUniformLocation: vi.fn().mockReturnValue({}), uniformMatrix4fv: vi.fn(),
    uniform4f: vi.fn(), drawArrays: vi.fn(),
    ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, FLOAT: 5126, LINES: 1,
  } as unknown as WebGLRenderingContext
}

describe('LineLayer', () => {
  it('has type "line"', () => expect(new LineLayer({ source: 'mvt', sourceLayer: 'roads' }).type).toBe('line'))
  it('has static programs with a "line" entry', () => expect(LineLayer.programs[0].name).toBe('line'))

  it('draw() with no tileData does nothing', () => {
    const gl = makeGL()
    const layer = new LineLayer({ source: 'mvt', sourceLayer: 'roads' })
    layer.onAdd({ _webgl: { createGeometryBuffer: vi.fn() } } as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:0,x:0,y:0,key:'0/0/0' }, meshBuffers: { vert: {} as WebGLBuffer, idx: {} as WebGLBuffer, indexCount: 6 }, zoom:0, paint:{}, frameIndex:0, imageAtlas:{}, lineDashAtlas:{}, tileData:undefined } as any)
    expect(gl.drawArrays).not.toHaveBeenCalled()
  })

  it('draw() calls gl.drawArrays(gl.LINES, ...) for valid PBF data', () => {
    vi.mock('@mapbox/vector-tile', () => ({
      VectorTile: class {
        layers = { roads: { length: 1, feature: () => ({ type: 2, loadGeometry: () => [[{ x:0,y:0 }, { x:2048,y:0 }, { x:4096,y:4096 }]] }) } }
      }
    }))
    const gl = makeGL()
    const layer = new LineLayer({ source: 'mvt', sourceLayer: 'roads' })
    layer.onAdd({ createGeometryBuffer: vi.fn().mockReturnValue({}) } as any)
    layer.draw({ gl, programs: { get: vi.fn().mockReturnValue({}) }, tileID: { z:10,x:1,y:2,key:'10/1/2' }, meshBuffers: { vert: {} as WebGLBuffer, idx: {} as WebGLBuffer, indexCount: 6 }, zoom:10, paint:{ 'line-color':'#ff0000' }, frameIndex:0, imageAtlas:{}, lineDashAtlas:{}, tileData: new ArrayBuffer(1) } as any)
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.LINES, 0, expect.any(Number))
  })
})
