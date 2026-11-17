/* ------------------------------------------------------------------ *
 *  The 3D world: one particle sculpture that morphs from shape to shape
 *  as the page scrolls, plus scenery that belongs to single shapes (an
 *  orb, network arcs, a wireframe website, a chart floor), wireframe
 *  solids drifting past in depth, dust and a soft backdrop.
 *  Colours come from the CSS skin, the shape sequence from the
 *  [data-shape] sections in index.html.
 * ------------------------------------------------------------------ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SHAPES, SCREEN_LAYERS, buildShape, mulberry32 } from './shapes.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (rate, dt) => 1 - Math.exp(-dt * rate);
const TAU = Math.PI * 2;
const FOV = 42;

/* 3D simplex noise by Ian McEwan, Ashima Arts (MIT) */
const SNOISE = /* glsl */`
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

export function createWorld(canvas, items, config) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    return null;                                   // no WebGL: the page falls back to a CSS backdrop
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(pointer: coarse)').matches || innerWidth < 860;
  const COUNT = small ? config.particles.mobile : config.particles.desktop;
  let dpr = Math.min(window.devicePixelRatio || 1, small ? (config.maxPixelRatioMobile || 1.25) : config.maxPixelRatio);
  let width = 1, height = 1, aspect = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 160);
  const rig = new THREE.Group();                   // everything that belongs to the sculpture
  rig.rotation.order = 'XZY';
  scene.add(rig);

  /* ---- uniforms shared by every material ---- */
  const U = {
    uTime: { value: 0 }, uScale: { value: 1 }, uAspect: { value: 1 }, uP: { value: 0 },
    uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uBg: { value: new THREE.Color() },
    uInk: { value: 0 },
  };
  const theme = { a: new THREE.Color(), b: new THREE.Color(), bg: new THREE.Color(), ink: 0, ready: false };
  const blended = [];                              // materials that switch between light (additive) and ink (normal)

  /* ---- backdrop: skin colour, two slow glows, vignette, grain ---- */
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uTime: U.uTime, uAspect: U.uAspect, uP: U.uP, uA: U.uA, uB: U.uB, uBg: U.uBg, uInk: U.uInk },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uAspect, uP, uInk; uniform vec3 uA, uB, uBg; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        vec2 c1 = vec2(0.55 * sin(uP * 0.9 + 0.6 + uTime * 0.03), 0.3 * cos(uP * 0.7));
        vec2 c2 = vec2(-0.6 * cos(uP * 0.6 + 1.0), -0.34 * sin(uP * 0.8 + 2.0 + uTime * 0.02));
        float g1 = exp(-dot(p - c1, p - c1) * 2.6), g2 = exp(-dot(p - c2, p - c2) * 3.4);
        vec3 col = mix(uBg, uA, g1 * mix(0.05, 0.16, uInk));
        col = mix(col, uB, g2 * mix(0.035, 0.12, uInk));
        col *= 1.0 - dot(p, p) * mix(0.42, 0.06, uInk);
        col += (hash(vUv * 913.0 + fract(uTime)) - 0.5) * 0.006;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  backdrop.frustumCulled = false; backdrop.renderOrder = -10;
  scene.add(backdrop);

  /* ---- the particle sculpture ---- */
  const shapeAttr = {};
  const attrFor = (name) => (shapeAttr[name] ||= new THREE.BufferAttribute(buildShape(name, COUNT), 3));
  items.forEach((it) => { it.meta = SHAPES[it.shape] || SHAPES.cloud; attrFor(it.shape); });

  const rnd = mulberry32(99);
  const rand = new Float32Array(COUNT * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = rnd();
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', attrFor(items[0].shape));
  pGeo.setAttribute('aTo', attrFor(items[Math.min(1, items.length - 1)].shape));
  pGeo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));

  const pU = {
    ...U, uMix: { value: 0 }, uSize: { value: config.particles.size }, uChaos: { value: 0 },
    uPush: { value: 0 }, uOpacity: { value: 1 }, uPointer: { value: new THREE.Vector3(99, 99, 99) },
    uIntro: { value: reduced ? 1 : 0 }, uDepth: { value: 1 }, uWave: { value: 0 }, uFly: { value: reduced ? 0 : 1 },
    uShockPos: { value: new THREE.Vector3() }, uShockT: { value: 99 }, uMaxPoint: { value: 96 },
  };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aTo; attribute vec4 aRand;
      uniform float uMix, uTime, uSize, uScale, uChaos, uPush, uOpacity, uInk, uIntro, uDepth, uWave, uFly, uShockT, uMaxPoint;
      uniform vec3 uPointer, uShockPos, uA, uB;
      varying vec3 vColor; varying float vAlpha;
      void main(){
        float r2 = fract(aRand.w * 7.31 + aRand.x * 3.17);
        /* each particle leaves a little earlier or later than its neighbours */
        float m = clamp(uMix * 1.5 - aRand.x * 0.5, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 p = mix(position, aTo, m);
        p.z *= uDepth;                                               /* layered shapes spread in depth */
        p.y += sin(p.x * 0.9 + uTime * 0.9) * cos(p.z * 0.7 + uTime * 0.6) * 0.24 * uWave;
        float burst = sin(m * 3.14159265);
        float a = burst * (aRand.y - 0.5) * 2.4, c = cos(a), s = sin(a);
        p.xz = mat2(c, -s, s, c) * p.xz;
        vec3 drift = vec3(sin(uTime * 0.7 + aRand.w * 6.283), cos(uTime * 0.6 + aRand.z * 6.283), sin(uTime * 0.5 + aRand.x * 6.283));
        p += drift * (0.03 + burst * (0.5 + aRand.z) * 0.62 + uChaos * 0.18 * aRand.y);
        p *= 1.0 + burst * 0.12;

        /* opening: the sculpture gathers out of a wide swirl */
        float k = 1.0 - uIntro;
        float ia = k * (1.5 + aRand.y * 4.0), ic = cos(ia), is = sin(ia);
        p.xz = mat2(ic, -is, is, ic) * p.xz;
        p *= 1.0 + k * (1.5 + aRand.x * 5.0);

        /* a click sends a ring through the sculpture */
        vec3 sv = p - uShockPos; float sd = length(sv);
        float ring = exp(-pow((sd - uShockT * 7.0) * 1.5, 2.0)) * exp(-uShockT * 1.5);
        p += (sv / max(sd, 0.001)) * ring * 0.85;
        /* the pointer pushes a soft dent into it */
        vec3 d = p - uPointer; float dl = length(d);
        p += (d / max(dl, 0.001)) * uPush * smoothstep(1.8, 0.0, dl) * 0.9;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        /* during a morph a few particles fly out past the camera */
        mv.z += burst * step(0.96, r2) * (2.0 + r2 * 4.5) * uFly;
        gl_Position = projectionMatrix * mv;
        float spark = step(0.985, aRand.z);
        gl_PointSize = clamp(uSize * (0.45 + aRand.y * 1.1) * (1.0 + spark * 1.2) * uScale / -mv.z, 1.0, uMaxPoint);
        float g = clamp(0.5 + p.y * 0.13 + p.x * 0.07 + (aRand.w - 0.5) * 0.5, 0.0, 1.0);
        vColor = mix(uA, uB, smoothstep(0.25, 0.75, g));
        vColor = mix(vColor, vec3(1.0), clamp(spark * 0.6 + ring * 0.7, 0.0, 1.0) * (1.0 - uInk));
        float near = smoothstep(0.4, 3.2, -mv.z);
        float depth = smoothstep(30.0, 5.0, -mv.z);
        float twinkle = 0.6 + 0.4 * sin(uTime * (0.6 + aRand.x) + aRand.w * 40.0);
        vAlpha = uOpacity * (0.3 + 0.7 * depth) * near * twinkle * (1.0 + ring * 1.4) * (0.25 + 0.75 * uIntro);
      }`,
    fragmentShader: /* glsl */`
      uniform float uInk; varying vec3 vColor; varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d); a *= a;
        gl_FragColor = vec4(vColor, a * vAlpha * mix(0.7, 0.85, uInk));
      }`,
  });
  blended.push(pMat);
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false; points.renderOrder = 2;
  rig.add(points);

  /* ---- line material shared by all wireframe scenery ---- */
  function lineMaterial(tone, fade = 0) {
    const uniforms = { ...U, uOpacity: { value: 0 }, uTone: { value: tone }, uFade: { value: fade } };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uFade; varying float vY; varying float vFade;
        void main(){
          vY = position.y;
          vFade = uFade > 0.0 ? smoothstep(uFade, uFade * 0.15, length(position.xz)) : 1.0;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade *= smoothstep(70.0, 14.0, -mv.z) * smoothstep(0.5, 4.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uA, uB; uniform float uOpacity, uTone; varying float vY; varying float vFade;
        void main(){ gl_FragColor = vec4(mix(uA, uB, uTone < 0.0 ? smoothstep(-2.0, 2.0, vY) : uTone), uOpacity * vFade); }`,
    });
    blended.push(mat);
    return mat;
  }
  const lines = (positions, material) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mesh = new THREE.LineSegments(geo, material);
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3;
    return mesh;
  };

  /* ---- extra: liquid orb at the heart of the "core" shape ---- */
  const orbU = { ...U, uDim: { value: 1 } };
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, small ? 16 : 28), new THREE.ShaderMaterial({
    uniforms: orbU,
    vertexShader: /* glsl */`
      uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vD;
      ${SNOISE}
      float field(vec3 p){ return snoise(p * 0.62 + vec3(0.0, uTime * 0.16, 0.0)) * 0.34 + snoise(p * 1.7 - uTime * 0.1) * 0.08; }
      vec3 bend(vec3 p){ return p + normalize(p) * field(p); }
      void main(){
        vec3 t = normalize(cross(normal, vec3(0.0, 1.0, 0.0) + normal.zxy * 0.01)); vec3 b = cross(normal, t);
        float r = length(position), e = 0.06;
        vec3 p0 = bend(position), p1 = bend(normalize(position + t * e) * r), p2 = bend(normalize(position + b * e) * r);
        vec3 n = normalize(cross(p1 - p0, p2 - p0));
        if (dot(n, normal) < 0.0) n = -n;
        vD = field(position);
        vec4 mv = modelViewMatrix * vec4(p0, 1.0);
        vN = normalize(normalMatrix * n); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA, uB, uBg; uniform float uInk, uDim; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){
        vec3 n = normalize(vN);
        float f = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4);
        vec3 rim = mix(uA, uB, smoothstep(-0.6, 0.6, n.y + vD * 2.0));
        float spec = pow(max(dot(n, normalize(vec3(0.5, 0.8, 0.6))), 0.0), 60.0);
        vec3 body = mix(uBg * 1.6 + 0.012, mix(uBg, vec3(1.0), 0.75), uInk);
        vec3 col = mix(body, rim, f * mix(1.0, 0.85, uInk)) + rim * f * f * mix(0.9, 0.0, uInk) + spec * mix(0.5, 0.25, uInk);
        gl_FragColor = vec4(mix(uBg, col, uDim), 1.0);
      }`,
  }));
  orb.visible = false;
  rig.add(orb);

  /* ---- extra: pulses travelling between points on the "globe" shape ---- */
  const arcsU = { ...U, uOpacity: { value: 0 } };
  const arcs = buildArcs();
  rig.add(arcs);
  function buildArcs() {
    const src = attrFor('globe').array, r2 = mulberry32(2024), ARCS = 22, SEG = 44;
    const pos = [], tt = [], seed = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
    const at = (t, lift, out) => out.copy(a).lerp(b, t).normalize().multiplyScalar(2.92 + Math.sin(t * Math.PI) * lift);
    for (let k = 0; k < ARCS; k++) {
      const land = Math.floor(COUNT * 0.8);
      a.fromArray(src, Math.floor(r2() * land) * 3).normalize();
      do { b.fromArray(src, Math.floor(r2() * land) * 3).normalize(); } while (a.dot(b) > 0.85 || a.dot(b) < -0.5);
      const lift = 0.25 + (1 - a.dot(b)) * 0.75, s = r2();
      for (let i = 0; i < SEG; i++) {
        at(i / SEG, lift, p); at((i + 1) / SEG, lift, q);
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z); tt.push(i / SEG, (i + 1) / SEG); seed.push(s, s);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: arcsU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aT, aSeed; uniform float uTime; varying float vGlow; varying float vT;
        void main(){
          float head = fract(uTime * (0.16 + aSeed * 0.12) + aSeed * 7.0);
          float trail = fract(head - aT);
          vGlow = 0.16 + pow(1.0 - trail, 7.0) * 1.6; vT = aT;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uA, uB; uniform float uOpacity, uInk; varying float vGlow; varying float vT;
        void main(){ gl_FragColor = vec4(mix(uA, uB, vT), clamp(vGlow, 0.0, 1.0) * uOpacity * mix(0.9, 1.0, uInk)); }`,
    });
    blended.push(mat);
    const mesh = new THREE.LineSegments(geo, mat);
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3;
    return mesh;
  }

  /* ---- extra: crisp outlines for the layered "screens" shape ---- */
  const wirePos = [];
  SCREEN_LAYERS.forEach(({ z, rects }) => rects.forEach(([x, y, w, h]) => {
    wirePos.push(x, y, z, x + w, y, z, x + w, y, z, x + w, y + h, z, x + w, y + h, z, x, y + h, z, x, y + h, z, x, y, z);
  }));
  /* faint struts tie the layers together so the depth reads at a glance */
  [[-3, -1.95], [3, -1.95], [3, 1.95], [-3, 1.95]].forEach(([x, y]) => wirePos.push(x, y, SCREEN_LAYERS[0].z, x * 0.9, y * 0.9, SCREEN_LAYERS[SCREEN_LAYERS.length - 1].z));
  const wire = lines(wirePos, lineMaterial(-1));
  rig.add(wire);

  /* ---- extra: floor grid under the "bars" chart ---- */
  const floorPos = [];
  for (let k = -8; k <= 8; k++) {
    const v = k * 0.92;
    for (let t = -8; t < 8; t++) {                 // short segments, so the edge fade has vertices to work with
      const a = t * 0.92, b = (t + 1) * 0.92;
      floorPos.push(v, -2.12, a, v, -2.12, b, a, -2.12, v, b, -2.12, v);
    }
  }
  const floor = lines(floorPos, lineMaterial(0.15, 7.4));
  rig.add(floor);

  /* ---- wireframe solids that drift past in depth as the page scrolls ---- */
  const props = new THREE.Group();
  scene.add(props);
  const SPAN = 74;
  {
    const solids = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.BoxGeometry(1.3, 1.3, 1.3),
      new THREE.TetrahedronGeometry(1.2, 0), new THREE.TorusGeometry(0.85, 0.32, 5, 9), new THREE.DodecahedronGeometry(1, 0)]
      .map((g) => new THREE.EdgesGeometry(g));
    const mats = [lineMaterial(0), lineMaterial(1)];
    const r3 = mulberry32(417), N = small ? 10 : 20;
    for (let k = 0; k < N; k++) {
      const mesh = new THREE.LineSegments(solids[k % solids.length], mats[k % 2]);
      mesh.userData = { x: (k % 2 ? 1 : -1) * (0.32 + r3() * 0.68), rx: (r3() - 0.5) * 0.5, ry: (r3() - 0.5) * 0.6 };
      mesh.position.set(0, 6 - ((k + r3()) / N) * (SPAN - 6), -2 - r3() * 16);
      mesh.scale.setScalar(0.5 + r3() * 1.3);
      mesh.rotation.set(r3() * TAU, r3() * TAU, 0);
      mesh.renderOrder = 1;
      props.add(mesh);
    }
    mats.forEach((m) => { m.uniforms.uOpacity.value = 0.34; });
  }

  /* ---- dust that streams past when the page scrolls ---- */
  const DUST = small ? 700 : 1500;
  const dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (rnd() * 2 - 1) * 26; dustPos[i * 3 + 1] = (rnd() * 2 - 1) * 16; dustPos[i * 3 + 2] = -46 + rnd() * 52;
    dustSeed[i] = rnd();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dustU = { ...U, uTravel: { value: 0 } };
  const dustMat = new THREE.ShaderMaterial({
    uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTravel, uScale; varying float vAlpha;
      void main(){
        vec3 p = position; p.z = mod(p.z + uTravel + 46.0, 52.0) - 46.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * 0.035 * (0.5 + aSeed) / -mv.z, 1.0, 40.0);
        vAlpha = smoothstep(-46.0, -34.0, p.z) * smoothstep(-0.5, -4.0, mv.z) * (0.2 + 0.5 * aSeed);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA; uniform float uInk; varying float vAlpha;
      void main(){
        float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(mix(mix(uA, vec3(1.0), 0.45), uA, uInk), a * vAlpha * mix(0.8, 0.5, uInk));
      }`,
  });
  blended.push(dustMat);
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false; dust.renderOrder = 1;
  scene.add(dust);

  /* ---- post-processing ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), config.bloom.strength, config.bloom.radius, config.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let bloomAllowed = true;

  /* ---- skin: read the CSS tokens, then ease the scene toward them ---- */
  function readSkin() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    theme.a.set(get('--accent', '#5cc8ff'));
    theme.b.set(get('--accent-2', '#ff7a45'));
    theme.bg.set(get('--bg', '#070a12'));
    theme.ink = get('--scene-additive', '1') === '0' ? 1 : 0;
    const blending = theme.ink ? THREE.NormalBlending : THREE.AdditiveBlending;
    blended.forEach((m) => { if (m.blending !== blending) { m.blending = blending; m.needsUpdate = true; } });
    bloom.enabled = bloomAllowed && !theme.ink;
    if (!theme.ready) {
      U.uA.value.copy(theme.a); U.uB.value.copy(theme.b); U.uBg.value.copy(theme.bg); U.uInk.value = theme.ink;
      theme.ready = true;
    }
  }
  readSkin();

  let wide = 1;                                    // 1 on landscape screens, 0 on portrait ones
  function resize(w, h) {
    width = w; height = h; aspect = w / h;
    wide = smooth(clamp((aspect - 0.95) / 0.5));
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    U.uAspect.value = aspect;
    U.uScale.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));   // matches the lens in use
    pU.uMaxPoint.value = 30 * dpr;                  // no single sprite may grow large enough to cost a frame
    const spread = clamp(aspect * 9.5, 4.5, 16);
    props.children.forEach((m) => { m.position.x = m.userData.x * spread; });
  }

  /* ---- adaptive quality: step down if the GPU cannot hold a steady frame rate ---- */
  const perf = { frames: 0, time: 0, level: 0, warm: 40 };
  function watchPerformance(dt) {
    if (perf.level >= 3 || dt > 0.25) return;
    if (perf.warm > 0) { perf.warm--; return; }
    perf.frames++; perf.time += dt;
    if (perf.frames < 40) return;
    const avg = perf.time / perf.frames;
    perf.frames = 0; perf.time = 0;
    if (avg < 1 / 48) return;
    perf.level++; perf.warm = 30;
    if (perf.level === 1) dpr = Math.min(dpr, 1);
    else if (perf.level === 2) { bloomAllowed = false; bloom.enabled = false; }
    else dpr = 0.75;
    resize(width, height);
  }

  /* compile every shader up front so nothing hitches the first time it scrolls into view */
  function warmUp() {
    const hidden = [orb, arcs, wire, floor].filter((o) => !o.visible);
    hidden.forEach((o) => { o.visible = true; });
    try { renderer.compile(scene, camera); } catch (err) { /* compile is only an optimisation */ }
    hidden.forEach((o) => { o.visible = false; });
  }

  /* ---- per-frame update ---- */
  const ray = new THREE.Vector3(), hit = new THREE.Vector3();
  const toRig = (x, y, out) => {                   // screen point -> sculpture space, on the plane facing the camera
    ray.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    hit.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);
    return out.copy(rig.worldToLocal(hit));
  };
  const turnOf = (it, running) => (it.meta.yaw === undefined ? 0 : TAU * Math.round((running - it.meta.yaw) / TAU));
  const angleOf = (it, local, running, turn) => (it.meta.yaw === undefined ? running + local * 1.5 : it.meta.yaw + local * (it.meta.sweep || 0) + turn);
  const depthOf = (it, local) => (it.meta.explode ? lerp(0.3, 1.3, local) : 1);
  let current = -1, spin = 0, push = 0, warp = 0, turnA = 0, turnB = 0, clicksSeen = 0;
  let intro = reduced ? 1 : 0, introRunning = false;
  const look = { x: 0, y: 0 };

  function update(dt, time, { st, velocity, progress, pointer }) {
    const n = items.length;
    const i = clamp(st.i, 0, n - 1), j = Math.min(i + 1, n - 1);
    const changed = i !== current;
    if (changed) {
      current = i;
      pGeo.setAttribute('position', attrFor(items[i].shape));
      pGeo.setAttribute('aTo', attrFor(items[j].shape));
    }
    const A = items[i], B = items[j];
    const f = clamp((st.f - 0.1) / 0.8);             // hold each shape a little at both ends
    const e = smooth(f);
    const pulse = Math.sin(f * Math.PI);
    const localA = st.local, localB = 0;

    if (introRunning) { intro = Math.min(1, intro + dt / 2.6); introRunning = intro < 1; }
    const introEase = 1 - Math.pow(1 - intro, 3);

    U.uTime.value = time * (reduced ? 0.25 : 1);
    U.uP.value = i + e;
    pU.uMix.value = f;
    pU.uIntro.value = introEase;
    pU.uChaos.value = lerp(pU.uChaos.value, reduced ? 0 : clamp(Math.abs(velocity) / 2600), ease(5, dt));
    pU.uShockT.value += dt;

    /* skin easing */
    const k = ease(4, dt);
    U.uA.value.lerp(theme.a, k); U.uB.value.lerp(theme.b, k); U.uBg.value.lerp(theme.bg, k);
    U.uInk.value = lerp(U.uInk.value, theme.ink, k);

    /* framing: wide screens park the sculpture beside the copy, tall screens lift, shrink and dim it */
    const fit = clamp(0.64 / aspect, 1, 1.6);
    const zoom = lerp(A.zoom, B.zoom, e) * fit + pulse * 1.1 + (1 - introEase) * 9;
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * zoom;
    rig.position.x = lerp(A.side, B.side, e) * halfH * aspect * 0.5 * wide;
    rig.position.y = (1 - wide) * halfH * lerp(A.lift, B.lift, e);
    pU.uOpacity.value = lerp(A.dim, B.dim, e) * lerp(0.44, 1, wide);

    /* rotation: free shapes keep spinning, shapes with a yaw face the camera and sweep with the scroll */
    spin += dt * lerp(A.meta.spin, B.meta.spin, e) * (reduced ? 0.2 : 1);
    const running = spin + (i + e) * 0.9;
    if (changed || f === 0) { turnA = turnOf(A, running); turnB = turnOf(B, running); }
    look.x = lerp(look.x, pointer.x, ease(3, dt));
    look.y = lerp(look.y, pointer.y, ease(3, dt));
    rig.rotation.set(
      lerp(A.meta.tilt, B.meta.tilt, e) - look.y * 0.12,
      lerp(angleOf(A, localA, running, turnA), angleOf(B, localB, running, turnB), e) + look.x * 0.22,
      lerp(A.meta.roll, B.meta.roll, e),
    );
    const depth = lerp(depthOf(A, localA), depthOf(B, localB), e);
    pU.uDepth.value = depth;

    /* camera: pointer parallax, a roll through each morph, and a wider lens at speed */
    warp = lerp(warp, reduced ? 0 : clamp(Math.abs(velocity) / 3200), ease(4, dt));
    const fov = FOV + warp * 6 + (1 - introEase) * 14;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov; camera.updateProjectionMatrix();
      U.uScale.value = (height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));   // particles keep their size as the lens widens
    }
    camera.position.set(look.x * 0.7, look.y * 0.45, zoom);
    camera.lookAt(look.x * 0.12, look.y * 0.08, 0);
    camera.rotation.z += pulse * 0.035 * (i % 2 ? -1 : 1);

    /* extras fade with the shapes that own them */
    const weight = (name) => (A === B ? +(A.meta.extra === name) : (A.meta.extra === name ? 1 - e : 0) + (B.meta.extra === name ? e : 0));
    const shown = pU.uOpacity.value * introEase;
    const wOrb = weight('orb'), wArcs = weight('arcs'), wWire = weight('wire'), wFloor = weight('floor');
    orb.visible = wOrb > 0.002;
    orbU.uDim.value = lerp(0.5, 1, wide);
    if (orb.visible) orb.scale.setScalar(smooth(wOrb) * introEase * (1 + Math.sin(time * 0.8) * 0.015));
    arcs.visible = wArcs > 0.002;
    arcsU.uOpacity.value = wArcs * wArcs * shown;
    wire.visible = wWire > 0.002;
    wire.scale.z = depth;
    wire.material.uniforms.uOpacity.value = wWire * wWire * wWire * shown * 0.75;
    floor.visible = wFloor > 0.002;
    floor.material.uniforms.uOpacity.value = wFloor * wFloor * shown * 0.5;
    pU.uWave.value = (A.shape === 'wave' ? 1 - e : 0) + (B.shape === 'wave' && A !== B ? e : 0);

    /* solids travel up through the frame as the page goes down */
    props.position.y = progress * SPAN;
    if (!reduced) props.children.forEach((m) => { m.rotation.x += dt * m.userData.rx; m.rotation.y += dt * m.userData.ry; });

    /* pointer dent and click ring */
    rig.updateMatrixWorld();
    push = lerp(push, pointer.active && !reduced ? 1 : 0, ease(4, dt));
    pU.uPush.value = push * (1 - pulse);
    if (push > 0.01) toRig(pointer.x, pointer.y, pU.uPointer.value);
    if (pointer.clicks !== clicksSeen) {
      clicksSeen = pointer.clicks;
      if (!reduced) { toRig(pointer.clickX, pointer.clickY, pU.uShockPos.value); pU.uShockT.value = 0; }
    }

    dustU.uTravel.value += dt * (0.5 + (reduced ? 0 : clamp(velocity * 0.0045, -14, 14)));

    composer.render();
    watchPerformance(dt);
  }

  return {
    update, resize, readSkin, warmUp,
    startIntro() { if (!reduced) introRunning = true; },
    count: COUNT,
  };
}
