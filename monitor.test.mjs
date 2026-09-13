import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readProduct } from './detect.mjs';
import { initialState, transition } from './state.mjs';
import { notify, notificationDay } from './notify.mjs';

const config = { sku: '1000050720-BX', name: 'PlayStation®5 Pro Console - 2TB', url: 'https://direct.playstation.com/nl-nl/buy-consoles/playstation5-pro-console-2-tb' };
const button = (extra = '', label = 'Toevoegen aan wagentje') => `<button data-product-code="${config.sku}" aria-label="${label}" ${extra}>${label}</button>`;
const price = '<span class="js-actual-price-whole" aria-label="€899,99">899,99</span>';
const out = '<div class="js-out-stock-wrpr">Momenteel niet beschikbaar</div>';
const hero = content => `<style>.hide{display:none}</style><div class="productHero-component" data-product-code="${config.sku}"><div class="productHero-info"><h1>${config.name}</h1>${content}</div></div>`;
const stateIssue = () => ({ number: 1, state: 'open', user: { login: 'github-actions[bot]' }, body: '<!-- ps5-watch:state:v1 -->\n```json\n' + JSON.stringify(initialState()) + '\n```' });

test('Rendered DOM: products, hidden buttons, disabled buttons, conflicts, loading and recommendations', async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const scenarios = [
    ['sold out despite buyable recommended accessory', hero(price + out + button('class="hide"')) + button(), 'out_of_stock'],
    ['visible enabled main buy button', hero(price + button()), 'in_stock'],
    ['login-to-buy button also signals availability', hero(price + button('', 'Meld je aan om te kopen')), 'in_stock'],
    ['hidden ancestor blocks a button', hero(price + `<div class="hide">${button()}</div>`), 'unknown'],
    ['disabled buy button', hero(price + button('disabled')), 'unknown'],
    ['ARIA-disabled buy button', hero(price + button('aria-disabled="true"')), 'unknown'],
    ['wrong SKU', hero(price + button()).replaceAll(config.sku, 'accessory-sku'), 'unknown'],
    ['wrong product name', hero(price + button()).replace(config.name, 'Another console'), 'unknown'],
    ['loading price', hero(button()), 'unknown'],
    ['conflicting dynamic fields', hero(price + out + button()), 'unknown'],
    ['stale marketing description does not override dynamic buy button', hero(price + 'Op dit moment uitverkocht.' + button()), 'in_stock'],
    ['missing product / block page', '<h1>Access denied</h1>', 'unknown'],
    ['ambiguous product containers', hero(price + button()) + hero(price + button()), 'unknown']
  ];
  for (const [name, html, expected] of scenarios) {
    await page.setContent(html);
    assert.equal((await page.evaluate(readProduct, config)).status, expected, name);
  }
});

test('One notification per stock episode; unknown does not rearm; three errors warn once', () => {
  let state = initialState();
  const events = [];
  for (const status of ['out_of_stock','in_stock','in_stock','unknown','unknown','unknown','unknown','in_stock','out_of_stock','in_stock']) {
    const step = transition(state, { status });
    state = step.next;
    events.push(...step.events.map(e => e.key + ':' + e.type));
  }
  assert.deepEqual(events, ['stock:1:stock','health:1:health','health:1:recover','stock:2:stock']);
});

test('Only stock creates notifications; errors, recovery and legacy test flags stay silent', async () => {
  const db = [stateIssue()];
  const env = { GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'example/checker', GITHUB_RUN_ID: '1' };
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname;
    const body = options.body && JSON.parse(options.body);
    let data;
    if (options.method === 'GET') data = structuredClone(db);
    else if (options.method === 'POST') {
      data = { ...body, number: db.length + 1, state: 'open', user: { login: 'github-actions[bot]' } };
      db.push(data);
    } else {
      data = db.find(i => i.number === Number(path.split('/').at(-1)));
      Object.assign(data, body);
    }
    return { ok: true, json: async () => structuredClone(data) };
  };
  const result = { status: 'in_stock', checkedAt: '2026-09-13T12:00:00Z', price: '€899,99' };
  for (const status of ['out_of_stock','unknown','unknown','unknown','unknown','out_of_stock'])
    await notify({ status }, config, { ...env, TEST_NOTIFICATION: 'true' }, fetcher);
  assert.equal(db.length, 1, 'No stock means no new issues, even after repeated errors');
  await notify(result, config, env, fetcher);
  db[1].state = 'closed';
  await notify(result, config, env, fetcher);
  assert.equal(db.length, 2);
  await notify({ status: 'out_of_stock' }, config, env, fetcher);
  await notify(result, config, env, fetcher);
  assert.equal(db.length, 2, 'Restocking on the same day does not send another email');
  await notify(result, config, { ...env, TEST_NOTIFICATION: 'true' }, fetcher);
  await notify(result, config, { ...env, TEST_NOTIFICATION: 'true' }, fetcher);
  assert.equal(db.length, 2);
  await notify({ ...result, checkedAt: '2026-09-13T22:01:00Z' }, config, env, fetcher);
  assert.equal(db.length, 3);
  await notify({ ...result, checkedAt: '2026-09-14T12:00:00Z' }, config, env, fetcher);
  assert.equal(db.length, 3, 'Continuous stock sends at most once on the next local day');
  db.push({ number: 4, user: { login: 'github-actions[bot]' }, body: '<!-- ps5-watch:stock:99 -->', created_at: '2026-09-15T08:00:00Z', title: 'op voorraad' });
  await notify({ ...result, checkedAt: '2026-09-15T12:00:00Z' }, config, env, fetcher);
  assert.equal(db.length, 4, 'Legacy stock notifications count toward the same daily limit');
  assert.ok(db.slice(1).every(issue => issue.title.includes('op voorraad')));
});

test('Retry after state write fails does not duplicate already sent stock alert', async () => {
  const db = [stateIssue()];
  let fail = true;
  const fetcher = async (url, options) => {
    const body = options.body && JSON.parse(options.body);
    if (options.method === 'GET') return { ok: true, json: async () => structuredClone(db) };
    if (options.method === 'PATCH' && fail) { fail = false; throw new Error('network timeout'); }
    if (options.method === 'PATCH') Object.assign(db[0], body);
    else db.push({ ...body, number: db.length + 1, user: { login: 'github-actions[bot]' } });
    return { ok: true, json: async () => structuredClone(db.at(-1)) };
  };
  const env = { GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'example/checker' };
  const result = { status: 'in_stock', checkedAt: '2026-09-13T12:00:00Z' };
  await assert.rejects(notify(result, config, env, fetcher), /network timeout/);
  await notify(result, config, env, fetcher);
  assert.equal(db.length, 2);
});

test('Daily limit follows Amsterdam midnight in summer and winter', () => {
  assert.equal(notificationDay('2026-09-13T21:59:59Z'), '2026-09-13');
  assert.equal(notificationDay('2026-09-13T22:00:00Z'), '2026-09-14');
  assert.equal(notificationDay('2026-12-13T22:59:59Z'), '2026-12-13');
  assert.equal(notificationDay('2026-12-13T23:00:00Z'), '2026-12-14');
  assert.throws(() => notificationDay(undefined), /controletijdstip/);
});
