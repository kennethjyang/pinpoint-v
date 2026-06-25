let ctx: OffscreenCanvasRenderingContext2D
self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    ctx = data.offscreenCanvas.getContext('2d')
    return
  }
  const pixels = new Uint8ClampedArray(data.buffer)
  ctx.putImageData(new ImageData(pixels, data.size, data.size), 0, 0)
}
