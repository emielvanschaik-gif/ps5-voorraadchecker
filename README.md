# PS5 Pro voorraadchecker

Deze checker controleert ongeveer elke vijf minuten de Nederlandse PlayStation Direct-pagina. **Alleen bij beschikbare voorraad wordt een nieuwe melding verstuurd.** Je computer mag uitstaan.

- Geen testmeldingen, foutmeldingen of herstelmeldingen.
- Geen herhaalde melding zolang de voorraadstatus gelijk blijft. Na een waargenomen uitverkochte periode kan een nieuwe voorraadmelding volgen.
- Geen aankopen, winkelwagenacties of Sony-aanmelding.
- Je bent via GitHub geabonneerd op Issues; e-mailmeldingen zijn ingeschakeld in je GitHub-account.

[Uitvoeringen bekijken](https://github.com/emielvanschaik-gif/ps5-voorraadchecker/actions/workflows/voorraad.yml) · [Voorraadmeldingen](https://github.com/emielvanschaik-gif/ps5-voorraadchecker/issues)

## Beheer

Stoppen: Actions → PS5 voorraad → menu met drie puntjes → Disable workflow.
Handmatig controleren: Run workflow. Ook dan wordt alleen bij voorraad een melding gestuurd.

Issue #1 bewaart de monitorstatus. Laat de issue en de inhoud staan. De bestaande testmelding is historisch; nieuwe testmeldingen zijn uitgeschakeld. Als de statusopslag ontbreekt, stopt de meldingsstap stil en moet de statusopslag worden hersteld.

Fouten zijn uitsluitend in de uitvoerlogs zichtbaar. De job mag mislukken zonder de workflow als mislukt te markeren, zodat gewone uitvoeringsfouten geen GitHub-foutmail veroorzaken. Een groen workflowvinkje is dus geen bewijs dat de voorraadcontrole gelukt is: lees daarvoor de job en samenvatting.

## Gratis en zonder eigen computer

Deze openbare repository gebruikt een standaard GitHub Ubuntu-runner, zonder betaalde AI-API, cloudbrowser of extra notificatiedienst. GitHub kan controles vertragen of overslaan. Na 60 dagen zonder repositoryactiviteit schakelt GitHub geplande taken uit; je moet de workflow dan zelf weer activeren.

De melding is een indicatie, geen reservering. De detector controleert productnummer, productnaam, zichtbare prijs en een actieve koopknop van het hoofdproduct. Aanbevolen accessoires worden genegeerd. Als de website wijzigt of blokkeert, blijft de checker stil.

## Lokaal testen

Met Node.js 24 en pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
pnpm check --dry-run
```

De dry-run verstuurt niets. Configuratie staat in config.json. De tests controleren voorraadherkenning, dubbele meldingen en stilte bij fouten, herstel en oude testopties.
