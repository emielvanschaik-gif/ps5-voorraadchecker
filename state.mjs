export const initialState = () => ({ version: 1, lastKnown: 'unknown', stockEpisode: 0, failures: 0, healthEpisode: 0 });

export function transition(previous, result) {
  const next = { ...previous };
  const events = [];
  if (result.status === 'unknown') {
    next.failures = Math.min(3, previous.failures + 1);
    if (next.failures === 3 && previous.failures < 3) {
      next.healthEpisode++;
      events.push({ type: 'health', key: `health:${next.healthEpisode}` });
    }
    // A failed request never means sold out, and never rearms the stock alert.
  } else {
    if (previous.failures >= 3) events.push({ type: 'recover', key: `health:${previous.healthEpisode}` });
    next.failures = 0;
    if (result.status === 'in_stock' && previous.lastKnown !== 'in_stock') {
      next.stockEpisode++;
      events.push({ type: 'stock', key: `stock:${next.stockEpisode}` });
    }
    next.lastKnown = result.status;
  }
  return { next, events };
}
