# Immersive 3D B2B template

A scroll-driven 3D website for a B2B company, built to be reskinned. One WebGL scene sits behind the whole page. As the visitor scrolls, 30,000 particles morph from one sculpture into the next while the copy moves through pinned, horizontal and stacking sections.

The demo brand is **Kinetiq**, a fictional supply-network platform. Every name, logo and figure in it is placeholder content.

## Run it

There is no build step and no dependency to install. It uses ES modules, so serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Any static host works as is: GitHub Pages, Netlify, Vercel, S3.

## What is in the page

| Section | 3D shape | Scroll technique |
| --- | --- | --- |
| Intro | Liquid orb inside a particle shell | Split-word headline, parallax copy, magnetic buttons |
| Customers | (transition) | Marquee that speeds up and reverses with scroll direction |
| Why | Spiral galaxy | Pinned section, words light up as you scroll |
| Platform | Modular lattice cube | Tall section, the row nearest mid-screen comes into focus |
| Solutions | Ribbed torus | Pinned horizontal scroll with tilt cards |
| Network | Dotted globe with travelling arcs | Count-up stats |
| Process | Double helix | Sticky cards that stack and settle back |
| Results | Growth bar chart | Count-up stats, tilt quote card |
| Pricing + FAQ | Rolling wave | Monthly/annual toggle, accordions |
| Contact | Trefoil knot | Validated form, giant footer wordmark that slides in |

Around all of it: a loader, a custom cursor, a section rail with scroll percentage, a header that hides on the way down, four colour skins, pointer parallax, and a pointer that dents the sculpture.

## Make it yours

### 1. Brand and contact: `js/config.js`

`brand` fills every element marked `data-brand`. `contactEmail` is where the demo form sends. Particle count, bloom and scroll smoothing are here too.

### 2. Copy and structure: `index.html`

Each section is plain HTML. The 3D journey is declared on the sections themselves, so reordering, deleting or adding a section changes the 3D sequence with no JavaScript edits:

```html
<section class="scene" id="security" data-shape="lattice" data-side="right" data-zoom="12" data-label="Security">
  <div class="wrap">
    <div class="copy">
      <p class="eyebrow reveal">Security</p>
      <h2 data-split>Your heading here.</h2>
      <p class="lede reveal">Your paragraph here.</p>
    </div>
  </div>
</section>
```

| Attribute | Meaning |
| --- | --- |
| `data-shape` | Which sculpture the particles morph into for this section. |
| `data-side` | `left`, `right` or `center`: where the sculpture sits on wide screens. |
| `data-zoom` | Camera distance. A larger number makes the sculpture smaller. |
| `data-dim` | Optional, 0 to 1. Fades the sculpture behind dense content. |
| `data-label` | Name shown in the side rail. |

Put the copy on the opposite side from the sculpture: `data-side="right"` with `.copy`, or `data-side="left"` with `.copy.right`.

Available shapes: `core`, `galaxy`, `lattice`, `torus`, `globe`, `helix`, `bars`, `wave`, `knot`, `sphere`, `cloud`.

### 3. Colour and type: `css/style.css`

The tokens at the top of the file drive everything, including the 3D scene, which reads `--bg`, `--accent` and `--accent-2` from CSS. A skin is one rule:

```css
:root[data-skin="violet"] {
  --bg: #0b0714; --bg-2: #150d26; --fg: #f3eeff; --muted: #a79cc4;
  --accent: #b48cff; --accent-2: #ff6fb1; --on-accent: #12071f;
  --line: rgba(243, 238, 255, .13); --line-strong: rgba(243, 238, 255, .28);
  --panel: rgba(18, 11, 32, .64); --panel-solid: #160e27;
}
```

Add its name to `skins` in `js/config.js` and add a swatch button in the header. Set `--scene-additive: 0` on light skins so particles render as ink instead of light. To ship a single skin, set `data-skin` on `<html>` and delete the `.skins` block from the header.

Fonts are loaded from Google Fonts in `index.html` and named in `--font-display`, `--font-body` and `--font-mono`.

## Scroll effects you can reuse

All of them are opt-in attributes, handled in `js/ui.js`.

| Attribute | Effect |
| --- | --- |
| `class="reveal"` | Fades and rises in when it enters the viewport. Siblings stagger. |
| `data-split` | Splits a heading into words that rise into place. |
| `data-count="4200"` with `data-prefix`, `data-suffix`, `data-dec` | Counts up when revealed. |
| `data-pin` on a `.pinned` section with a `.pin` child | Holds the child on screen while the section scrolls. Set the section's `min-height` to control how long. |
| `data-scrub-words` | Inside a pinned section, lights the text up word by word. |
| `data-hscroll` with `data-hscroll-track` | Pinned horizontal scroll. Height is computed from the track width. |
| `data-stack` | Children become sticky cards that stack. |
| `data-focus-list` | The child nearest mid-screen gets `.on`. |
| `data-marquee="1"` | Endless marquee. The number is its base speed. |
| `data-tilt` | 3D tilt and glare under the pointer. |
| `data-magnetic` | Element leans toward the pointer. |
| `data-speed="-0.16"` | Parallax drift relative to scroll. |

## Add a 3D shape

A shape is a function that returns `n` points inside a radius of about 3. Add it to `js/shapes.js` and register it:

```js
function ring(n, rnd) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = 2.8 + (rnd() - 0.5) * 0.3;
    out[i * 3] = Math.cos(a) * r; out[i * 3 + 1] = (rnd() - 0.5) * 0.2; out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}
// in SHAPES:
ring: { build: ring, tilt: 0.9, roll: 0.2, spin: 0.12 },
```

Then use `data-shape="ring"` on a section.

## Files

```
index.html        copy, section order, 3D sequence
css/style.css     tokens, skins, components, sections
js/config.js      brand, email, particle and bloom settings
js/main.js        bootstrap and the animation loop
js/ui.js          smoothed scroll, scene track, all DOM scroll effects
js/world.js       Three.js scene: particles, orb, arcs, dust, backdrop, bloom
js/shapes.js      particle shape generators
vendor/           Three.js r170 (MIT)
```

## Behaviour worth knowing

- **Native scrolling.** The page scrolls natively, so anchors, keyboard, touch and screen readers work normally. Only the effects follow a smoothed copy of the scroll position.
- **Performance.** The scene lowers its pixel ratio and then turns bloom off if the device cannot hold about 35 fps. Phones get fewer particles.
- **Reduced motion.** With `prefers-reduced-motion`, reveals, parallax, the cursor and idle motion are off. The sculpture still follows the scrollbar.
- **No WebGL or no JavaScript.** The page stays fully readable on a gradient backdrop.
- **The form** opens the visitor's mail app. For a real backend, replace `submitForm()` in `js/ui.js` with a `fetch()` to your endpoint.
