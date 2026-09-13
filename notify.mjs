import { initialState, transition } from './state.mjs';

const stateMarker = '<!-- ps5-watch:state:v1 -->';
const marker = key => `<!-- ps5-watch:${key} -->`;
export function notificationDay(instant) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Geldig controletijdstip ontbreekt.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export async function notify(result, config, env = process.env, fetcher = fetch) {
  if (!env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || ''))
    throw new Error('GitHub-token of repository ontbreekt. Lokaal: gebruik --dry-run.');
  const base = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}`;
  async function api(path, method = 'GET', body) {
    const response = await fetcher(base + path, {
      method, signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
    return response.json();
  }
  const issues = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/issues?state=all&per_page=100&page=${page}`);
    issues.push(...batch.filter(i => !i.pull_request && i.user?.login === 'github-actions[bot]'));
    if (batch.length < 100) break;
  }
  let stateIssue = issues.find(i => i.body?.startsWith(stateMarker));
  let previous = initialState();
  if (stateIssue) {
    const match = stateIssue.body.match(/```json\s*([\s\S]*?)```/);
    if (!match) throw new Error('Statusopslag is gewijzigd; herstel het statusissue.');
    previous = JSON.parse(match[1]);
    if (previous.version !== 1 || !['unknown','in_stock','out_of_stock'].includes(previous.lastKnown) ||
      !['stockEpisode','healthEpisode','failures'].every(k => Number.isInteger(previous[k]) && previous[k] >= 0))
      throw new Error('Ongeldige statusopslag; geen melding verzonden.');
  }
  const stateBody = state => `${stateMarker}\nDeze issue bewaart de monitorstatus. Laat de inhoud staan.\n\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n\nOntvang meldingen: Watch → Custom → Issues, en schakel e-mail in bij GitHub Notifications.\nStoppen: Actions → PS5 voorraad → Disable workflow.`;
  if (!stateIssue) throw new Error('Statusissue ontbreekt. Herstel de bestaande statusopslag; er wordt geen niet-voorraadmelding aangemaakt.');
  const { next } = transition(previous, result);
  const day = result.status === 'in_stock' ? notificationDay(result.checkedAt) : null;
  const events = day ? [{ type: 'stock', key: `daily-stock:${day}` }] : [];
  const runUrl = `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  for (const event of events) {
    if (event.type !== 'stock') continue;
    const existing = issues.find(i => i.body?.startsWith(marker(event.key)) ||
      (i.body?.startsWith('<!-- ps5-watch:stock:') && i.created_at && notificationDay(i.created_at) === day));
    // One alert per Amsterdam calendar day, also across restocks, closed issues and API retries.
    if (existing) continue;
    const text = {
      title: '🟢 PS5 Pro 2 TB mogelijk op voorraad!',
      body: `De productpagina toont een actieve koopknop.\n\n[Open het product](${config.url})\n\nPrijs op de pagina: ${result.price || 'onbekend'}.\nGecontroleerd: ${result.checkedAt}.\n\nEr is niets gereserveerd of besteld. Voorraad kan intussen veranderen.`
    };
    await api('/issues', 'POST', { title: text.title, body: `${marker(event.key)}\n${text.body}\n\n[Uitvoering bekijken](${runUrl})` });
  }
  if (JSON.stringify(previous) !== JSON.stringify(next))
    await api(`/issues/${stateIssue.number}`, 'PATCH', { body: stateBody(next) });
}
