# PS5 Pro voorraadchecker

Controleert de Nederlandse PlayStation Direct-pagina ongeveer elke vijf minuten, zonder inloggen of bestellen. Bij een actieve koopknop verschijnt een GitHub Issue. Met GitHub-notificaties ontvang je die per e-mail. Geen betaalde AI-API of extra notificatiedienst nodig.

## Online zetten voor emielvanschaik-gif

1. Maak op GitHub een **public** repository `ps5-voorraadchecker` aan, met Issues ingeschakeld.
2. Upload de inhoud van deze map, inclusief `.github/workflows/voorraad.yml` en `pnpm-lock.yaml`. Upload **niet** `node_modules`. De workflow moet op de standaardbranch staan. Bij upload via de website moet je de verborgen map `.github` mogelijk apart aanmaken: Add file → Create new file → `.github/workflows/voorraad.yml`.
3. Kies bovenaan de repository **Watch → Custom → Issues** (of All Activity).
4. Schakel in [GitHub Notifications](https://github.com/settings/notifications) e-mail voor Watching in. Gebruik een geverifieerd e-mailadres.
5. Ga naar **Actions → PS5 voorraad → Run workflow**, vink de testmelding aan en start. Controleer zowel het resultaat onder Actions als de testmelding in je inbox. Een groen vinkje betekent dat de taak draaide; lees ook de voorraadstatus in het overzicht.
6. Vanaf nu start de planning op minuut 2, 7, 12, …, 57. Je eigen computer mag uitstaan.

Er is geen persoonlijk toegangstoken nodig: GitHub geeft de workflow automatisch een tijdelijk token met leesrechten op bestanden en schrijfrechten op Issues in deze repository.

## Wat krijg je?

- Eenmalig een statusissue voor interne opslag. Laat de inhoud en deze issue staan; verwijderen wist de meldingshistorie.
- Een voorraadmelding zodra de hoofdproductknop beschikbaar wordt, ook als deze “Meld je aan om te kopen” zegt.
- Geen herhaalde melding zolang de voorraadstatus hetzelfde blijft. Na een waargenomen uitverkochte periode kan een nieuwe melding volgen. Alleen een melding sluiten activeert geen nieuwe melding.
- Een waarschuwing na drie opeenvolgende onzekere controles, bijvoorbeeld door blokkade, laden of een gewijzigde website. Deze issue sluit bij herstel.
- Een optionele testmelding via Run workflow. Hiervoor moet de uitvoering tot de meldingsstap komen.

De melding is een indicatie, geen reservering. De checker raakt winkelwagen, Sony-account en checkout niet aan. Er worden geen accountcookies, persoonsgegevens of screenshots opgeslagen.

## Gratis gebruik en beperkingen

Gebruik een openbare repository en de standaard Ubuntu-runner. De workflow slaat geen Actions-artifacts op en gebruikt geen betaalde cloudbrowser. GitHub kan de planning vertragen of controles overslaan. Na 60 dagen zonder repositoryactiviteit schakelt GitHub geplande taken in openbare repositories uit; zet ze dan bewust opnieuw aan. Deze checker probeert die beperking niet te omzeilen.

De repository, uitvoerlogs en Issues zijn openbaar. Plaats er geen wachtwoorden of andere privégegevens in. E-mailbezorging hangt af van je GitHub-notificatie-instellingen: controleer de testmelding. Blokkeert Sony de GitHub-browser, dan meldt de checker na drie controles een probleem; werking vanuit GitHub moet na installatie live worden geverifieerd.

Bronnen: [GitHub kosten](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [planning](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [meldingen](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications).

## Stoppen

Actions → PS5 voorraad → menu met drie puntjes → Disable workflow.

## Lokaal testen (optioneel)

Installeer Node.js 24 en pnpm 11.19.0. In deze map:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
pnpm check --dry-run
```

De dry-run print de gevonden status en schrijft `result.json`, zonder een bericht te versturen. `config.json` bevat URL, productnaam, productnummer en wachttijd. De detector verwacht de geverifieerde hoofdproductstructuur; bij afwijking geeft hij `unknown`.

De tests controleren onder andere beschikbare accessoires naast een uitverkochte console, verborgen knoppen, verkeerde productnummers, ontbrekende prijs, tegenstrijdige signalen, dubbele meldingen en herhaling na een onderbroken GitHub-aanroep.
