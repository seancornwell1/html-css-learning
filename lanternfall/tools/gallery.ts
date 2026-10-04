/**
 * Screenshot debug loadouts (via ?grant=) to eyeball weapon art and effects.
 * Usage (with `vite preview --port 4173` running):
 *   npx tsx tools/gallery.ts <outDir> name=id:lvl,id:lvl [name=...]
 */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const outDir = process.argv[2] ?? 'screenshots';
const sets = process.argv.slice(3).map((arg) => {
  const [name, grant] = arg.split('=');
  return { name: name ?? 'set', grant: grant ?? '' };
});
mkdirSync(outDir, { recursive: true });
const preinstalled = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(
  existsSync(preinstalled) ? { executablePath: preinstalled } : {},
);
for (const { name, grant } of sets) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error(`${name}: ${e.message}`));
  await page.goto(`http://localhost:4173/?seed=3&notice=skip&fx=high&grant=${grant}`);
  await page.keyboard.down('KeyD');
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(1000);
    if (await page.isVisible('#levelup:not([hidden])')) await page.keyboard.press('Digit1');
  }
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: `${outDir}/gallery-${name}.png` });
  await page.close();
}
await browser.close();
