/* ------------------------------------------------------------------ *
 *  Scroll-driven system diagram. Inside a pinned section, scrolling
 *  carries one glowing packet along ROUTE, lighting each connection it
 *  travels and each node it reaches, while the matching caption from
 *  [data-flow-steps] comes forward.
 *
 *  The diagram is generated from NODES, EDGES and ROUTE below, in two
 *  layouts: "wide" for landscape screens and "tall" for phones.
 *  Edit the labels and positions here to describe your own stack.
 * ------------------------------------------------------------------ */
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const NODES = {
  ui:   { label: 'Your UI',  sub: 'React · Vue · Svelte', kind: 'ui' },
  api:  { label: 'API',      sub: 'REST · GraphQL',       kind: 'api' },
  auth: { label: 'Auth',     sub: 'Sessions · roles',     kind: 'svc' },
  pay:  { label: 'Payments', sub: 'Billing · invoices',   kind: 'svc' },
  jobs: { label: 'Jobs',     sub: 'Email · webhooks',     kind: 'svc' },
  db:   { label: 'Database', sub: 'PostgreSQL',           kind: 'db' },
};
const EDGES = [['ui', 'api'], ['api', 'auth'], ['api', 'pay'], ['api', 'jobs'], ['auth', 'db'], ['pay', 'db'], ['jobs', 'db']];

/* The packet's journey. `step` is the caption (0-based) shown while that hop is travelled. */
const ROUTE = [
  { from: 'ui',   to: 'api',  step: 0 },
  { from: 'api',  to: 'auth', step: 1 },
  { from: 'auth', to: 'api',  step: 1 },
  { from: 'api',  to: 'pay',  step: 2 },
  { from: 'pay',  to: 'db',   step: 2 },
  { from: 'db',   to: 'jobs', step: 3 },
  { from: 'jobs', to: 'api',  step: 3 },
  { from: 'api',  to: 'ui',   step: 4 },
];

const LAYOUTS = {
  wide: { w: 1000, h: 470, node: [176, 78], pos: { ui: [110, 235], api: [390, 235], auth: [640, 80], pay: [640, 235], jobs: [640, 390], db: [885, 235] } },
  tall: { w: 520, h: 820, node: [160, 74], pos: { ui: [260, 70], api: [260, 270], auth: [92, 500], pay: [260, 500], jobs: [428, 500], db: [260, 735] } },
};

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  parent?.appendChild(node);
  return node;
}

/* A smooth curve between two node centres; the bend follows whichever direction dominates */
function curve([ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  if (Math.abs(dx) >= Math.abs(dy)) return `M${ax} ${ay} C${ax + dx * 0.5} ${ay} ${bx - dx * 0.5} ${by} ${bx} ${by}`;
  return `M${ax} ${ay} C${ax} ${ay + dy * 0.5} ${bx} ${by - dy * 0.5} ${bx} ${by}`;
}

function buildLayout(name, spec) {
  const svg = el('svg', { viewBox: `0 0 ${spec.w} ${spec.h}`, class: `flow-svg flow-${name}` });
  const defs = el('defs', {}, svg);
  const glow = el('radialGradient', { id: `flow-glow-${name}` }, defs);
  el('stop', { offset: '0', style: 'stop-color: var(--fg)' }, glow);
  el('stop', { offset: '.35', style: 'stop-color: var(--accent)' }, glow);
  el('stop', { offset: '1', style: 'stop-color: var(--accent); stop-opacity: 0' }, glow);

  const base = el('g', { class: 'flow-base' }, svg);
  EDGES.forEach(([a, b]) => el('path', { d: curve(spec.pos[a], spec.pos[b]) }, base));
  const lit = el('g', { class: 'flow-lit' }, svg);
  const hops = ROUTE.map((r) => {
    const path = el('path', { d: curve(spec.pos[r.from], spec.pos[r.to]) }, lit);
    return { ...r, path, len: 1, shown: -1 };
  });
  const packet = el('g', { class: 'flow-packet' }, svg);
  el('circle', { r: 30, fill: `url(#flow-glow-${name})` }, packet);
  el('circle', { r: 6, class: 'core' }, packet);

  const nodes = {};
  const [nw, nh] = spec.node;
  Object.entries(NODES).forEach(([id, n]) => {
    const [x, y] = spec.pos[id];
    const g = el('g', { class: `flow-node kind-${n.kind}`, transform: `translate(${x - nw / 2} ${y - nh / 2})` }, svg);
    el('rect', { width: nw, height: nh, rx: 6 }, g);
    if (n.kind === 'ui') { el('circle', { cx: 14, cy: 13, r: 3 }, g); el('circle', { cx: 25, cy: 13, r: 3 }, g); el('circle', { cx: 36, cy: 13, r: 3 }, g); }
    if (n.kind === 'db') { el('ellipse', { cx: nw - 22, cy: 22, rx: 10, ry: 4, class: 'icon' }, g); el('path', { d: `M${nw - 32} 22v14c0 2.2 4.5 4 10 4s10-1.8 10-4V22`, class: 'icon' }, g); }
    const label = el('text', { x: 16, y: nh / 2 + 4, class: 'label' }, g);
    label.textContent = n.label;
    const sub = el('text', { x: 16, y: nh / 2 + 24, class: 'sub' }, g);
    sub.textContent = n.sub;
    nodes[id] = g;
  });
  /* the UI node shows the result once the packet comes home */
  const [ux, uy] = spec.pos.ui;
  const done = el('g', { class: 'flow-done', transform: `translate(${ux} ${uy - nh / 2 - 22})` }, svg);
  el('rect', { x: -84, y: -17, width: 168, height: 30, rx: 15 }, done);
  const doneText = el('text', { x: 0, y: 3, 'text-anchor': 'middle' }, done);
  doneText.textContent = '✓ Order confirmed';

  return { svg, hops, packet, nodes, done, name };
}

export function initFlows() {
  return [...document.querySelectorAll('[data-flow]')].map((stage) => {
    const section = stage.closest('[data-pin]') || stage;
    const steps = [...(section.querySelector('[data-flow-steps]')?.children || [])];
    const layouts = Object.entries(LAYOUTS).map(([name, spec]) => {
      const built = buildLayout(name, spec);
      stage.appendChild(built.svg);
      return built;
    });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const box = { top: 0, height: 1 };
    let lastStep = -1, lastP = -1;
    /* which layout shows comes from the same media query as the CSS, so nothing is measured per frame */
    const tallMQ = matchMedia('(max-aspect-ratio: 1/1)');
    tallMQ.addEventListener?.('change', () => { lastP = -1; layouts.forEach((l) => l.hops.forEach((h) => { h.shown = -1; })); });

    function measure() {
      const r = section.getBoundingClientRect();
      box.top = r.top + window.scrollY; box.height = r.height;
      layouts.forEach((l) => l.hops.forEach((h) => {
        h.len = h.path.getTotalLength() || 1;
        h.path.style.strokeDasharray = `${h.len} ${h.len}`;
        h.shown = -1;
      }));
      lastP = -1;
    }

    function update(y, vh) {
      if (y + vh < box.top || y > box.top + box.height) return;
      const raw = clamp((y - box.top) / Math.max(1, box.height - vh));
      const p = Math.round(clamp((raw - 0.04) / 0.88) * 2000) / 2000;     // short hold at both ends
      if (p === lastP) return;
      lastP = p;
      const travel = p * ROUTE.length;
      const hop = Math.min(ROUTE.length - 1, Math.floor(travel));
      const t = reduced ? 1 : travel - hop;

      layouts.forEach((l) => {
        if ((l.name === 'tall') !== tallMQ.matches) return;               // this layout is hidden at this width
        l.hops.forEach((h, k) => {
          const shown = k < hop ? 1 : k === hop ? t : 0;
          if (Math.abs(shown - h.shown) < 0.001) return;
          h.shown = shown;
          h.path.style.strokeDashoffset = h.len * (1 - shown);
        });
        const h = l.hops[hop];
        const pt = h.path.getPointAtLength(h.len * t);
        l.packet.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        l.packet.classList.toggle('off', p >= 0.999);
        /* a node lights up once the packet has reached it, and glows while the packet is inside */
        const reached = new Set(['ui']);
        ROUTE.forEach((r, k) => { if (k < hop || (k === hop && t > 0.92)) reached.add(r.to); });
        Object.entries(l.nodes).forEach(([id, g]) => {
          g.classList.toggle('on', reached.has(id));
          g.classList.toggle('hot', (h.to === id && t > 0.85) || (h.from === id && t < 0.15));
        });
        l.done.classList.toggle('show', p >= 0.97);
      });

      const step = ROUTE[hop].step;
      if (step !== lastStep) {
        lastStep = step;
        steps.forEach((s, k) => { s.classList.toggle('on', k === step); s.classList.toggle('past', k < step); });
      }
    }

    measure();
    return { measure, update };
  });
}
