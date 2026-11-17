/* ------------------------------------------------------------------ *
 *  Site settings. Everything a new brand needs to change in JS lives
 *  here. Copy lives in index.html, colours and type in css/style.css.
 * ------------------------------------------------------------------ */
export const config = {
  /* Replaces the text of every element marked [data-brand] */
  brand: 'Northframe',

  /* The enquiry form opens the visitor's mail app addressed here.
     Swap submitForm() in js/ui.js for a fetch() to your own backend. */
  contactEmail: 'hello@northframe.example',

  /* Project estimator rules (prices per part live on the checkboxes in index.html) */
  estimator: {
    currency: '$',
    setupFee: 1500,        // added to template prices for "Set up for you"
    customFactor: 3,       // custom build = template prices x customFactor + customBase
    customBase: 3000,
    customMinimum: 6500,
  },

  /* Skins are defined in css/style.css as :root[data-skin="name"] */
  skins: ['ion', 'ember', 'circuit', 'paper'],
  defaultSkin: 'ion',

  /* Wheel and keyboard scrolling glide instead of stepping (desktop only). Set false for plain native scrolling. */
  smoothWheel: true,
  wheelEase: 7.5,      // how quickly the page reaches the wheel target (higher = snappier)

  /* How quickly the 3D scene catches up with the page (higher = snappier) */
  smoothing: 9,

  particles: {
    desktop: 30000,     // particle count on wide screens
    mobile: 13000,      // particle count on phones and tablets
    size: 0.046,        // world-space size of one particle
  },

  bloom: { strength: 0.55, radius: 0.75, threshold: 0.2 },

  /* Cap on device pixel ratio. The scene drops this by itself on slow GPUs. */
  maxPixelRatio: 1.5,
};
