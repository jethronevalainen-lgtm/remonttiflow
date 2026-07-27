# VaKantti CRM

VaKantin CRM on operatiivinen asiakkuus- ja myyntityöpöytä. Sen tarkoitus ei ole toimia irrallisena yhteystietorekisterinä, vaan yhdistää asiakas, kohde, myyntimahdollisuus, tehtävät, projektit ja työn valmistumisen jälkeinen asiakashoito samaan organisaatiorajattuun tietomalliin.

## Pääkokonaisuudet

- **Tilannekuva** näyttää myöhässä olevat tehtävät, puuttuvat seuraavat askeleet ja lähestyvät päätöspäivät.
- **Myyntiputki** käyttää vaiheita Uusi, Kartoitus sovittu, Kartoitettu, Tarjous laskennassa, Tarjous lähetetty, Neuvottelu, Voitettu, Hävitty ja Jäissä.
- **Tehtäväjono** sisältää prioriteetin, vastuuhenkilön, määräajan, asiakas- ja kohdekytkennät sekä valmistumisen seurannan.
- **Asiakas 360°** kokoaa yhteyshenkilöt, kohteet, myyntimahdollisuudet, projektit ja yhteydenottohistorian.
- **Myynnin analyysi** näyttää tarjouskannan, painotetun ennusteen, arvioidun katteen, voittoprosentin ja myyntilähteet.
- **Reklamaatiot ja takuu** ohjaavat ilmoituksen selvityksestä korjaukseen, asiakkaan hyväksyntään ja sulkemiseen.

## Tietokanta

CRM käyttää seuraavia päätauluja:

- `customers`
- `customer_contacts`
- `customer_sites`
- `crm_leads`
- `crm_activities`
- `customer_cases`
- `change_orders`
- `customer_users`
- `projects`

Kaikki tietueet rajataan `organization_id`-kentällä. Suorat CRM-taulujen luku- ja kirjoitusoikeudet kuuluvat organisaation hallintarooleille, ja tietokanta valvoo oikeuksia RLS-politiikoilla. Asiakas näkee vain hänelle julkaistut jälkihoitoasiat niissä projekteissa, joihin hänellä on asiakasportaalin käyttöoikeus.

## Pakollinen seuraava askel

Avoimella myyntimahdollisuudella pitää olla:

1. vastuuhenkilö,
2. seuraava toimenpide,
3. toimenpiteen määräaika.

Käyttöliittymä estää puutteellisen avoimen mahdollisuuden tallentamisen ja nostaa myöhässä olevat asiat tilannekuvaan.

## Reklamaatio- ja takuuketju

Jälkihoitoasian elinkaari on:

1. Uusi
2. Selvityksessä
3. Korjaus sovittu
4. Korjauksessa
5. Odottaa asiakkaan hyväksyntää
6. Suljettu tai Hylätty

Asiakkaan projektinäkymässä luotu `Reklamaatio`-työpyyntö muodostaa automaattisesti CRM-asian. Työnjohto kirjaa vastuuhenkilön, määräajan, takuupäätöksen, juurisyyn, kustannukset ja ratkaisun. Ratkaisu voidaan julkaista asiakkaan hyväksyttäväksi. Hyväksyntä sulkee asian; hylkäys vaatii perustelun ja palauttaa asian selvitykseen.

## Elinkaaren automaatio

Tietokantatriggerit:

- päivittävät mahdollisuuden viimeisimmän aktiviteetin ajan,
- tallentavat tarjous-, voitto- ja häviöajankohdat,
- muodostavat reklamaatiotyöpyynnöstä asiakasasian,
- säilyttävät CRM:n ja jälkihoidon muutokset audit-lokissa.

## Tuotantovarmennus

Jälkihoitoketju varmennetaan tuotantotietokannassa palautettavilla transaktiotesteillä:

- reklamaatiotyöpyynnöstä muodostuu oikeaan asiakkaaseen ja projektiin linkitetty CRM-asia,
- kiireellinen reklamaatio saa kriittisen prioriteetin ja määräajan,
- asiakas näkee vain julkaistun asian omassa projektissaan,
- asiakkaan hyväksyntä sulkee asian ja tallentaa päätöksen,
- asiakkaan hylkäys vaatii palvelimella perustelun,
- testitietueet palautetaan transaktion lopuksi eikä niitä jää tuotantodataan.

## Migraatiot

- `20260727213000_crm_operating_system.sql`
- `20260727213100_crm_activity_parent_integrity.sql`
- `20260727213200_crm_lead_project_conversion.sql`
- `20260727213300_crm_index_hardening.sql`
- `20260727221000_crm_aftercare_cases.sql`
- `20260727221100_customer_cases_select_policy.sql`
