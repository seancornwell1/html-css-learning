/**
 * Screenshot the running game at phone portrait/landscape and desktop sizes,
 * and fail on any console error. Usage:
 *   npm run build && npx vite preview --port 4173 &
 *   npm run shot -- [url] [outDir]
 */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/?seed=1';
const outDir = process.argv[3] ?? 'screenshots';
const preinstalled = '/opt/pw-browsers/chromium';

const viewports = [
  { name: 'phone-portrait', width: 390, height: 844, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'desktop', width: 1280, height: 720, touch: false },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(
  existsSync(preinstalled) ? { executablePath: preinstalled } : {},
);
const errors: string[] = [];
for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    deviceScaleFactor: 2,
  });
  page.on('console', (m) => m.type() === 'error' && errors.push(`${vp.name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${vp.name}: ${e.message}`));
  await page.goto(url);
  await page.waitForTimeout(300);
  if (vp.touch) {
    // Drag the floating joystick from the lower-left (pointer events, like a thumb).
    const x = vp.width * 0.3;
    const y = vp.height * 0.8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 50, y - 10, { steps: 5 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${outDir}/${vp.name}.png` });
    await page.mouse.up();
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${outDir}/${vp.name}.png` });
    await page.keyboard.up('KeyD');
  }
  // Stand and fight until the first level-up appears, then pick a card.
  const shown = await page
    .waitForSelector('#levelup:not([hidden])', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    await page.screenshot({ path: `${outDir}/${vp.name}-levelup.png` });
    await page.keyboard.press('Digit1');
  } else {
    errors.push(`${vp.name}: no level-up within 20 s`);
  }
  await page.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`screenshots written to ${outDir}/`);
