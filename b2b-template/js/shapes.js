/* ------------------------------------------------------------------ *
 *  Particle shapes.
 *
 *  Every shape is a function (n, rnd) -> Float32Array(n * 3) that fills
 *  roughly a radius-3 ball around the origin. A section picks one with
 *  data-shape="name" in index.html. To add your own, write a generator
 *  and register it in SHAPES below.
 *
 *  meta.tilt  resting tilt of the sculpture toward the camera (radians)
 *  meta.roll  resting roll around the view axis (radians)
 *  meta.spin  idle rotation speed around its own vertical axis
 *  meta.extra optional scenery that fades in with the shape (see world.js)
 * ------------------------------------------------------------------ */
const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/* Small deterministic RNG so the sculpture looks the same on every visit */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd) => (rnd() + rnd() + rnd() + rnd() - 2) * 0.7;

function fib(i, n, r, out, o) {
  const y = 1 - (2 * (i + 0.5)) / n;
  const s = Math.sqrt(1 - y * y);
  const a = i * GOLDEN;
  out[o] = Math.cos(a) * s * r; out[o + 1] = y * r; out[o + 2] = Math.sin(a) * s * r;
}
function randomOnSphere(rnd, r, out, o) {
  const y = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - y * y);
  out[o] = Math.cos(a) * s * r; out[o + 1] = y * r; out[o + 2] = Math.sin(a) * s * r;
}

/* Shell around the hero orb, two orbit rings and a loose halo */
function core(n, rnd) {
  const out = new Float32Array(n * 3);
  const shell = Math.floor(n * 0.62), rings = Math.floor(n * 0.22);
  for (let i = 0; i < shell; i++) fib(i, shell, 2.75 + gauss(rnd) * 0.05, out, i * 3);
  for (let i = shell; i < shell + rings; i++) {
    const second = i % 2, a = rnd() * TAU, r = (second ? 4.25 : 3.55) + gauss(rnd) * 0.06;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = gauss(rnd) * 0.035;
    const t = second ? -0.5 : 0.38, c = Math.cos(t), s = Math.sin(t);
    out[i * 3] = x * c - y * s; out[i * 3 + 1] = x * s + y * c; out[i * 3 + 2] = z;
  }
  for (let i = shell + rings; i < n; i++) randomOnSphere(rnd, 3.1 + rnd() * rnd() * 2.6, out, i * 3);
  return out;
}

/* Three-armed spiral disc with a dense centre */
function galaxy(n, rnd) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    if (i % 7 === 0) { randomOnSphere(rnd, Math.pow(rnd(), 2) * 1.1, out, o); out[o + 1] *= 0.6; continue; }
    const r = 0.5 + Math.pow(rnd(), 0.7) * 4.4;
    const a = (i % 3) * (TAU / 3) + r * 0.85 + gauss(rnd) * (0.22 + 0.25 / r);
    out[o] = Math.cos(a) * r; out[o + 1] = gauss(rnd) * 0.32 * (1 - r / 6); out[o + 2] = Math.sin(a) * r;
  }
  return out;
}

/* Modular cube: particles run along the grid lines and pool at the joints */
function lattice(n, rnd) {
  const out = new Float32Array(n * 3);
  const S = 2.25, cells = 4, step = (2 * S) / cells;
  const snap = () => -S + Math.floor(rnd() * (cells + 1)) * step;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const p = [snap(), snap(), snap()];
    if (rnd() < 0.3) { p[0] += gauss(rnd) * 0.07; p[1] += gauss(rnd) * 0.07; p[2] += gauss(rnd) * 0.07; }
    else { p[Math.floor(rnd() * 3)] = (rnd() * 2 - 1) * S; }
    out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2];
  }
  return out;
}

/* Ribbed torus: rings around the tube plus a few meridians */
function torus(n, rnd) {
  const out = new Float32Array(n * 3);
  const R = 2.55, r = 0.95;
  for (let i = 0; i < n; i++) {
    let u = rnd() * TAU, v = rnd() * TAU;
    if (rnd() < 0.62) u = (Math.floor(rnd() * 44) / 44) * TAU; else if (rnd() < 0.6) v = (Math.floor(rnd() * 10) / 10) * TAU;
    const rr = r + gauss(rnd) * 0.015, c = R + rr * Math.cos(v), o = i * 3;
    out[o] = c * Math.cos(u); out[o + 1] = rr * Math.sin(v); out[o + 2] = c * Math.sin(u);
  }
  return out;
}

/* Dotted globe: dense "land" picked by a cheap noise field, sparse ocean */
function landNoise(x, y, z) {
  return Math.sin(x * 2.1 + 1.3) * Math.sin(y * 2.7 + 0.7) + Math.sin(y * 1.9 + z * 2.3) * 0.8
    + Math.sin(z * 3.1 + x * 1.7 + 2.0) * 0.6 + Math.sin(x * 5 + y * 4 + z * 6) * 0.25;
}
function globe(n, rnd) {
  const out = new Float32Array(n * 3);
  const R = 2.9, land = Math.floor(n * 0.86), pool = n * 4, tmp = [0, 0, 0];
  let filled = 0;
  for (let k = 0; k < pool && filled < land; k++) {
    fib(k, pool, 1, tmp, 0);
    if (landNoise(tmp[0] * 1.9, tmp[1] * 1.9, tmp[2] * 1.9) < 0.2) continue;
    const o = filled * 3;
    out[o] = tmp[0] * R; out[o + 1] = tmp[1] * R; out[o + 2] = tmp[2] * R; filled++;
  }
  for (let i = filled; i < n; i++) randomOnSphere(rnd, R * (i % 9 === 0 ? 1.12 + rnd() * 0.5 : 0.995), out, i * 3);
  return out;
}

/* Double helix with rungs */
function helix(n, rnd) {
  const out = new Float32Array(n * 3);
  const turns = 2.6, H = 4.3, R = 1.45;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    let t = rnd() * 2 - 1, k = i % 2 ? 1 : -1, w = 1;
    if (i % 10 < 3) { t = (Math.floor(rnd() * 34) / 34) * 2 - 1 + 1 / 34; w = rnd() * 2 - 1; k = 1; }
    const a = t * Math.PI * turns + (k > 0 ? 0 : Math.PI);
    const j = w === 1 ? 0.045 : 0.012;
    out[o] = Math.cos(a) * R * w + gauss(rnd) * j; out[o + 1] = t * H + gauss(rnd) * j; out[o + 2] = Math.sin(a) * R * w + gauss(rnd) * j;
  }
  return out;
}

/* Growth chart: columns rising left to right */
function bars(n, rnd) {
  const out = new Float32Array(n * 3);
  const nx = 7, nz = 4, pitch = 0.92, half = 0.3, base = -2.1;
  const cols = [];
  let total = 0;
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    const h = 0.5 + Math.pow((ix + 0.4) / nx, 1.5) * 4.2 * (0.72 + rnd() * 0.28);
    cols.push({ x: (ix - (nx - 1) / 2) * pitch, z: (iz - (nz - 1) / 2) * pitch, h, w: h + 1.2 });
    total += h + 1.2;
  }
  for (let i = 0; i < n; i++) {
    let pick = rnd() * total, c = cols[0];
    for (const col of cols) { pick -= col.w; if (pick <= 0) { c = col; break; } }
    const o = i * 3, f = rnd();
    let x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half, y = rnd() * c.h;
    if (f < 0.3) y = c.h;                                   // lid
    else if (f < 0.75) { x = Math.sign(x) * half; z = Math.sign(z) * half; }   // vertical edges
    else if (rnd() < 0.5) x = Math.sign(x) * half; else z = Math.sign(z) * half; // walls
    out[o] = c.x + x; out[o + 1] = base + y; out[o + 2] = c.z + z;
  }
  return out;
}

/* Rolling surface */
function wave(n, rnd) {
  const out = new Float32Array(n * 3);
  const g = Math.floor(Math.sqrt(n)), W = 5.2;
  for (let i = 0; i < n; i++) {
    const gx = i < g * g ? (i % g) / (g - 1) : rnd(), gz = i < g * g ? Math.floor(i / g) / (g - 1) : rnd();
    const x = (gx * 2 - 1) * W, z = (gz * 2 - 1) * W, o = i * 3;
    out[o] = x; out[o + 1] = Math.sin(x * 1.05) * Math.cos(z * 0.9) * 0.55 + Math.sin(x * 0.45 + z * 0.7) * 0.45; out[o + 2] = z;
  }
  return out;
}

/* Trefoil knot tube */
function knot(n, rnd) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = rnd() * TAU, o = i * 3, s = 1.02;
    const r = 2 + Math.cos(3 * t);
    const tube = 0.36 * Math.sqrt(rnd()), y = rnd() * 2 - 1, a = rnd() * TAU, q = Math.sqrt(1 - y * y);
    out[o] = r * Math.cos(2 * t) * s + Math.cos(a) * q * tube;
    out[o + 1] = r * Math.sin(2 * t) * s + y * tube;
    out[o + 2] = Math.sin(3 * t) * 1.25 * s + Math.sin(a) * q * tube;
  }
  return out;
}

/* Plain sphere and loose cloud, handy for new sections */
function sphere(n) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) fib(i, n, 2.9, out, i * 3);
  return out;
}
function cloud(n, rnd) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) randomOnSphere(rnd, 0.6 + Math.cbrt(rnd()) * 3.6, out, i * 3);
  return out;
}

export const SHAPES = {
  core:    { build: core,    tilt: 0.12, roll: 0.1,   spin: 0.10, extra: 'orb' },
  galaxy:  { build: galaxy,  tilt: 1.02, roll: 0.22,  spin: 0.07 },
  lattice: { build: lattice, tilt: 0.42, roll: 0.0,   spin: 0.10 },
  torus:   { build: torus,   tilt: 1.0,  roll: 0.3,   spin: 0.14 },
  globe:   { build: globe,   tilt: 0.3,  roll: -0.2,  spin: 0.09, extra: 'arcs' },
  helix:   { build: helix,   tilt: 0.1,  roll: 0.42,  spin: 0.22 },
  bars:    { build: bars,    tilt: 0.36, roll: 0.0,   spin: 0.07 },
  wave:    { build: wave,    tilt: 0.62, roll: 0.0,   spin: 0.04 },
  knot:    { build: knot,    tilt: 0.2,  roll: 0.0,   spin: 0.14 },
  sphere:  { build: sphere,  tilt: 0.2,  roll: 0.0,   spin: 0.10 },
  cloud:   { build: cloud,   tilt: 0.0,  roll: 0.0,   spin: 0.06 },
};

export function buildShape(name, n) {
  const shape = SHAPES[name] || SHAPES.cloud;
  let seed = 7;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  return shape.build(n, mulberry32(seed));
}
