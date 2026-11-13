import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ------------------------------------------------------------------ *
 *  Site settings — change these to your real details
 * ------------------------------------------------------------------ */
const CONTACT_EMAIL = 'hello@secondore.example';

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const rand = (a, b) => a + Math.random() * (b - a);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const METALS = {
  copper: 0xc8763a, aluminium: 0xd5dade, brass: 0xd9ab4e, steel: 0x858d95, bronze: 0x9a5b3c,
};
const GREEN = 0x3dffa2, CYAN = 0x38d6ff, ORANGE = 0xff8a3d;

/* ------------------------------------------------------------------ *
 *  DOM: keyframes, rail, reveals, counters, form
 * ------------------------------------------------------------------ */
const keyEls = $$('[data-key]');
const chapters = [];
keyEls.forEach((el) => { chapters[+el.dataset.chapter] ??= el.dataset.name; });

const dotsEl = $('#rail-dots');
chapters.forEach(() => dotsEl.appendChild(document.createElement('i')));
const dots = $$('i', dotsEl);
const navLinks = $$('.top nav a');
const navChapter = { '#metals': 1, '#pcbs': 2, '#wires': 3, '#process': 4, '#impact': 5 };
let activeChapter = -1;
function setChapter(c) {
  if (c === activeChapter) return;
  activeChapter = c;
  dots.forEach((d, i) => d.classList.toggle('on', i === c));
  $('#rail-now').textContent = String(c + 1).padStart(2, '0');
  $('#rail-name').textContent = chapters[c];
  navLinks.forEach((a) => a.classList.toggle('on', navChapter[a.getAttribute('href')] === c));
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    $$('[data-count]', e.target).forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.35 });
$$('.panel').forEach((p) => io.observe(p));

function countUp(el) {
  const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), t0 = performance.now();
  if (reducedMotion) { el.textContent = to.toFixed(dec); return; }
  (function tick(now) {
    const k = easeOut((now - t0) / 1800);
    el.textContent = (to * k).toFixed(dec);
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}

$('#year').textContent = new Date().getFullYear();
$('#quote').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements, note = $('#form-note');
  if (!f.name.value.trim() || !f.email.validity.valid || !f.email.value) {
    note.textContent = 'Please add your name and a valid email.';
    return;
  }
  const body = `Name: ${f.name.value}\nEmail: ${f.email.value}\nMaterial: ${f.material.value}\nQuantity: ${f.quantity.value}\n\n${f.message.value}`;
  location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quote request — ' + f.material.value)}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Opening your email app to send the request…';
});

/* Scroll position → continuous keyframe index (0 … n-1) */
let centers = [];
function measure() {
  centers = keyEls.map((el) => {
    const r = el.getBoundingClientRect();
    return r.top + scrollY + r.height / 2;
  });
}
function scrollT() {
  const y = scrollY + innerHeight / 2;
  if (y <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return centers.length - 1;
}

/* ------------------------------------------------------------------ *
 *  Renderer
 * ------------------------------------------------------------------ */
const canvas = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('no-webgl');
  document.body.classList.remove('loading');
  measure();
  addEventListener('scroll', () => setChapter(+keyEls[Math.round(scrollT())].dataset.chapter), { passive: true });
  setChapter(0);
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070a);
scene.fog = new THREE.FogExp2(0x04070a, 0.022);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 220);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.6, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(6, 10, 8);
scene.add(key, new THREE.AmbientLight(0x406055, 0.6));

const metal = (color, rough = 0.3, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough, ...extra });
const glow = (color, intensity = 2) =>
  new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 1 });

/* World positions of each station */
const P = {
  hero: new THREE.Vector3(0, 0, 0),
  metals: new THREE.Vector3(14, -3, -30),
  pcb: new THREE.Vector3(-14, 2, -62),
  wires: new THREE.Vector3(12, 0, -94),
  gate: (k) => new THREE.Vector3(0, 0, -118 - k * 10),
  globe: new THREE.Vector3(0, 0, -192),
};

/* ------------------------------------------------------------------ *
 *  0 · HERO — the loop, wrapped in a vortex of scrap
 * ------------------------------------------------------------------ */
const hero = new THREE.Group();
hero.position.copy(P.hero);
scene.add(hero);

const loopRings = [0, 1, 2].map((i) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.9 - i * 0.28, 0.075, 24, 160), metal(0xcfd8d4, 0.18));
  hero.add(m);
  return m;
});
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: GREEN, emissiveIntensity: 2.4, wireframe: true }));
const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), glow(GREEN, 4));
hero.add(core, coreGlow);
const heroLight = new THREE.PointLight(GREEN, 26, 22);
hero.add(heroLight);

function ingotGeometry(w = 2.2, h = 0.55, d = 0.95) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.88); p.setZ(i, p.getZ(i) * 0.7); }
  g.computeVertexNormals();
  return g;
}

const scrapGeos = [
  new THREE.BoxGeometry(0.34, 0.05, 0.2),              // sheet offcut
  new THREE.TetrahedronGeometry(0.17),                  // shard
  new THREE.TorusGeometry(0.11, 0.04, 8, 16),           // washer
  new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8),    // rod / bolt
  new THREE.CylinderGeometry(0.13, 0.13, 0.07, 6),      // hex nut
];
const scrapColors = Object.values(METALS).map((c) => new THREE.Color(c));
const SCRAP_PER = 130;
const dummy = new THREE.Object3D();
const scrap = scrapGeos.map((geo) => {
  const mesh = new THREE.InstancedMesh(geo, metal(0xffffff, 0.34), SCRAP_PER);
  const items = [];
  for (let i = 0; i < SCRAP_PER; i++) {
    items.push({
      a: rand(0, Math.PI * 2), r: rand(2.6, 5.4), y: rand(-2.6, 2.6) * rand(0.3, 1),
      sp: rand(0.05, 0.22), spin: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)),
      s: rand(0.6, 1.9), ph: rand(0, 6.28),
    });
    mesh.setColorAt(i, scrapColors[(Math.random() * scrapColors.length) | 0]);
  }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  hero.add(mesh);
  return { mesh, items };
});

/* ------------------------------------------------------------------ *
 *  1 · METALS — ingots stacking on a plinth
 * ------------------------------------------------------------------ */
const metals = new THREE.Group();
metals.position.copy(P.metals);
scene.add(metals);

const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.9, 0.18, 96), metal(0x14191b, 0.45));
plinth.position.y = -0.4;
const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(3.82, 0.025, 8, 160), glow(ORANGE, 3));
plinthRing.rotation.x = Math.PI / 2;
plinthRing.position.y = -0.3;
metals.add(plinth, plinthRing);

const ingotGeo = ingotGeometry();
const layerMetals = [METALS.steel, METALS.aluminium, METALS.brass, METALS.copper];
const ingots = [];
for (let layer = 0; layer < 4; layer++) {
  const n = 4 - layer;
  const mat = metal(layerMetals[layer], 0.22);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(ingotGeo, mat);
    m.userData.home = new THREE.Vector3(0, layer * 0.57, (i - (n - 1) / 2) * 1.02);
    m.userData.spin = rand(-2, 2);
    metals.add(m);
    ingots.push(m);
  }
}
const metalsLight = new THREE.PointLight(0xffa25c, 40, 20);
metalsLight.position.set(-3, 3.5, 4);
metals.add(metalsLight);

/* ------------------------------------------------------------------ *
 *  2 · PCB — a board that explodes into its layers
 * ------------------------------------------------------------------ */
const pcb = new THREE.Group();
pcb.position.copy(P.pcb);
scene.add(pcb);
const BW = 6.4, BD = 4.2;

const copperPlane = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.04, BD), metal(METALS.copper, 0.3));
const board = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.12, BD), new THREE.MeshStandardMaterial({ color: 0x0a4a2a, roughness: 0.45, metalness: 0.25 }));
const traceLayer = new THREE.Group();
const compLayer = new THREE.Group();
pcb.add(copperPlane, board, traceLayer, compLayer);

const traceMat = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 1, roughness: 0.3, emissive: 0xffa200, emissiveIntensity: 0.8 });
const TRACES = 90;
const traces = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), traceMat, TRACES);
const pads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 12), traceMat, TRACES);
for (let i = 0; i < TRACES; i++) {
  const horiz = Math.random() > 0.5, len = rand(0.4, 2.2);
  const x = rand(-BW / 2 + 0.3, BW / 2 - 0.3), z = rand(-BD / 2 + 0.3, BD / 2 - 0.3);
  const cx = horiz ? clamp(x, -BW / 2 + len / 2 + 0.15, BW / 2 - len / 2 - 0.15) : x;
  const cz = horiz ? z : clamp(z, -BD / 2 + len / 2 + 0.15, BD / 2 - len / 2 - 0.15);
  dummy.position.set(cx, 0, cz); dummy.rotation.set(0, 0, 0);
  dummy.scale.set(horiz ? len : 0.035, 1, horiz ? 0.035 : len);
  dummy.updateMatrix(); traces.setMatrixAt(i, dummy.matrix);
  dummy.position.set(cx + (horiz ? len / 2 : 0), 0, cz + (horiz ? 0 : len / 2)); dummy.scale.set(1, 1, 1);
  dummy.updateMatrix(); pads.setMatrixAt(i, dummy.matrix);
}
traceLayer.add(traces, pads);

const chipMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.35, metalness: 0.4 });
const pinMat = metal(0xc9ced2, 0.25);
function chip(x, z, w, d, h = 0.16) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), chipMat);
  body.position.y = h / 2 + 0.03;
  const pins = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.03, d + 0.14), pinMat);
  pins.position.y = 0.03;
  g.add(body, pins);
  g.position.set(x, 0, z);
  compLayer.add(g);
  return g;
}
const cpu = chip(0.2, 0, 1.5, 1.5, 0.2);
const lid = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 1.05), metal(0xe8c15a, 0.2, { emissive: 0xffb300, emissiveIntensity: 0.25 }));
lid.position.y = 0.25;
cpu.add(lid);
[[-2.2, -1.2, 1.0, 0.6], [-2.3, 0.3, 0.7, 0.7], [-1.5, 1.4, 1.2, 0.45], [2.3, -1.3, 0.8, 0.8], [2.4, 0.4, 0.5, 1.1],
 [1.6, 1.5, 1.1, 0.4], [-0.6, -1.5, 0.6, 0.4], [0.9, -1.55, 0.5, 0.35], [-1.0, 0.2, 0.4, 0.6]].forEach((c) => chip(...c));
const capMat = metal(0x9aa7b8, 0.25), capMat2 = metal(METALS.copper, 0.3);
for (let i = 0; i < 12; i++) {
  const r = rand(0.09, 0.17), h = rand(0.25, 0.55);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), i % 3 ? capMat : capMat2);
  c.position.set(rand(-2.9, 2.9), h / 2 + 0.01, (Math.random() > 0.5 ? 1 : -1) * rand(1.75, 1.95) * (i % 2 ? 1 : 0.42));
  compLayer.add(c);
}
const pcbLight = new THREE.PointLight(GREEN, 50, 18);
pcbLight.position.set(0, 4, 3);
pcb.add(pcbLight);

/* ------------------------------------------------------------------ *
 *  3 · WIRES — a cable bundle whose insulation strips back
 * ------------------------------------------------------------------ */
const wires = new THREE.Group();
wires.position.copy(P.wires);
scene.add(wires);
const jacketColors = [0xd62f2f, 0x1f5fd6, 0xe8c21a, 0x1a1c1e, 0x1fa85a, 0xe8e8e8, 0xd6641f];
const TUBE_SEG = 220, RAD_SEG = 12;
const cables = jacketColors.map((col, i) => {
  const ph = (i / jacketColors.length) * Math.PI * 2, pts = [];
  for (let j = 0; j <= 28; j++) {
    const s = j / 28, tw = s * Math.PI * 3.2 + ph;
    const r = 0.36 + 2.1 * Math.pow(Math.abs(s - 0.5) * 2, 2.2);
    pts.push(new THREE.Vector3((s - 0.5) * 17, Math.sin(tw) * r, Math.cos(tw) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const jacket = new THREE.Mesh(new THREE.TubeGeometry(curve, TUBE_SEG, 0.17, RAD_SEG), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.05 }));
  const coreWire = new THREE.Mesh(new THREE.TubeGeometry(curve, TUBE_SEG, 0.095, 8), metal(0xd9824a, 0.28, { emissive: 0xff6a1a, emissiveIntensity: 0.12 }));
  wires.add(jacket, coreWire);
  return { jacket, delay: (i * 0.37) % 1 };
});
const wiresLight = new THREE.PointLight(0xff9a4d, 14, 20);
wiresLight.position.set(-2, 5, 6);
wires.add(wiresLight);

/* ------------------------------------------------------------------ *
 *  4 · PROCESS — five gates to fly through
 * ------------------------------------------------------------------ */
const tunnel = new THREE.Group();
scene.add(tunnel);
const gateCol = new THREE.Color();
const gates = [0, 1, 2, 3, 4].map((k) => {
  const g = new THREE.Group();
  g.position.copy(P.gate(k));
  gateCol.set(GREEN).lerp(new THREE.Color(k < 3 ? CYAN : ORANGE), k < 3 ? k / 2 : (k - 2) / 2);
  const mat = glow(gateCol.clone(), 1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.045, 12, 128), mat);
  const arc1 = new THREE.Mesh(new THREE.TorusGeometry(3.65, 0.02, 8, 96, Math.PI * 1.3), mat);
  const arc2 = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.012, 8, 96, Math.PI * 0.8), mat);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.16, 4, 6), metal(0x1a2022, 0.35));
  g.add(ring, arc1, arc2, frame);
  tunnel.add(g);
  return { g, mat, arc1, arc2, frame };
});

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const dotTex = dotTexture();
function points(positions, opts, colors) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: !!colors, ...opts }));
}
{
  const pos = [];
  for (let i = 0; i < 1600; i++) {
    const a = rand(0, 6.28), r = rand(2.2, 6.5);
    pos.push(Math.cos(a) * r, Math.sin(a) * r, rand(-170, -106));
  }
  tunnel.add(points(pos, { size: 0.09, color: 0x9fffe0, opacity: 0.8 }));
}

/* ------------------------------------------------------------------ *
 *  5 · IMPACT — a planet kept in orbit by closed loops
 * ------------------------------------------------------------------ */
const globe = new THREE.Group();
globe.position.copy(P.globe);
scene.add(globe);
const planet = new THREE.Group();
globe.add(planet);
{
  const N = 9000, pos = [], col = [], land = new THREE.Color(GREEN), sea = new THREE.Color(0x0d4a5c), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const n = Math.sin(x * 3.1 + 1.3) * Math.sin(y * 4.3 + 0.4) + Math.sin(z * 3.7 + x * 2.0) * 0.6 + Math.sin(y * 9 + z * 5) * 0.25;
    c.copy(n > 0.25 ? land : sea);
    pos.push(x * 3, y * 3, z * 3); col.push(c.r, c.g, c.b);
  }
  planet.add(points(pos, { size: 0.07, opacity: 0.95 }, col));
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(2.94, 48, 48), new THREE.MeshBasicMaterial({ color: 0x030a0c })));
}
const orbits = [[4.1, 0.35, 0.1, GREEN], [4.8, -0.5, 0.6, CYAN], [5.5, 1.1, -0.3, ORANGE]].map(([r, rx, rz, col], i) => {
  const o = new THREE.Group();
  o.rotation.set(Math.PI / 2 + rx, 0, rz);
  o.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 8, 200), glow(col, 2.2)));
  const sat = new THREE.Mesh(ingotGeometry(0.5, 0.14, 0.24), metal(Object.values(METALS)[i], 0.2));
  sat.position.x = r;
  const pivot = new THREE.Group();
  pivot.add(sat); o.add(pivot); globe.add(o);
  return { pivot, speed: 0.5 - i * 0.12 };
});
const globeLight = new THREE.PointLight(CYAN, 80, 24);
globeLight.position.set(5, 4, 6);
globe.add(globeLight);

/* Ambient dust along the whole route */
{
  const pos = [];
  for (let i = 0; i < 5000; i++) pos.push(rand(-34, 34), rand(-16, 16), rand(-215, 16));
  scene.add(points(pos, { size: 0.07, color: 0x8fffd0, opacity: 0.45 }));
}

/* ------------------------------------------------------------------ *
 *  Camera route — one stop per keyframe section
 * ------------------------------------------------------------------ */
// side: +1 → subject sits right of frame (text on the left), -1 → left, 0 → centred
const stops = [
  { c: P.hero, off: [0, 0.5, 12.5], side: 1, shift: 5 },
  { c: P.metals, off: [-1.5, 2.6, 9], side: -1, shift: 2.6 },
  { c: P.pcb, off: [2, 4.4, 6], side: 1, shift: 2.3 },
  { c: P.wires, off: [0, 1.2, 10], side: -1, shift: 2.8 },
  ...[0, 1, 2, 3, 4].map((k) => ({ c: P.gate(k), off: [k % 2 ? -0.9 : 0.9, 0.2, 7.5], look: [k % 2 ? 1.2 : -1.2, 0, -12] })),
  { c: P.globe, off: [0, 1.5, 16], side: 1, shift: 4.6 },
  { c: P.globe, off: [0, 1.5, 9.5], side: 0, shift: 0 },
];
let camCurve, lookCurve, portrait = null;
function buildRoute() {
  const cams = [], looks = [];
  stops.forEach((s) => {
    const off = new THREE.Vector3(...s.off);
    if (s.look) {
      cams.push(s.c.clone().add(portrait ? off.setX(0) : off));
      looks.push(s.c.clone().add(new THREE.Vector3(portrait ? 0 : s.look[0], s.look[1], s.look[2])));
    } else if (portrait) {
      cams.push(s.c.clone().add(off.multiplyScalar(1.25)));
      looks.push(s.c.clone().add(new THREE.Vector3(0, s.side ? -2.4 : 0, 0)));
    } else {
      cams.push(s.c.clone().add(off));
      looks.push(s.c.clone().add(new THREE.Vector3(-s.side * s.shift, 0, 0)));
    }
  });
  camCurve = new THREE.CatmullRomCurve3(cams, false, 'centripetal');
  lookCurve = new THREE.CatmullRomCurve3(looks, false, 'centripetal');
}

function resize() {
  const w = innerWidth, h = innerHeight, p = w / h < 0.9;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = p ? 66 : 45;
  camera.updateProjectionMatrix();
  if (p !== portrait) { portrait = p; buildRoute(); }
  measure();
}
addEventListener('resize', resize);
new ResizeObserver(measure).observe(document.body);
resize();

const mouse = new THREE.Vector2(), mouseS = new THREE.Vector2();
const cursor = $('#cursor');
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
});

/* ------------------------------------------------------------------ *
 *  Frame loop
 * ------------------------------------------------------------------ */
const N = stops.length;
const clock = new THREE.Clock();
const progressBar = $('#progress-bar');
const camPos = new THREE.Vector3(), lookPos = new THREE.Vector3();
let t = scrollT(), intro = 0, started = false, lastT = -1, velocity = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  const target = scrollT();
  const prev = t;
  t = reducedMotion ? target : t + (target - t) * (1 - Math.exp(-dt * 4.5));
  velocity += ((t - prev) / Math.max(dt, 1e-3) - velocity) * 0.1;
  if (started) intro = Math.min(1, intro + dt / 2.6);
  const L = (i) => t - i;

  /* camera */
  const u = clamp(t / (N - 1));
  camCurve.getPoint(u, camPos); lookCurve.getPoint(u, lookPos);
  mouseS.lerp(mouse, reducedMotion ? 0 : 0.05);
  camera.position.copy(camPos);
  camera.lookAt(lookPos);
  camera.translateX(mouseS.x * 0.5); camera.translateY(-mouseS.y * 0.35);
  camera.lookAt(lookPos);
  camera.rotateZ(clamp(velocity, -2, 2) * -0.012);
  bloom.strength = 0.42 + Math.min(Math.abs(velocity), 2) * 0.1;

  /* hero */
  hero.visible = L(0) < 1.4;
  if (hero.visible) {
    const burst = smooth(0.05, 1, L(0)), open = easeOut(intro);
    loopRings[0].rotation.set(time * 0.31, time * 0.2, 0);
    loopRings[1].rotation.set(time * -0.24 + 1, 0, time * 0.33);
    loopRings[2].rotation.set(0.6, time * 0.42, time * -0.27);
    core.rotation.set(time * 0.2, time * 0.3, 0);
    coreGlow.scale.setScalar(1 + Math.sin(time * 2.2) * 0.12);
    hero.scale.setScalar(0.6 + 0.4 * open);
    for (const { mesh, items } of scrap) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i], a = it.a + time * it.sp + burst * 1.5;
        const r = it.r * (1 + (1 - open) * 2.5 + burst * 1.6);
        dummy.position.set(Math.cos(a) * r, it.y * (1 + burst) + Math.sin(time * 0.6 + it.ph) * 0.25, Math.sin(a) * r);
        dummy.rotation.set(it.spin.x * time + it.ph, it.spin.y * time, it.spin.z * time);
        dummy.scale.setScalar(it.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /* metals */
  metals.visible = Math.abs(L(1)) < 1.4;
  if (metals.visible) {
    const p = smooth(-0.75, 0.05, L(1));
    metals.rotation.y = 0.6 + L(1) * 0.7 + time * 0.06;
    ingots.forEach((m, i) => {
      const k = easeOut(p * (ingots.length + 4) / 5 - i / 5), h = m.userData.home;
      m.position.set(h.x, h.y + (1 - k) * 9, h.z);
      m.rotation.set((1 - k) * m.userData.spin, (1 - k) * m.userData.spin * 0.7, 0);
      m.visible = k > 0.001;
    });
  }

  /* pcb */
  pcb.visible = Math.abs(L(2)) < 1.4;
  if (pcb.visible) {
    const e = smooth(-0.35, 0.25, L(2)) * (1 - smooth(0.6, 1.1, L(2)));
    pcb.rotation.set(0.12, -0.5 + L(2) * 0.9 + time * 0.05, 0);
    copperPlane.position.y = -0.09 - e * 1.1;
    traceLayer.position.y = 0.07 + e * 0.9;
    compLayer.position.y = 0.06 + e * 2.0;
    traceMat.emissiveIntensity = 0.7 + Math.sin(time * 2.4) * 0.35 + e * 0.8;
  }

  /* wires */
  wires.visible = Math.abs(L(3)) < 1.4;
  if (wires.visible) {
    const s = smooth(-0.5, 0.35, L(3));
    wires.rotation.set(time * 0.12 + L(3) * 1.2, 0.25, 0);
    for (const { jacket, delay } of cables) {
      const k = clamp(s * 1.5 - delay * 0.5) * 0.62;
      const cut = Math.floor(TUBE_SEG * k) * RAD_SEG * 6;
      jacket.geometry.setDrawRange(cut, TUBE_SEG * RAD_SEG * 6 - cut);
    }
  }

  /* tunnel */
  tunnel.visible = t > 2.8 && t < 10;
  if (tunnel.visible) {
    gates.forEach((gt, k) => {
      const act = clamp(1 - Math.abs(L(4 + k) + 0.15) * 1.1);
      gt.mat.emissiveIntensity = 0.55 + act * 1.1;
      gt.arc1.rotation.z = time * 0.5 + k;
      gt.arc2.rotation.z = -time * 0.8 + k * 2;
      gt.frame.rotation.z = time * 0.1 * (k % 2 ? -1 : 1);
      gt.g.scale.setScalar(1 + act * 0.06);
    });
  }

  /* globe */
  globe.visible = t > 7.6;
  if (globe.visible) {
    planet.rotation.y = time * 0.12;
    orbits.forEach((o) => { o.pivot.rotation.z = time * o.speed; });
  }

  /* chrome */
  if (Math.abs(t - lastT) > 1e-4) {
    lastT = t;
    progressBar.style.transform = `scaleX(${u})`;
    setChapter(+keyEls[clamp(Math.round(t), 0, N - 1)].dataset.chapter);
  }

  composer.render();
}

/* ------------------------------------------------------------------ *
 *  Boot
 * ------------------------------------------------------------------ */
frame(); // compile shaders behind the loader
const loaderNum = $('#loader-num');
const bootAt = performance.now();
(function boot(now) {
  const k = clamp((now - bootAt) / 1100);
  loaderNum.textContent = Math.round(easeOut(k) * 100);
  if (k < 1) return requestAnimationFrame(boot);
  document.body.classList.remove('loading');
  started = true;
  measure();
  clock.getDelta();
  renderer.setAnimationLoop(frame);
})(bootAt);
