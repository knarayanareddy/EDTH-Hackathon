// Optional: npm install --no-save playwright && npx playwright install chromium
// Then npm run build && node tests/synthetic-browser-test.cjs
// Synthetic software smoke test only; no challenge data or real-world quality claim.
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Dist is produced by the build, with JS and CSS embedded in the HTML.
    await page.goto(pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href);
    await page.locator('input[type=file]').setInputFiles({ name: 'invalid.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(9) });
    await page.getByRole('alert').getByText(/whole 640/).waitFor();

    const bytes = Buffer.alloc(640 * 512 * 2 * 2);
    for (let f = 0; f < 2; f++) for (let y = 0; y < 512; y++) for (let x = 0; x < 640; x++) {
      const value = 7300 + (x % 2 ? 130 : -130) + (y % 2 ? 120 : -120) + f * 15;
      bytes.writeUInt16LE(value, (f * 640 * 512 + y * 640 + x) * 2);
    }
    await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.bin', mimeType: 'application/octet-stream', buffer: bytes });
    await page.getByText('Loaded: synthetic.bin (2 frames)').waitFor();
    assert.equal(await page.locator('canvas').evaluate(c => `${c.width}x${c.height}`), '640x512');
    await page.getByRole('slider', { name: 'Before / after split' }).fill('0');
    await page.getByRole('checkbox', { name: /Stage 2/ }).uncheck();
    await page.getByRole('checkbox', { name: /Stage 4/ }).uncheck();
    const vertical = page.getByRole('slider', { name: 'Vertical line correction' });
    const horizontal = page.getByRole('slider', { name: 'Horizontal line correction' });
    await vertical.fill('0'); await horizontal.fill('0');
    const values = () => page.locator('canvas').evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const v = (x, y) => d[(y * c.width + x) * 4];
      return [v(100,100), v(101,100), v(100,101), v(101,101)];
    });
    const before = await values();
    await vertical.fill('1'); const afterVertical = await values();
    await horizontal.fill('1'); const afterBoth = await values();
    assert.ok(Math.abs(afterVertical[0] - afterVertical[1]) < Math.abs(before[0] - before[1]), 'vertical correction did not reduce synthetic column difference');
    assert.ok(Math.abs(afterBoth[0] - afterBoth[2]) < Math.abs(afterVertical[0] - afterVertical[2]), 'horizontal correction did not reduce synthetic row difference');
    console.log({ before, afterVertical, afterBoth });
    await page.getByRole('slider', { name: 'Frame', exact: true }).fill('1');
    await page.getByText('Frame 2 / 2').waitFor();
    const promised = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download processed frame PNG' }).click();
    assert.equal((await promised).suggestedFilename(), 'clearhot-frame-2.png');
    await page.getByRole('button', { name: 'CNN exploration' }).click();
    await page.getByText('No training, model weights', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Image lab' }).click();
    await page.getByText('Loaded: synthetic.bin (2 frames)').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS synthetic file validation, 640x512 render, both line controls, frame navigation, PNG download and tab retention');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
