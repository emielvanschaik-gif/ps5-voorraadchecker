// This function runs inside the browser. Only the primary product is inspected.
export function readProduct(config) {
  const visible = el => !!el && el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const heroes = [...document.querySelectorAll('.productHero-component')];
  if (heroes.length !== 1 || heroes[0].getAttribute('data-product-code') !== config.sku)
    return { status: 'unknown', reason: 'Hoofdproduct ontbreekt of productnummer wijkt af.' };
  const info = heroes[0].querySelector('.productHero-info');
  if (!info) return { status: 'unknown', reason: 'Productinformatie ontbreekt.' };
  const name = info.querySelector('h1')?.textContent.trim();
  if (name !== config.name) return { status: 'unknown', reason: 'Productnaam wijkt af.' };
  const unavailable = [...info.querySelectorAll('.js-out-stock-wrpr, .js-currently-unavailable-wrpr, .js-coming-soon-wrpr')].some(visible);
  const buttons = [...info.querySelectorAll('button[data-product-code]')].filter(el =>
    el.getAttribute('data-product-code') === config.sku && visible(el) &&
    !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  const buy = buttons.some(el => ['Toevoegen aan wagentje', 'Meld je aan om te kopen'].includes(
    (el.getAttribute('aria-label') || el.textContent).trim()));
  const prices = [...info.querySelectorAll('.js-actual-price-whole')].filter(visible);
  const price = prices[0]?.getAttribute('aria-label') || null;
  if (buy && unavailable) return { status: 'unknown', reason: 'Tegenstrijdige voorraadsignalen.' };
  if (unavailable) return { status: 'out_of_stock', price, reason: 'Voorraadveld: niet beschikbaar.' };
  if (buy && price) return { status: 'in_stock', price, reason: 'Actieve koopknop voor dit product.' };
  return { status: 'unknown', reason: 'Prijs of definitieve voorraadstatus nog niet geladen.' };
}
