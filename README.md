# Second Ore Renewables — immersive 3D site

A scroll-driven 3D website for a metal scrap, PCB and wire recycling business.
One WebGL scene sits behind the page; scrolling flies the camera through seven chapters:

1. **Intro** — a vortex of scrap metal orbiting the loop
2. **Metal scrap** — ingots stack up as you scroll
3. **Circuit boards** — a PCB separates into its layers
4. **Wire & cable** — insulation strips back to bare copper
5. **Process** — five gates: collect, sort, shred, separate, refine
6. **Impact** — the planet held in closed loops
7. **Contact** — quote request form

## Run it

It is a static site with no build step, but it uses ES modules, so serve it over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Any static host (GitHub Pages, Netlify, Vercel) works as is.

## Make it yours

- **Name, copy, facts** — `index.html`
- **Colours and type** — the variables at the top of `css/style.css`
- **Contact email** — `CONTACT_EMAIL` at the top of `js/main.js` (the form opens the visitor's email app; swap in a form backend if you prefer)
- **3D scene and camera route** — `js/main.js`

Three.js (MIT) is vendored in `vendor/`.

## B2B template

`b2b-template/` is a separate, self-contained immersive 3D site for a business that sells and supports B2B website templates. It is built to be reskinned for other brands. See [b2b-template/README.md](b2b-template/README.md). When this repository is deployed to GitHub Pages it is served at `/b2b-template/`.
