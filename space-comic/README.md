# Deep Field — space comic for Instagram

True space stories told as comic carousels, narrated by Ori the drone.
All art is drawn in code (HTML, SVG, canvas), so there are no image-generation costs.

- `shared/` — comic styling, starfield painter, reusable art (Voyager, Ori), fonts
- `episodes/<nn-name>/episode.html` — one episode, one `<section class="slide">` per slide
- `episodes/<nn-name>/slides/` — rendered 1080x1350 PNGs to upload as a carousel
- `episodes/<nn-name>/reel.mp4` — 1080x1920 video version for Reels (no audio)
- `episodes/<nn-name>/caption.txt` — caption and hashtags

Render an episode (needs Node and Playwright):

    node render.js episodes/01-the-last-photograph
