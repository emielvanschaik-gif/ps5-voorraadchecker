import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readProduct } from './detect.mjs';
import { notify } from './notify.mjs';

const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8'));
const target = new URL(config.url);
if (target.origin !== 'https://direct.playstation.com' || !target.pathname.startsWith('/nl-nl/buy-'))
  throw new Error('Alleen openbare Nederlandse PlayStation-productpagina’s worden ondersteund.');
let result;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'nl-NL', viewport: { width: 1440, height: 1000 } });
  // No login, cookies from an account, cart actions, or checkout are used.
  const response = await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: config.loadTimeoutMs });
  if (!response?.ok()) throw new Error(`Productpagina HTTP ${response?.status() || 'onbekend'}`);
  if (new URL(page.url()).pathname !== target.pathname) throw new Error('Onverwachte doorverwijzing.');
  const deadline = Date.now() + config.loadTimeoutMs;
  let previousStatus = 'unknown';
  let stable = false;
  // Two consistent samples avoid treating a transient render as availability.
  while (Date.now() < deadline) {
    result = await page.evaluate(readProduct, config);
    if (result.status !== 'unknown' && result.status === previousStatus) { stable = true; break; }
    previousStatus = result.status;
    await page.waitForTimeout(1500);
  }
  if (!stable)
    result = { status: 'unknown', reason: 'Geen stabiele voorraadstatus binnen de wachttijd.' };
} catch (error) {
  result = { status: 'unknown', reason: String(error.message).slice(0, 300) };
} finally {
  await browser?.close();
}
result.checkedAt = new Date().toISOString();
console.log(JSON.stringify(result, null, 2));
await writeFile('result.json', JSON.stringify(result, null, 2));
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## PS5 Pro voorraad\n\nStatus: **${result.status}**\n\nTijd: ${result.checkedAt}\n\n[Productpagina](${config.url})\n`);
if (!process.argv.includes('--dry-run')) await notify(result, config);
