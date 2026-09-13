import { initialState, transition } from './state.mjs';

const stateMarker = '<!-- ps5-watch:state:v1 -->';
const marker = key => `<!-- ps5-watch:${key} -->`;

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
  if (!stateIssue) stateIssue = await api('/issues', 'POST', { title: '⚙️ PS5 voorraadchecker — statusopslag', body: stateBody(previous) });
  const { next, events } = transition(previous, result);
  if (env.TEST_NOTIFICATION === 'true') events.push({ type: 'test', key: `test:${env.GITHUB_RUN_ID}` });
  const runUrl = `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  for (const event of events) {
    const existing = issues.find(i => i.body?.startsWith(marker(event.key)));
    if (event.type === 'recover') {
      if (existing?.state === 'open') await api(`/issues/${existing.number}`, 'PATCH', { state: 'closed' });
      continue;
    }
    // Idempotency: an API timeout after issue creation cannot create duplicate alerts.
    if (existing) continue;
    const text = event.type === 'stock' ? {
      title: '🟢 PS5 Pro 2 TB mogelijk op voorraad!',
      body: `De productpagina toont een actieve koopknop.\n\n[Open het product](${config.url})\n\nPrijs op de pagina: ${result.price || 'onbekend'}.\nGecontroleerd: ${result.checkedAt}.\n\nEr is niets gereserveerd of besteld. Voorraad kan intussen veranderen.`
    } : event.type === 'test' ? {
      title: '🔔 Testmelding PS5 voorraadchecker', body: 'Dit is een test van de meldingen, geen voorraadmelding. Ontvang je deze ook per e-mail?'
    } : {
      title: '⚠️ PS5 voorraadcontrole lukt niet',
      body: 'Drie opeenvolgende controles leverden geen betrouwbare voorraadstatus op. Controleer de laatste uitvoering. Bij herstel wordt deze issue automatisch gesloten.'
    };
    await api('/issues', 'POST', { title: text.title, body: `${marker(event.key)}\n${text.body}\n\n[Uitvoering bekijken](${runUrl})` });
  }
  if (JSON.stringify(previous) !== JSON.stringify(next))
    await api(`/issues/${stateIssue.number}`, 'PATCH', { body: stateBody(next) });
}
