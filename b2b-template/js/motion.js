/* ------------------------------------------------------------------ *
 *  Motion graphics and conversion helpers:
 *  - [data-rotator]   cycles headline words like a slot machine
 *  - .eyebrow         labels decode from random characters when they appear
 *  - [data-play]      CSS loops that only run while on screen
 *  - #estimator       live project estimate with an assembling 3D stack
 *  - #dock-cta        call to action that stays in reach on phones
 * ------------------------------------------------------------------ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initMotion(config) {
  /* ---- rotating headline word ---- */
  $$('[data-rotator]').forEach((rot) => {
    const words = [...rot.children];
    if (reduced || words.length < 2) return;
    let k = 0;
    setInterval(() => {
      if (document.hidden) return;
      words[k].classList.remove('on'); words[k].classList.add('out');
      const old = words[k];
      setTimeout(() => old.classList.remove('out'), 900);      // after its exit it waits below, unseen
      k = (k + 1) % words.length;
      words[k].classList.add('on');
    }, 2400);
  });

  /* ---- eyebrow labels decode into place ---- */
  if (!reduced) initDecode();

  /* ---- loops that only play while visible ---- */
  const playIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('play', e.isIntersecting));
  }, { rootMargin: '10% 0px' });
  $$('[data-play]').forEach((el) => playIO.observe(el));

  /* ---- estimator ---- */
  const form = $('#estimator');
  if (form) initEstimator(form, config.estimator || {});

  /* ---- phone call-to-action dock: shows after the hero, hides near the estimator and the form ---- */
  const dock = $('#dock-cta');
  if (dock) {
    const away = new Set();
    const targets = ['#top', '#builder', '#contact'].map((s) => $(s)).filter(Boolean);
    const dockIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? away.add(e.target) : away.delete(e.target)));
      dock.classList.toggle('show', away.size === 0);
    }, { threshold: 0.12 });
    targets.forEach((t) => dockIO.observe(t));
  }
}

/* Estimate rules. Every number here is a placeholder: set your own in js/config.js under `estimator`. */
const DEFAULTS = {
  currency: '$',
  setupFee: 1500,            // added to template prices for "Set up for you"
  customFactor: 3,           // custom builds: template prices x this, plus customBase
  customBase: 3000,
  customMinimum: 6500,
};

function initEstimator(form, overrides) {
  const rules = { ...DEFAULTS, ...overrides };
  const priceEl = $('[data-est-price]', form), unitEl = $('[data-est-unit]', form);
  const timeEl = $('[data-est-time]', form), partsEl = $('[data-est-parts]', form);
  const plane = $('[data-stack3d] .plane', form), send = $('[data-est-send]', form);
  const money = (v) => `${rules.currency}${Math.round(v / 10) * 10 >= 1000 ? (Math.round(v / 10) * 10).toLocaleString('en-US') : Math.round(v / 10) * 10}`;
  const plates = new Map();
  let shown = 0, target = 0, from = 0, start = 0, raf = 0, summary = '';

  /* time-based count, so it lands on the right figure at any frame rate */
  function tween(now) {
    const t = Math.min(1, (now - start) / 650);
    shown = from + (target - from) * (1 - Math.pow(1 - t, 3));
    priceEl.textContent = target ? money(shown) : '—';
    raf = t < 1 ? requestAnimationFrame(tween) : 0;
  }

  function compute() {
    const picked = $$('input[name="part"]:checked', form);
    const mode = $('input[name="mode"]:checked', form)?.value || 'setup';
    const sum = picked.reduce((a, i) => a + (+i.dataset.price || 0), 0);
    const days = picked.reduce((a, i) => a + (+i.dataset.days || 0), 0);
    let price = sum, time = 'Download today', unit = 'one-time';
    if (mode === 'setup') { price = sum + rules.setupFee; time = `Live in about ${6 + Math.ceil(days / 2)} working days`; }
    if (mode === 'custom') {
      price = Math.max(rules.customMinimum, sum * rules.customFactor + rules.customBase);
      const weeks = Math.max(3, Math.ceil((10 + days * 2) / 5));
      time = `Live in about ${weeks} weeks`; unit = 'from, fixed quote';
    }
    if (!picked.length) { price = 0; time = 'Pick at least one part'; }
    from = shown; target = price; start = performance.now();
    unitEl.textContent = unit;
    timeEl.textContent = time;
    const names = picked.map((i) => i.value);
    partsEl.textContent = names.length ? names.join(', ') : 'Nothing picked yet';
    if (reduced) { shown = target; priceEl.textContent = target ? money(target) : '—'; }
    else if (!raf) raf = requestAnimationFrame(tween);   // a running tween picks up the new target

    /* plates: one per picked part, UI on top of the backend, delivery as the base */
    const modeLabel = { template: 'Templates', setup: 'Setup and deploy', custom: 'Custom build' }[mode];
    const wanted = [['mode', modeLabel, 'base'], ...picked.filter((i) => i.dataset.group === 'api').map((i) => [i.value, i.value, 'api']), ...picked.filter((i) => i.dataset.group === 'ui').map((i) => [i.value, i.value, 'ui'])];
    const keep = new Set(wanted.map(([key]) => key));
    plates.forEach((node, key) => {
      if (keep.has(key)) return;
      plates.delete(key);
      node.classList.add('leaving');
      setTimeout(() => node.remove(), reduced ? 0 : 450);
    });
    wanted.forEach(([key, label, kind], n) => {
      let node = plates.get(key);
      if (!node) {
        node = document.createElement('div');
        node.className = `plate plate-${kind}${reduced ? '' : ' entering'}`;
        node.innerHTML = '<span></span>';
        plane.appendChild(node);
        plates.set(key, node);
        requestAnimationFrame(() => requestAnimationFrame(() => node.classList.remove('entering')));
      }
      node.firstChild.textContent = label;
      node.style.setProperty('--n', n);
    });
    plane.style.setProperty('--count', wanted.length);

    summary = `Estimate from the website\n- Parts: ${names.join(', ') || 'none'}\n- Delivery: ${modeLabel}\n- Guide price: ${price ? money(price) : '-'} (${unit})\n- ${time}`;
    send.dataset.interest = mode === 'custom' ? 'A custom build' : mode === 'setup' ? 'Setup of a template' : (picked.some((i) => i.dataset.group === 'ui') && picked.some((i) => i.dataset.group === 'api') ? 'A full-stack starter' : picked.some((i) => i.dataset.group === 'api') ? 'A backend template' : 'A UI template');
  }

  form.addEventListener('change', compute);
  form.addEventListener('submit', (e) => e.preventDefault());
  /* runs before the page-wide link handler, so the form is filled when the page glides to it */
  send.addEventListener('click', () => {
    const msg = $('#f-msg'), interest = $('#f-interest');
    if (msg) msg.value = summary + (msg.value && !msg.value.startsWith('Estimate from the website') ? `\n\n${msg.value}` : '');
    if (interest) interest.value = send.dataset.interest;
  });
  compute();
}

/* Eyebrow labels: each one resolves from random characters, left to right, the first time it is
   seen. Screen readers get the real text from a visually hidden copy, so they never hear the noise. */
function initDecode() {
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>_+';
  const root = document.documentElement;
  const jobs = new Map();
  $$('.eyebrow').forEach((el) => {
    const parts = [];
    [...el.childNodes].forEach((node) => {
      if (node.nodeType !== 3 || !node.textContent.trim()) return;
      const real = document.createElement('span'); real.className = 'sr-only'; real.textContent = node.textContent;
      const shown = document.createElement('span'); shown.setAttribute('aria-hidden', 'true'); shown.textContent = node.textContent;
      node.replaceWith(real, shown);
      parts.push({ el: shown, text: real.textContent });
    });
    if (parts.length) jobs.set(el, parts);
  });

  const run = (parts) => {
    const total = parts.reduce((a, p) => a + p.text.length, 0), dur = Math.min(900, 300 + total * 18);
    const t0 = performance.now();
    let frame = 0;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      if (frame++ % 2 === 0 || t === 1) {                 // every other frame is plenty for a flicker
        let offset = 0;
        parts.forEach((p) => {
          let out = '';
          for (let i = 0; i < p.text.length; i++) {
            const ch = p.text[i], settle = ((offset + i) / total) * 0.75 + 0.2;
            out += t >= settle || ch === ' ' || ch === '·' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
          p.el.textContent = out;
          offset += p.text.length;
        });
      }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const parts = jobs.get(e.target);
      const go = () => (root.classList.contains('loading') ? setTimeout(go, 120) : run(parts));
      go();
    });
  }, { threshold: 0.6 });
  jobs.forEach((_, el) => io.observe(el));
}
