/* ------------------------------------------------------------------ *
 *  Bootstrap: wires the DOM layer (ui.js) to the 3D world (world.js)
 *  and runs the single animation loop that drives both.
 * ------------------------------------------------------------------ */
import { config } from './config.js';
import { initUI, items, state, scroll, pointer, $ } from './ui.js';
import { createWorld } from './world.js';
import { initFlows } from './flow.js';
import { initMotion } from './motion.js';

const canvas = $('#stage');
let world = null;

const ui = initUI({ onSkin: () => world?.readSkin(), onReady: () => world?.startIntro() });
world = createWorld(canvas, items, config);
if (!world) document.documentElement.classList.add('no-webgl');
const flows = initFlows();
initMotion(config);

/* The canvas is sized in CSS (100lvh), so mobile address-bar changes do not resize the scene */
let stageW = 0, stageH = 0;
function resize() {
  ui.measure();
  flows.forEach((f) => f.measure());
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  if (world && (w !== stageW || h !== stageH)) { stageW = w; stageH = h; world.resize(w, h); }
}
let resizeQueued = false;
const queueResize = () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; resize(); });
};
window.addEventListener('resize', queueResize);
window.addEventListener('load', queueResize);
document.fonts?.ready.then(queueResize);                 // web fonts change text widths when they arrive
if ('ResizeObserver' in window) new ResizeObserver(queueResize).observe($('#main'));   // fonts, accordions, late layout
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  ui.update(dt);
  flows.forEach((f) => f.update(scroll.raw, scroll.vh));
  world?.update(dt, now / 1000, { st: state, velocity: scroll.v, progress: scroll.progress || 0, pointer });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* Lift the loader once fonts are in (or after a short grace period) and a first frame is drawn */
const fonts = document.fonts?.ready ?? Promise.resolve();
Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  resize();
  world?.warmUp();
  requestAnimationFrame(() => ui.finishLoading());
});
