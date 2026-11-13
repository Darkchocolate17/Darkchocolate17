// Procedural space backgrounds for comic panels. Deterministic per data-seed.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// <canvas data-space data-seed="3" data-hue="220" data-neb="0.6" data-stars="900" data-sun="0.2,0.8,0.5">
function paintSpace(c) {
  const d = c.dataset, w = (c.width = c.parentElement.clientWidth), h = (c.height = c.parentElement.clientHeight);
  const g = c.getContext('2d'), r = rng(+d.seed || 1);
  const hue = +d.hue || 225, neb = d.neb === undefined ? 0.5 : +d.neb, stars = +d.stars || 800;

  const bg = g.createLinearGradient(0, 0, w * 0.3, h);
  bg.addColorStop(0, `hsl(${hue},45%,5%)`);
  bg.addColorStop(1, `hsl(${hue + 30},50%,2%)`);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);

  // nebula: soft overlapping colour clouds
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 46 * neb; i++) {
    const x = r() * w, y = r() * h, rad = (0.12 + r() * 0.3) * Math.max(w, h);
    const hh = hue + (r() - 0.5) * 110, a = (0.04 + r() * 0.09) * neb;
    const n = g.createRadialGradient(x, y, 0, x, y, rad);
    n.addColorStop(0, `hsla(${hh},75%,55%,${a})`);
    n.addColorStop(1, 'hsla(0,0%,0%,0)');
    g.fillStyle = n; g.fillRect(0, 0, w, h);
  }

  // stars
  for (let i = 0; i < stars; i++) {
    const x = r() * w, y = r() * h, big = r() > 0.985, s = big ? 1.6 + r() * 1.6 : 0.3 + r() * 1.1;
    g.fillStyle = `hsla(${r() > 0.7 ? 35 : 210},80%,${82 + r() * 18}%,${0.25 + r() * 0.75})`;
    g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    if (big) {
      const f = g.createRadialGradient(x, y, 0, x, y, s * 9);
      f.addColorStop(0, 'rgba(200,220,255,.35)'); f.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = f; g.fillRect(x - s * 9, y - s * 9, s * 18, s * 18);
      g.strokeStyle = 'rgba(220,235,255,.55)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x - s * 7, y); g.lineTo(x + s * 7, y); g.moveTo(x, y - s * 7); g.lineTo(x, y + s * 7); g.stroke();
    }
  }

  // sun glare: "fx,fy,size"
  if (d.sun) {
    const [fx, fy, fs] = d.sun.split(',').map(Number), x = fx * w, y = fy * h, R = fs * Math.max(w, h);
    const s = g.createRadialGradient(x, y, 0, x, y, R);
    s.addColorStop(0, 'rgba(255,255,245,1)'); s.addColorStop(0.04, 'rgba(255,236,170,.95)');
    s.addColorStop(0.18, 'rgba(255,160,60,.45)'); s.addColorStop(0.5, 'rgba(255,90,30,.12)'); s.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = s; g.fillRect(0, 0, w, h);
    g.save(); g.translate(x, y);
    for (let i = 0; i < 14; i++) {
      g.rotate(r() * 6.28);
      const l = R * (0.5 + r() * 0.9), sp = g.createLinearGradient(0, 0, l, 0);
      sp.addColorStop(0, 'rgba(255,230,170,.32)'); sp.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = sp; g.beginPath(); g.moveTo(0, 0); g.lineTo(l, -l * 0.012); g.lineTo(l, l * 0.012); g.fill();
    }
    g.restore();
  }

  // ink grain
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < (w * h) / 55; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.09)';
    g.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
}

// Shared SVG symbols: Voyager probe and Ori the narrator drone.
const SYMBOLS = `
<svg width="0" height="0" style="position:absolute">
  <defs>
    <linearGradient id="dishG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fffdf2"/><stop offset=".55" stop-color="#b9b4a6"/><stop offset="1" stop-color="#3c3a38"/>
    </linearGradient>
    <linearGradient id="metalG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d9c48c"/><stop offset="1" stop-color="#2a2620"/>
    </linearGradient>
    <radialGradient id="lensG"><stop offset="0" stop-color="#fff6d8"/><stop offset=".35" stop-color="#ffb347"/><stop offset="1" stop-color="#7a3200"/></radialGradient>
    <radialGradient id="oriBody" cx=".35" cy=".3"><stop offset="0" stop-color="#5f7f8f"/><stop offset="1" stop-color="#0f1c26"/></radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <symbol id="voyager" viewBox="-220 -120 440 300" overflow="visible">
    <g stroke="#15130f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- magnetometer boom -->
      <path d="M-20 0 L-215 -70 M-20 12 L-215 -62" stroke="#cfc8b4" fill="none"/>
      <path d="M-20 12 L-40 -8 L-60 -3 L-80 -22 L-100 -17 L-120 -36 L-140 -31 L-160 -50 L-180 -45 L-200 -65" stroke="#8f897a" stroke-width="1.5" fill="none"/>
      <!-- whip antennas -->
      <path d="M-10 30 L-90 170 M10 30 L70 176" stroke="#cfc8b4" stroke-width="2" fill="none"/>
      <!-- RTG boom -->
      <path d="M25 22 L120 78" stroke="#8f897a" stroke-width="6"/>
      <rect x="70" y="42" width="26" height="20" rx="3" fill="url(#metalG)" transform="rotate(30 83 52)"/>
      <rect x="95" y="57" width="26" height="20" rx="3" fill="url(#metalG)" transform="rotate(30 108 67)"/>
      <rect x="120" y="72" width="26" height="20" rx="3" fill="url(#metalG)" transform="rotate(30 133 82)"/>
      <!-- science boom + camera platform -->
      <path d="M25 0 L125 -62" stroke="#8f897a" stroke-width="5"/>
      <rect x="112" y="-92" width="44" height="34" rx="4" fill="url(#metalG)"/>
      <circle cx="150" cy="-75" r="11" fill="#0c0c10" stroke="#d9c48c"/>
      <!-- bus -->
      <polygon points="-36,6 -26,-10 26,-10 36,6 36,30 26,44 -26,44 -36,30" fill="url(#metalG)"/>
      <circle cx="0" cy="18" r="11" fill="#e8c65a" stroke="#6b5417"/>
      <!-- dish -->
      <ellipse cx="0" cy="-14" rx="78" ry="30" fill="url(#dishG)"/>
      <ellipse cx="0" cy="-17" rx="56" ry="19" fill="none" stroke="#6d695f" stroke-width="1.5"/>
      <path d="M-40 -18 L0 -70 L40 -18 M0 -70 L0 -30" stroke="#3a3832" stroke-width="2" fill="none"/>
      <circle cx="0" cy="-70" r="7" fill="#d9d2bd"/>
    </g>
  </symbol>
  <symbol id="ori" viewBox="-50 -50 100 100" overflow="visible">
    <circle r="46" fill="#ffb347" opacity=".18" filter="url(#soft)"/>
    <path d="M0 -34 L0 -47" stroke="#9fb4bd" stroke-width="3"/><circle cy="-48" r="4" fill="#ffb347"/>
    <path d="M-34 4 L-48 14 L-34 18 Z M34 4 L48 14 L34 18 Z" fill="#33505e" stroke="#0a0f14" stroke-width="2"/>
    <rect x="-34" y="-34" width="68" height="64" rx="26" fill="url(#oriBody)" stroke="#0a0f14" stroke-width="3"/>
    <path d="M-22 -24 Q0 -34 22 -24" stroke="#a9c4cf" stroke-width="3" fill="none" opacity=".6"/>
    <circle r="19" fill="#0a0f14"/><circle r="14" fill="url(#lensG)"/><circle cx="-5" cy="-5" r="4" fill="#fff" opacity=".85"/>
    <rect x="-12" y="22" width="24" height="4" rx="2" fill="#ffb347" opacity=".8"/>
  </symbol>
</svg>`;

window.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', SYMBOLS);
  document.querySelectorAll('.cap.ori').forEach((el) =>
    el.insertAdjacentHTML('afterbegin', '<svg viewBox="-50 -50 100 100"><use href="#ori" x="-50" y="-50" width="100" height="100"/></svg>'));
  document.querySelectorAll('canvas[data-space]').forEach(paintSpace);
  document.fonts.ready.then(() => (window.READY = true));
});
