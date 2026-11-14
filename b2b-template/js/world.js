/* ------------------------------------------------------------------ *
 *  The 3D world: one particle sculpture that morphs from shape to shape
 *  as the page scrolls, plus an orb, network arcs, drifting dust and a
 *  soft backdrop. Colours come from the CSS skin, the shape sequence
 *  from the [data-shape] sections in index.html.
 * ------------------------------------------------------------------ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SHAPES, buildShape, mulberry32 } from './shapes.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
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
  let dpr = Math.min(window.devicePixelRatio || 1, config.maxPixelRatio);
  let width = 1, height = 1, aspect = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 140);
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
  };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aTo; attribute vec4 aRand;
      uniform float uMix, uTime, uSize, uScale, uChaos, uPush, uOpacity, uInk;
      uniform vec3 uPointer, uA, uB;
      varying vec3 vColor; varying float vAlpha;
      void main(){
        /* each particle leaves a little earlier or later than its neighbours */
        float m = clamp(uMix * 1.5 - aRand.x * 0.5, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 p = mix(position, aTo, m);
        float burst = sin(m * 3.14159265);
        float a = burst * (aRand.y - 0.5) * 3.2, c = cos(a), s = sin(a);
        p.xz = mat2(c, -s, s, c) * p.xz;
        vec3 drift = vec3(sin(uTime * 0.7 + aRand.w * 6.283), cos(uTime * 0.6 + aRand.z * 6.283), sin(uTime * 0.5 + aRand.x * 6.283));
        p += drift * (0.03 + burst * (0.5 + aRand.z) * 0.9 + uChaos * 0.22 * aRand.y);
        p *= 1.0 + burst * 0.16;
        /* the pointer pushes a soft dent into the sculpture */
        vec3 d = p - uPointer; float dl = length(d);
        p += (d / max(dl, 0.001)) * uPush * smoothstep(1.8, 0.0, dl) * 0.9;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float spark = step(0.985, aRand.z);
        gl_PointSize = max(uSize * (0.45 + aRand.y * 1.1) * (1.0 + spark * 1.2) * uScale / -mv.z, 1.0);
        float g = clamp(0.5 + p.y * 0.13 + p.x * 0.07 + (aRand.w - 0.5) * 0.5, 0.0, 1.0);
        vColor = mix(uA, uB, smoothstep(0.25, 0.75, g));
        vColor = mix(vColor, vec3(1.0), spark * 0.6 * (1.0 - uInk));
        float depth = smoothstep(30.0, 5.0, -mv.z);
        float twinkle = 0.6 + 0.4 * sin(uTime * (0.6 + aRand.x) + aRand.w * 40.0);
        vAlpha = uOpacity * (0.3 + 0.7 * depth) * twinkle;
      }`,
    fragmentShader: /* glsl */`
      uniform float uInk; varying vec3 vColor; varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d); a *= a;
        gl_FragColor = vec4(vColor, a * vAlpha * mix(0.7, 0.85, uInk));
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false; points.renderOrder = 2;
  rig.add(points);

  /* ---- extra: liquid orb at the heart of the "core" shape ---- */
  const orbU = { ...U, uDim: { value: 1 } };
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, small ? 24 : 40), new THREE.ShaderMaterial({
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
    const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
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
    }));
    lines.frustumCulled = false; lines.visible = false; lines.renderOrder = 3;
    return lines;
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
        gl_PointSize = max(uScale * 0.035 * (0.5 + aSeed) / -mv.z, 1.0);
        vAlpha = smoothstep(-46.0, -34.0, p.z) * smoothstep(6.0, 1.0, p.z) * (0.2 + 0.5 * aSeed);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA; uniform float uInk; varying float vAlpha;
      void main(){
        float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(mix(mix(uA, vec3(1.0), 0.45), uA, uInk), a * vAlpha * mix(0.8, 0.5, uInk));
      }`,
  });
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
    [pMat, dustMat, arcs.material].forEach((m) => { m.blending = blending; m.needsUpdate = true; });
    bloom.enabled = bloomAllowed && !theme.ink;
    if (!theme.ready) {
      U.uA.value.copy(theme.a); U.uB.value.copy(theme.b); U.uBg.value.copy(theme.bg); U.uInk.value = theme.ink;
      theme.ready = true;
    }
  }
  readSkin();

  function resize(w, h) {
    width = w; height = h; aspect = w / h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    U.uAspect.value = aspect;
    U.uScale.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
  }

  /* ---- adaptive quality: step down if the GPU cannot hold ~35 fps ---- */
  const perf = { frames: 0, time: 0, level: 0, warm: 45 };
  function watchPerformance(dt) {
    if (perf.level >= 3 || dt > 0.25) return;
    if (perf.warm > 0) { perf.warm--; return; }
    perf.frames++; perf.time += dt;
    if (perf.frames < 70) return;
    const avg = perf.time / perf.frames;
    perf.frames = 0; perf.time = 0;
    if (avg < 1 / 35) return;
    perf.level++; perf.warm = 30;
    if (perf.level === 1) dpr = Math.min(dpr, 1);
    else if (perf.level === 2) { bloomAllowed = false; bloom.enabled = false; }
    else dpr = 0.75;
    resize(width, height);
  }

  /* ---- per-frame update ---- */
  const ray = new THREE.Vector3(), hit = new THREE.Vector3();
  let current = -1, spin = 0, push = 0;
  const look = { x: 0, y: 0 };

  function update(dt, time, st, scrollVelocity, pointer) {
    const n = items.length;
    const i = clamp(st.i, 0, n - 1), j = Math.min(i + 1, n - 1);
    if (i !== current) {
      current = i;
      pGeo.setAttribute('position', attrFor(items[i].shape));
      pGeo.setAttribute('aTo', attrFor(items[j].shape));
    }
    const A = items[i], B = items[j];
    const f = clamp((st.f - 0.1) / 0.8);             // hold each shape a little at both ends
    const e = smooth(f);
    const pulse = Math.sin(f * Math.PI);

    U.uTime.value = time * (reduced ? 0.25 : 1);
    U.uP.value = i + e;
    pU.uMix.value = f;
    pU.uChaos.value = lerp(pU.uChaos.value, reduced ? 0 : clamp(Math.abs(scrollVelocity) / 2600), 1 - Math.exp(-dt * 5));

    /* skin easing */
    const k = 1 - Math.exp(-dt * 4);
    U.uA.value.lerp(theme.a, k); U.uB.value.lerp(theme.b, k); U.uBg.value.lerp(theme.bg, k);
    U.uInk.value = lerp(U.uInk.value, theme.ink, k);

    /* framing: wide screens park the sculpture beside the copy, tall screens centre and dim it */
    const wide = smooth(clamp((aspect - 0.95) / 0.5));
    const fit = clamp(0.64 / aspect, 1, 1.6);
    const zoom = lerp(A.zoom, B.zoom, e) * fit + pulse * 1.7;
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * zoom;
    rig.position.x = lerp(A.side, B.side, e) * halfH * aspect * 0.5 * wide;
    rig.position.y = (1 - wide) * halfH * 0.16;
    pU.uOpacity.value = lerp(A.dim, B.dim, e) * lerp(0.5, 1, wide);

    spin += dt * lerp(A.meta.spin, B.meta.spin, e) * (reduced ? 0.2 : 1);
    look.x = lerp(look.x, pointer.x, 1 - Math.exp(-dt * 3));
    look.y = lerp(look.y, pointer.y, 1 - Math.exp(-dt * 3));
    rig.rotation.set(
      lerp(A.meta.tilt, B.meta.tilt, e) - look.y * 0.1,
      spin + (i + e) * 0.9 + st.local * 1.5 + look.x * 0.18,
      lerp(A.meta.roll, B.meta.roll, e),
    );

    camera.position.set(look.x * 0.55, look.y * 0.35, zoom);
    camera.lookAt(look.x * 0.12, look.y * 0.08, 0);
    camera.rotation.z += pulse * 0.07 * (i % 2 ? -1 : 1);

    /* extras fade with the shapes that own them */
    const weight = (name) => (A === B ? +(A.meta.extra === name) : (A.meta.extra === name ? 1 - e : 0) + (B.meta.extra === name ? e : 0));
    const wOrb = weight('orb'), wArcs = weight('arcs');
    orb.visible = wOrb > 0.002;
    orbU.uDim.value = lerp(0.55, 1, wide);
    if (orb.visible) orb.scale.setScalar(smooth(wOrb) * (1 + Math.sin(time * 0.8) * 0.015));
    arcs.visible = wArcs > 0.002;
    arcsU.uOpacity.value = wArcs * wArcs * pU.uOpacity.value;

    /* pointer dent */
    rig.updateMatrixWorld();
    push = lerp(push, pointer.active && !reduced ? 1 : 0, 1 - Math.exp(-dt * 4));
    pU.uPush.value = push * (1 - pulse);
    if (push > 0.01) {
      ray.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize();
      hit.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);
      pU.uPointer.value.copy(rig.worldToLocal(hit));
    }

    dustU.uTravel.value += dt * (0.5 + (reduced ? 0 : clamp(scrollVelocity * 0.0045, -14, 14)));

    composer.render();
    watchPerformance(dt);
  }

  return { update, resize, readSkin, count: COUNT };
}
