/* ------------------------------------------------------------------ *
 *  Product showcase. While the section scrolls into view the browser
 *  window flattens from a tilt, then the pinned scroll switches between
 *  its screens. Each screen's CSS loops run only while it is showing.
 *  The step buttons under the window jump to a screen.
 * ------------------------------------------------------------------ */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function initShowcase() {
  return [...document.querySelectorAll('[data-showcase]')].map((section) => {
    const device = section.querySelector('[data-device]');
    const screens = [...section.querySelectorAll('.screen')];
    const tabs = [...section.querySelectorAll('.device-tabs b')];
    const steps = [...section.querySelectorAll('[data-show-steps] li')];
    const callouts = [...section.querySelectorAll('.callout')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const n = screens.length;
    const box = { top: 0, height: 1, vh: 1 };
    let current = -1, ready = null, visible = false, lastPose = '', lastFill = '';

    /* the screen shown at pinned progress p: equal shares, with a short hold at the start */
    const indexAt = (p) => Math.min(n - 1, Math.floor(clamp((p - 0.06) / 0.9) * n));

    function show(idx) {
      current = idx;
      screens.forEach((s, k) => {
        s.classList.toggle('on', k === idx);
        s.classList.toggle('was', k < idx);
        s.classList.toggle('play', k === idx && visible);
      });
      tabs.forEach((t, k) => t.classList.toggle('on', k === idx));
      device.style.setProperty('--screen', idx);
      steps.forEach((s, k) => s.classList.toggle('on', k === idx));
      ready = null;                                   // re-evaluate callouts for the new screen
    }

    function measure(vh) {
      const r = section.getBoundingClientRect();
      box.top = r.top + window.scrollY; box.height = r.height; box.vh = vh;
    }

    function update(y, vh) {
      const inView = y + vh > box.top && y < box.top + box.height;
      if (inView !== visible) {
        visible = inView;
        screens.forEach((s, k) => s.classList.toggle('play', visible && k === current));
      }
      if (!inView) return;

      /* arrival: 0 when the section's top meets the bottom of the screen, 1 when it is pinned */
      const arrive = easeOut(clamp((y - (box.top - vh)) / vh));
      const tilt = reduced ? 0 : (1 - arrive) * 30;
      const scale = reduced ? 1 : 0.84 + 0.16 * arrive;
      const lift = reduced ? 0 : (1 - arrive) * 70;
      const pose = `${tilt.toFixed(2)}|${scale.toFixed(4)}|${lift.toFixed(1)}`;
      if (pose !== lastPose) {
        lastPose = pose;
        device.style.transform = `translateY(${lift.toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      }

      const p = clamp((y - box.top) / Math.max(1, box.height - vh));
      const idx = indexAt(p);
      if (idx !== current) show(idx);

      /* the active step fills as its share of the scroll is used up */
      const share = clamp((p - 0.06) / 0.9) * n;
      const fill = steps.map((_, k) => clamp(share - k).toFixed(3)).join(',');
      if (fill !== lastFill) {
        lastFill = fill;
        fill.split(',').forEach((f, k) => steps[k].style.setProperty('--fill', f));
      }

      const isReady = arrive > 0.92;
      if (isReady !== ready) {
        ready = isReady;
        callouts.forEach((c) => c.classList.toggle('show', isReady && +c.dataset.for === current));
      }
    }

    /* step buttons glide the page to the middle of that screen's share */
    section.querySelectorAll('[data-show-go]').forEach((btn) => btn.addEventListener('click', () => {
      const k = +btn.dataset.showGo;
      const p = 0.06 + ((k + 0.5) / n) * 0.9;
      window.dispatchEvent(new CustomEvent('site:goto', { detail: box.top + p * (box.height - box.vh) }));
    }));

    show(0);
    return { measure, update };
  });
}
