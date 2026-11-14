/* ------------------------------------------------------------------ *
 *  Site settings. Everything a new brand needs to change in JS lives
 *  here. Copy lives in index.html, colours and type in css/style.css.
 * ------------------------------------------------------------------ */
export const config = {
  /* Replaces the text of every element marked [data-brand] */
  brand: 'Kinetiq',

  /* The demo form opens the visitor's mail app addressed here.
     Swap submitForm() in js/ui.js for a fetch() to your own backend. */
  contactEmail: 'hello@kinetiq.example',

  /* Skins are defined in css/style.css as :root[data-skin="name"] */
  skins: ['ion', 'ember', 'circuit', 'paper'],
  defaultSkin: 'ion',

  /* How quickly the 3D scene catches up with the scrollbar (higher = snappier) */
  smoothing: 7,

  particles: {
    desktop: 30000,     // particle count on wide screens
    mobile: 13000,      // particle count on phones and tablets
    size: 0.046,        // world-space size of one particle
  },

  bloom: { strength: 0.55, radius: 0.75, threshold: 0.2 },

  /* Cap on device pixel ratio. The scene drops this by itself on slow GPUs. */
  maxPixelRatio: 1.75,
};
