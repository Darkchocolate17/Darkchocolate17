# Immersive 3D template studio site

A scroll-driven 3D website with motion graphics, built to be reskinned. One WebGL scene sits behind the whole page. As the visitor scrolls, 30,000 particles morph from one sculpture into the next, while live mockups, a request-flow diagram and a project estimator animate in the foreground.

The sample content is for a studio that sells UI templates, backend templates and full-stack starters, and does custom builds. The brand name **Northframe**, the template names, prices, timings and commitments are placeholders to replace with your own.

## Run it

There is no build step and no dependency to install. It uses ES modules, so serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Any static host works as is: GitHub Pages, Netlify, Vercel, S3.

## What is in the page

| Section | 3D shape | Motion and scroll technique |
| --- | --- | --- |
| Intro | Liquid orb inside a particle shell | Rotating headline word, floating status chips, magnetic buttons |
| Stack | (transition) | Two marquee rows running opposite ways, faster as you scroll |
| Why | Spiral galaxy | Pinned section, words light up as you scroll |
| What we make | A website exploded into layers | Each row has a live mockup: dashboard, terminal, sign-in, project board |
| How it connects | Particle cloud | Pinned diagram: scrolling carries an order from the UI through the API, auth, payments, jobs and database |
| Templates | Ribbed torus | Pinned horizontal scroll, cards swing in 3D, animated thumbnails |
| Estimate | Bar chart | Pick parts and delivery; the price counts to the new figure and a 3D stack assembles |
| Promise | Dotted globe with arcs | Count-up stats, tilt checklist card |
| Process | Double helix | Sticky cards that stack like tabs and tip back |
| Pricing + FAQ | Rolling wave | Plan cards swing in, accordions |
| Contact | Trefoil knot | Validated form, prefilled by the estimator |

On phones a call-to-action bar stays in reach between the hero, the estimator and the form.

Around all of it:

- An opening shot where the sculpture gathers out of a wide swirl as the camera flies in.
- Wireframe solids that drift past at different depths as the page scrolls.
- A camera that widens its lens with scroll speed, and particles that fly out past it during each morph.
- A pointer that dents the sculpture, and a click or tap that sends a ring through it.
- Wheel and keyboard scrolling that glide instead of stepping.
- A loader, a custom cursor, a section rail with scroll percentage, a header that hides on the way down, and four colour skins.

## Make it yours

### 1. Brand and contact: `js/config.js`

`brand` fills every element marked `data-brand`. `contactEmail` is where the enquiry form sends. Particle count, bloom, and scroll smoothing are here too. Set `smoothWheel: false` if you prefer plain native scrolling.

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
| `data-lift` | Optional. On tall, narrow screens the sculpture sits behind the copy; this moves it up (0 is centred, 0.5 is near the top). |
| `data-label` | Name shown in the side rail. |

Put the copy on the opposite side from the sculpture: `data-side="right"` with `.copy`, or `data-side="left"` with `.copy.right`.

Available shapes: `core`, `galaxy`, `screens`, `lattice`, `torus`, `globe`, `helix`, `bars`, `wave`, `knot`, `sphere`, `cloud`.

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
| `data-hscroll` with `data-hscroll-track` | Pinned horizontal scroll. Height is computed from the track width. Each child gets `--cy` and `--cz` for the 3D swing. |
| `data-stack` | Children become sticky cards that stack. Each gets `--q` (0 to 1) for how far it is covered. |
| `data-focus-list` | The child nearest mid-screen gets `.on`. |
| `data-marquee="1"` | Endless marquee. The number is its base speed; a negative number runs the row the other way. |
| `data-tilt` | 3D tilt and glare under the pointer. |
| `data-magnetic` | Element leans toward the pointer. |
| `data-speed="-0.16"` | Parallax drift relative to scroll. |
| `data-rotator` | Cycles its child words. Mark the visible one `class="on"`. |
| `data-play` | Adds `.play` while the element is on screen. Put CSS loops under `.play` so they only run when visible. |
| `data-flow` with `data-flow-steps` | Inside a pinned section, draws the system diagram from `js/flow.js` and moves a packet through it with the scroll. |
| `data-bill="m"` / `data-bill="y"` buttons with `data-price-m` and `data-price-y` on a price | Optional monthly/annual price toggle. |

## The estimator

Each option in `#estimator` carries its own `data-price` and `data-days`. The delivery rules (setup fee, custom-build multiplier and minimum) are under `estimator` in `js/config.js`. **Send this estimate** copies the summary into the contact form and picks the matching "I need" option.

## The flow diagram

The boxes, connections and the route the order takes are plain data at the top of `js/flow.js` (`NODES`, `EDGES`, `ROUTE`), with one layout for wide screens and one for phones. Edit the labels to describe your own stack; the captions are the `<li>` items in `data-flow-steps`.

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

Optional settings on a shape: `yaw` holds a fixed facing instead of free spin, `sweep` turns it by that many radians while a tall section scrolls, `explode: true` spreads it in depth over the same scroll, and `extra` names scenery in `js/world.js` that fades in with it (`orb`, `arcs`, `wire`, `floor`).

## Files

```
index.html        copy, section order, 3D sequence
css/style.css     tokens, skins, components, sections
js/config.js      brand, email, particle and bloom settings
js/main.js        bootstrap and the animation loop
js/ui.js          smoothed scroll, scene track, all DOM scroll effects
js/motion.js      rotating word, on-screen loops, estimator, phone CTA bar
js/flow.js        scroll-driven system diagram
js/world.js       Three.js scene: particles, orb, arcs, dust, backdrop, bloom
js/shapes.js      particle shape generators
vendor/           Three.js r170 (MIT)
```

## Behaviour worth knowing

- **Scrolling.** The page uses the browser's own scroll position, so touch, scrollbars, anchors and screen readers work normally. On desktop, wheel and keyboard input glide toward their target. Pinned and horizontal sections track the real scroll position exactly; only the 3D scene follows a smoothed copy.
- **Performance.** Shaders compile behind the loader. The scene lowers its pixel ratio and then turns bloom off if the device cannot hold about 42 fps. Phones get fewer particles. Panels use no backdrop blur.
- **Reduced motion.** With `prefers-reduced-motion`, the intro, glide, reveals, parallax, 3D card motion, the cursor and idle motion are off. The sculpture still follows the scrollbar.
- **No WebGL or no JavaScript.** The page stays fully readable on a gradient backdrop.
- **The form** opens the visitor's mail app. For a real backend, replace `submitForm()` in `js/ui.js` with a `fetch()` to your endpoint.
