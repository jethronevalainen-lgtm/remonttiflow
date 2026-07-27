# VaKantti CRM

VaKantin CRM on operatiivinen asiakkuus- ja myyntityöpöytä. Sen tarkoitus ei ole toimia irrallisena yhteystietorekisterinä, vaan yhdistää asiakas, kohde, myyntimahdollisuus, tehtävät ja projektit samaan organisaatiorajattuun tietomalliin.

## Pääkokonaisuudet

- **Tilannekuva** näyttää myöhässä olevat tehtävät, puuttuvat seuraavat askeleet ja lähestyvät päätöspäivät.
- **Myyntiputki** käyttää vaiheita Uusi, Kartoitus sovittu, Kartoitettu, Tarjous laskennassa, Tarjous lähetetty, Neuvottelu, Voitettu, Hävitty ja Jäissä.
- **Tehtäväjono** sisältää prioriteetin, vastuuhenkilön, määräajan, asiakas- ja kohdekytkennät sekä valmistumisen seurannan.
- **Asiakas 360°** kokoaa yhteyshenkilöt, kohteet, myyntimahdollisuudet, projektit ja yhteydenottohistorian.
- **Myynnin analyysi** näyttää tarjouskannan, painotetun ennusteen, arvioidun katteen, voittoprosentin ja myyntilähteet.

## Tietokanta

CRM käyttää seuraavia päätauluja:

- `customers`
- `customer_contacts`
- `customer_sites`
- `crm_leads`
- `crm_activities`
- `projects`

Kaikki tietueet rajataan `organization_id`-kentällä. Suorat CRM-taulujen luku- ja kirjoitusoikeudet kuuluvat organisaation hallintarooleille, ja tietokanta valvoo oikeuksia RLS-politiikoilla.

## Pakollinen seuraava askel

Avoimella myyntimahdollisuudella pitää olla:

1. vastuuhenkilö,
2. seuraava toimenpide,
3. toimenpiteen määräaika.

Käyttöliittymä estää puutteellisen avoimen mahdollisuuden tallentamisen ja nostaa myöhässä olevat asiat tilannekuvaan.

## Elinkaaren automaatio

Tietokantatriggerit:

- päivittävät mahdollisuuden viimeisimmän aktiviteetin ajan,
- tallentavat tarjous-, voitto- ja häviöajankohdat,
- säilyttävät muutokset audit-lokissa.

## Migraatiot

- `20260727213000_crm_operating_system.sql`
- `20260727213100_crm_activity_parent_integrity.sql`
