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
- **Background theme** — deep green by default; `night`, `dusk` and `daylight` are also built in. Change the default in the small script at the top of `index.html`, or preview one with `?theme=name`
- **Contact email** — `CONTACT_EMAIL` at the top of `js/main.js` (the form opens the visitor's email app; swap in a form backend if you prefer)
- **3D scene and camera route** — `js/main.js`
- **Real 3D models** — drop `.glb` files in `models/` and list them in `models/models.json`; see `models/README.md`

Three.js (MIT) is vendored in `vendor/`.
