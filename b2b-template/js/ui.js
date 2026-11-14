/* ------------------------------------------------------------------ *
 *  Everything on the DOM side: the smoothed scroll value, the scene
 *  track that tells the 3D world where we are, and the scroll effects
 *  (pinning, horizontal travel, word scrub, stacking cards, marquee,
 *  reveals, counters) plus cursor, tilt, skins, menu and form.
 *
 *  Each effect is opt-in through a data attribute, so sections can be
 *  added, removed or reordered in index.html without touching this file.
 * ------------------------------------------------------------------ */
import { config } from './config.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Smoothed scroll position: the DOM scrolls natively, effects follow scroll.y */
export const scroll = { y: window.scrollY, raw: window.scrollY, v: 0, vh: window.innerHeight, vw: window.innerWidth, max: 1 };
export const pointer = { x: 0, y: 0, active: false };

/* ---- scene track: one entry per [data-shape] element, in page order ---- */
export const items = $$('[data-shape]').map((el) => ({
  el,
  shape: el.dataset.shape,
  side: { left: -1, right: 1 }[el.dataset.side] ?? 0,
  zoom: parseFloat(el.dataset.zoom) || 10,
  dim: parseFloat(el.dataset.dim) || 1,
  label: el.dataset.label || el.id || el.dataset.shape,
  hs: 0, he: 0,
}));
/* i = current shape, f = 0..1 morph toward the next one, local = 0..1 progress through a tall section */
export const state = { i: 0, f: 0, local: 0, active: 0 };

function sampleTrack(y) {
  const c = y + scroll.vh / 2, n = items.length;
  if (!n) return;
  let i = n - 1;
  while (i > 0 && c < items[i].hs) i--;
  const it = items[i], tall = it.he > it.hs + 1;
  if (c <= it.he || i === n - 1) {
    state.i = i; state.f = 0;
    state.local = tall ? clamp((c - it.hs) / (it.he - it.hs)) : 0;
  } else {
    state.i = i;
    state.f = clamp((c - it.he) / Math.max(1, items[i + 1].hs - it.he));
    state.local = tall ? 1 - state.f : 0;
  }
  state.active = state.f < 0.5 ? state.i : state.i + 1;
}

export function initUI({ onSkin } = {}) {
  root.classList.toggle('has-cursor', finePointer && !reduced);

  /* ---- brand + contact details from config ---- */
  $$('[data-brand]').forEach((el) => { el.textContent = config.brand; });
  $$('[data-email]').forEach((el) => { el.textContent = config.contactEmail; el.href = `mailto:${config.contactEmail}`; });
  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  /* ---- split headings into words that rise into place ---- */
  $$('[data-split]').forEach((el) => {
    let index = 0;
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 1) { walk(child); return; }
        if (child.nodeType !== 3) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--i', index++); wi.textContent = part;
          w.append(wi); frag.append(w);
        });
        child.replaceWith(frag);
      });
    };
    walk(el);
  });

  /* ---- reveals + counters ---- */
  const formatCount = (el, value) => {
    const dec = +(el.dataset.dec || 0);
    el.textContent = (el.dataset.prefix || '') + value.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suffix || '');
  };
  const countUp = (el) => {
    const end = parseFloat(el.dataset.count);
    if (reduced) { formatCount(el, end); return; }
    const t0 = performance.now(), dur = 1600;
    const step = (now) => {
      const t = clamp((now - t0) / dur);
      formatCount(el, end * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      $$('[data-count]', entry.target).forEach(countUp);
      revealIO.unobserve(entry.target);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  /* stagger siblings that reveal together */
  $$('.reveal').forEach((el) => {
    const group = [...el.parentElement.children].filter((c) => c.matches('.reveal'));
    el.style.setProperty('--d', `${Math.min(group.indexOf(el), 6) * 90}ms`);
  });
  const startReveals = () => $$('.reveal, [data-split]').forEach((el) => revealIO.observe(el));

  /* ---- focus list: the row nearest the middle of the screen lights up ---- */
  const focusIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('on', entry.isIntersecting));
  }, { rootMargin: '-45% 0px -45% 0px' });
  $$('[data-focus-list] > *').forEach((el) => focusIO.observe(el));

  /* ---- word scrub inside a pinned section ---- */
  const scrubs = $$('[data-scrub-words]').map((el) => {
    el.setAttribute('aria-label', el.textContent.trim());
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((word) => {
      const s = document.createElement('span'); s.className = 'sw'; s.textContent = word; s.setAttribute('aria-hidden', 'true');
      el.append(s, ' ');
      return s;
    });
    return { host: el.closest('[data-pin]') || el, spans, last: new Float32Array(words.length).fill(-1), top: 0, height: 0 };
  });

  /* ---- pinned horizontal scroll ---- */
  const hscrolls = $$('[data-hscroll]').map((el) => ({
    el, track: $('[data-hscroll-track]', el), bar: $('[data-hscroll-bar]', el), travel: 0, top: 0, height: 0,
  }));

  /* ---- sticky stacking cards ---- */
  const stacks = $$('[data-stack]').map((el) => ({ el, cards: [...el.children], top: 0, height: 0 }));

  /* ---- marquee that speeds up and changes direction with the scroll ---- */
  const marquees = $$('[data-marquee]').map((el) => {
    const track = el.firstElementChild, originals = [...track.children];
    return { el, track, originals, loop: 0, x: 0, dir: -1, speed: parseFloat(el.dataset.marquee) || 1 };
  });
  const fillMarquee = (m) => {
    [...m.track.children].slice(m.originals.length).forEach((c) => c.remove());
    const gap = parseFloat(getComputedStyle(m.track).columnGap) || 0;
    m.loop = m.track.scrollWidth + gap;
    const copies = Math.ceil((scroll.vw * 1.2) / Math.max(1, m.loop)) + 1;
    for (let k = 0; k < copies; k++) m.originals.forEach((c) => { const d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); m.track.append(d); });
  };

  /* ---- parallax + footer word ---- */
  const drifters = $$('[data-speed]').map((el) => ({ el, speed: parseFloat(el.dataset.speed), top: 0, height: 0 }));
  const footerWord = $('[data-footer-word]');
  const footer = { top: 0, height: 0 };

  /* ---- measuring ---- */
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, height: r.height }; };
  function measure() {
    scroll.vh = window.innerHeight;
    scroll.vw = root.clientWidth;
    hscrolls.forEach((h) => {
      h.travel = Math.max(0, h.track.scrollWidth - scroll.vw);
      h.el.style.height = `calc(var(--vh) + ${h.travel}px)`;
    });
    scroll.max = Math.max(1, root.scrollHeight - scroll.vh);
    items.forEach((it) => {
      const b = box(it.el), half = Math.min(b.height, scroll.vh) / 2;
      it.top = b.top; it.hs = b.top + half; it.he = b.top + b.height - half;
    });
    [...scrubs.map((s) => [s, s.host]), ...hscrolls.map((h) => [h, h.el]), ...stacks.map((s) => [s, s.el])].forEach(([o, el]) => Object.assign(o, box(el)));
    drifters.forEach((d) => { d.el.style.transform = ''; Object.assign(d, box(d.el)); });
    if (footerWord) Object.assign(footer, box(footerWord));
    marquees.forEach(fillMarquee);
  }

  /* ---- chrome: rail, nav, header, progress ---- */
  const railDots = $('#rail-dots'), railNow = $('#rail-now'), railTotal = $('#rail-total'), railPct = $('#rail-pct');
  const bar = $('#progress-bar'), header = $('#header');
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const jump = (top) => window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  const dots = items.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${it.label}</span><i></i>`;
    b.setAttribute('aria-label', `Go to ${it.label}`);
    b.addEventListener('click', () => jump(it.top));
    railDots?.append(b);
    return b;
  });
  if (railTotal) railTotal.textContent = `/ ${pad(items.length)}`;

  const navLinks = $$('#nav a').map((a) => {
    const target = $(a.getAttribute('href'));
    return { a, index: items.findIndex((it) => it.el === target || it.el.contains(target)) };
  });
  let shownActive = -1;
  const setActive = (i) => {
    if (i === shownActive) return;
    shownActive = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    navLinks.forEach((l) => l.a.classList.toggle('on', l.index === i));
    if (railNow) railNow.textContent = pad(i + 1);
  };

  const closeMenu = () => { root.classList.remove('menu-open'); $('#menu-btn')?.setAttribute('aria-expanded', 'false'); };
  $('#menu-btn')?.addEventListener('click', () => {
    const open = root.classList.toggle('menu-open');
    $('#menu-btn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* in-page links glide to their section */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = a.getAttribute('href') === '#' ? document.body : $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    jump(target === document.body ? 0 : box(target).top);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---- skins ---- */
  const skinButtons = $$('[data-skin-btn]');
  const applySkin = (name, save) => {
    if (!config.skins.includes(name)) name = config.defaultSkin;
    root.dataset.skin = name;
    skinButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.skinBtn === name)));
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    $('meta[name="theme-color"]')?.setAttribute('content', bg);
    if (save) { try { localStorage.setItem('skin', name); } catch (err) { /* private mode: nothing to remember */ } }
    onSkin?.();
  };
  skinButtons.forEach((b) => b.addEventListener('click', () => applySkin(b.dataset.skinBtn, true)));
  let savedSkin = null;
  try { savedSkin = localStorage.getItem('skin'); } catch (err) { /* storage blocked */ }
  applySkin(savedSkin || root.dataset.skin || config.defaultSkin, false);

  /* ---- pricing period ---- */
  $$('[data-bill]').forEach((btn) => btn.addEventListener('click', () => {
    $$('[data-bill]').forEach((b) => { const on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('[data-price-m]').forEach((el) => { el.textContent = el.dataset[btn.dataset.bill === 'y' ? 'priceY' : 'priceM']; });
  }));

  /* ---- pointer: scene parallax, cursor, tilt, magnetic buttons ---- */
  const cursor = $('#cursor');
  const cur = { x: scroll.vw / 2, y: scroll.vh / 2, tx: scroll.vw / 2, ty: scroll.vh / 2 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / scroll.vw) * 2 - 1;
    pointer.y = -((e.clientY / scroll.vh) * 2 - 1);
    pointer.active = true;
    cur.tx = e.clientX; cur.ty = e.clientY;
    cursor?.classList.remove('off');
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; cursor?.classList.add('off'); });
  if (finePointer && !reduced) {
    const hot = 'a, button, summary, input, select, textarea, [data-tilt]';
    document.addEventListener('pointerover', (e) => cursor?.classList.toggle('grow', !!e.target.closest?.(hot)));
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.setProperty('--ry', `${(px - 0.5) * 9}deg`);
        el.style.setProperty('--rx', `${(0.5 - py) * 7}deg`);
        el.style.setProperty('--gx', `${px * 100}%`);
        el.style.setProperty('--gy', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('tilting');
        ['--rx', '--ry', '--gx', '--gy'].forEach((p) => el.style.removeProperty(p));
      });
    });
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.22}px ${(e.clientY - r.top - r.height / 2) * 0.3}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  /* ---- demo form: opens the visitor's mail app (see config.contactEmail) ---- */
  const form = $('#demo-form'), note = $('#form-note');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const bad = [['name', !data.name.trim()], ['email', !/^\S+@\S+\.\S+$/.test(data.email)]].filter(([, wrong]) => wrong).map(([name]) => name);
    ['name', 'email'].forEach((name) => form.elements[name].setAttribute('aria-invalid', String(bad.includes(name))));
    if (bad.length) {
      note.classList.add('error');
      note.textContent = bad.length === 2 ? 'Add your name and a work email so we can reply.' : bad[0] === 'name' ? 'Add your name so we know who to reply to.' : 'That email address looks incomplete.';
      form.elements[bad[0]].focus();
      return;
    }
    submitForm(data);
  });
  function submitForm(data) {
    const subject = `Demo request from ${data.name}${data.company ? `, ${data.company}` : ''}`;
    const body = `Name: ${data.name}\nEmail: ${data.email}\nCompany: ${data.company || '-'}\nOrders a month: ${data.volume}\n\n${data.message || ''}`;
    note.classList.remove('error');
    note.innerHTML = `Your mail app should open with the request filled in. If it does not, write to <a href="mailto:${config.contactEmail}">${config.contactEmail}</a>`;
    window.location.href = `mailto:${config.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  /* ---- loader ---- */
  let loaderDone = false;
  function finishLoading() {
    if (loaderDone) return;
    loaderDone = true;
    const fill = $('#loader-fill'), num = $('#loader-num');
    const t0 = performance.now(), dur = reduced ? 0 : 900;
    const tick = (now) => {
      const t = dur ? clamp((now - t0) / dur) : 1, v = 1 - Math.pow(1 - t, 3);
      if (fill) fill.style.transform = `scaleX(${v})`;
      if (num) num.textContent = Math.round(v * 100);
      if (t < 1) { requestAnimationFrame(tick); return; }
      root.classList.remove('loading');
      setTimeout(startReveals, 150);
    };
    requestAnimationFrame(tick);
  }

  /* ---- per-frame update ---- */
  let lastRaw = scroll.raw, headerHidden = false;
  function update(dt) {
    const raw = window.scrollY;
    const prev = scroll.y;
    scroll.raw = raw;
    scroll.y = reduced ? raw : lerp(scroll.y, raw, 1 - Math.exp(-dt * config.smoothing));
    if (Math.abs(raw - scroll.y) < 0.1) scroll.y = raw;
    scroll.v = dt > 0 ? (scroll.y - prev) / dt : 0;
    const y = scroll.y, vh = scroll.vh;

    sampleTrack(y);
    setActive(state.active);

    /* progress */
    const total = clamp(y / scroll.max);
    if (bar) bar.style.transform = `scaleX(${total})`;
    if (railPct) railPct.textContent = pad(Math.round(total * 100), 3);

    /* header hides on the way down, returns on the way up */
    const delta = raw - lastRaw;
    if (Math.abs(delta) > 4) {
      const hide = delta > 0 && raw > vh * 0.6 && !root.classList.contains('menu-open');
      if (hide !== headerHidden) { headerHidden = hide; header?.classList.toggle('hide', hide); }
      lastRaw = raw;
    }
    header?.classList.toggle('scrolled', raw > 40);

    /* word scrub */
    scrubs.forEach((s) => {
      if (y + vh < s.top || y > s.top + s.height) return;
      const p = clamp((y - s.top) / Math.max(1, s.height - vh)), n = s.spans.length;
      const head = reduced ? n + 1 : (p / 0.82) * (n + 1);
      s.spans.forEach((span, k) => {
        const o = Math.round((0.16 + 0.84 * clamp(head - k)) * 50) / 50;
        if (o !== s.last[k]) { s.last[k] = o; span.style.setProperty('--o', o); }
      });
    });

    /* horizontal travel */
    hscrolls.forEach((h) => {
      if (y + vh < h.top || y > h.top + h.height) return;
      const p = clamp((y - h.top) / Math.max(1, h.height - vh));
      h.track.style.transform = `translate3d(${-p * h.travel}px,0,0)`;
      if (h.bar) h.bar.style.transform = `scaleX(${p})`;
    });

    /* stacking cards settle back as the next one covers them */
    stacks.forEach((s) => {
      if (reduced || y + vh < s.top || y > s.top + s.height) return;
      const rects = s.cards.map((c) => c.getBoundingClientRect());
      s.cards.forEach((card, k) => {
        const next = rects[k + 1];
        const cover = next ? clamp(1 - (next.top - rects[k].top) / Math.max(1, rects[k].height)) : 0;
        const q = Math.round(cover * 40) / 40;
        if (q === card._q) return;
        card._q = q;
        card.style.scale = 1 - q * 0.06;
        card.style.filter = q ? `brightness(${1 - q * 0.4})` : '';
      });
    });

    /* marquees */
    marquees.forEach((m) => {
      if (!m.loop) return;
      if (Math.abs(scroll.v) > 30) m.dir = scroll.v > 0 ? -1 : 1;
      m.x += m.dir * dt * (reduced ? 0 : 46 * m.speed + Math.abs(scroll.v) * 0.35);
      m.x = ((m.x % m.loop) + m.loop) % m.loop;
      m.track.style.transform = `translate3d(${-m.x}px,0,0)`;
    });

    /* parallax */
    if (!reduced) drifters.forEach((d) => {
      if (y + vh < d.top - vh || y > d.top + d.height + vh) return;
      d.el.style.transform = `translate3d(0,${(y - d.top + Math.min(d.top, vh * 0.5)) * -d.speed}px,0)`;
    });

    /* footer word slides sideways as it enters */
    if (footerWord && !reduced && y + vh > footer.top) {
      const p = clamp((y + vh - footer.top) / (footer.height + vh * 0.4));
      footerWord.style.transform = `translate3d(${lerp(14, -6, p)}%,0,0)`;
    }

    /* cursor */
    if (cursor && finePointer && !reduced) {
      cur.x = lerp(cur.x, cur.tx, 1 - Math.exp(-dt * 16));
      cur.y = lerp(cur.y, cur.ty, 1 - Math.exp(-dt * 16));
      cursor.style.transform = `translate3d(${cur.x}px,${cur.y}px,0)`;
    }
  }

  measure();
  return { update, measure, finishLoading };
}
