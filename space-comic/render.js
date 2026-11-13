// Render an episode's slides to 1080x1350 PNGs (Instagram 4:5 carousel).
// Usage: node render.js episodes/01-the-last-photograph
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = path.resolve(process.argv[2] || 'episodes/01-the-last-photograph');
  const out = path.join(dir, 'slides');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(dir, 'episode.html'));
  await page.waitForFunction('window.READY === true');
  const slides = await page.$$('.slide');
  for (let i = 0; i < slides.length; i++) {
    const file = path.join(out, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await slides[i].screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();
