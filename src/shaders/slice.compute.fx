struct Params {
  center : vec3f,
  sliceW : u32,
  right  : vec3f,
  sliceH : u32,
  up     : vec3f,
  volW   : u32,
  volH   : u32,
  volD   : u32,
  _pad   : u32,
};

@group(0) @binding(0) var<uniform>             params   : Params;
@group(0) @binding(1) var                      volume   : texture_3d<u32>;
@group(0) @binding(2) var                      lut      : texture_1d<f32>;
@group(0) @binding(3) var<storage, read_write> colorOut : array<u32>;
@group(0) @binding(4) var<storage, read_write> dataOut  : array<u32>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let px = gid.x;
  let py = gid.y;
  if (px >= params.sliceW || py >= params.sliceH) { return; }

  let halfW = f32(params.sliceW) * 0.5;
  let halfH = f32(params.sliceH) * 0.5;
  let s = (f32(px) - halfW + 0.5) / halfW;
  let t = (f32(py) - halfH + 0.5) / halfH;

  let worldPos = params.center
               + s * params.right * halfW
               + t * params.up    * halfH;

  let vx = i32(round(worldPos.x));
  let vy = i32(round(worldPos.y));
  let vz = i32(round(worldPos.z));

  let iW = i32(params.volW);
  let iH = i32(params.volH);
  let iD = i32(params.volD);

  var raw : u32 = 0u;
  if (vx >= 0 && vx < iW && vy >= 0 && vy < iH && vz >= 0 && vz < iD) {
    raw = textureLoad(volume, vec3i(vx, vy, vz), 0).r;
  }

  let idx = py * params.sliceW + px;
  dataOut[idx] = raw;

  // LUT lookup → packed RGBA8 u32
  let lutIdx   = clamp(i32(raw), 0, 255);
  let c        = textureLoad(lut, lutIdx, 0);
  let r8       = u32(c.r * 255.0 + 0.5);
  let g8       = u32(c.g * 255.0 + 0.5);
  let b8       = u32(c.b * 255.0 + 0.5);
  colorOut[idx] = r8 | (g8 << 8u) | (b8 << 16u) | (255u << 24u);
}