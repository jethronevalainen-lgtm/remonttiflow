# VaKantti – automaattinen ilmoitusmoottori

Päiväys: 27.7.2026

## Tavoite

VaKantti muodostaa palvelinpuolisesti kohdennettuja ilmoituksia työntekijöille ja työnjohdolle. Ilmoitukset eivät riipu siitä, onko sovellus avoinna, ja ne näkyvät käyttäjän kellovalikossa seuraavalla käyttökerralla tai reaaliaikaisesti sovelluksen ollessa auki.

## Ensimmäisen vaiheen säännöt

1. **Työvuoron alkamismuistutus työntekijälle**
   - muodostetaan asetetun minuuttimäärän verran ennen työvuoron alkua
   - poistuu, kun työvuoro alkaa tai käyttäjä kirjautuu sisään

2. **Puuttuvan sisäänkirjautumisen muistutus työntekijälle**
   - muodostetaan työvuoron alkamisajan ja asetetun liukuman jälkeen
   - hyväksytty poissaolo estää ilmoituksen
   - poistuu kirjautumisen jälkeen tai työvuoron tarkistusikkunan päätyttyä

3. **Puuttuvan sisäänkirjautumisen hälytys työnjohtajalle**
   - ensisijainen vastaanottaja on työntekijälle määritetty esihenkilö
   - toissijainen vastaanottaja on projektin vastuullinen työnjohtaja
   - jos kumpaakaan ei ole määritetty, ilmoitus kohdistetaan organisaation työnjohtajille

4. **Työmääräyksen määräaikamuistutus**
   - muodostetaan asetettu määrä päiviä ennen määräpäivää
   - vastaanottaja on nimetty työntekijä tai projektitiimi työn kohdistustavan mukaisesti

5. **Myöhässä olevan työmääräyksen ilmoitus**
   - säilyy avoimena, kunnes työ valmistuu, perutaan tai määräpäivä siirretään
   - ilmoituksen sisältö päivittyy myöhästymispäivien mukaan ilman uusia kaksoiskappaleita

## Arkkitehtuuri

- `organization_settings`: organisaation ilmoitussäännöt ja aikarajat
- `app_notifications`: pysyvät, käyttäjäkohtaiset ilmoitukset
- PostgreSQL-funktio: tarkistaa työvuorot, kirjautumiset, poissaolot ja työmääräykset
- `pg_cron`: suorittaa tarkistuksen viiden minuutin välein
- RLS: käyttäjä näkee vain omat ilmoituksensa
- Realtime: avoin sovellus päivittyy ilman sivun lataamista
- audit-loki: asetusten muutokset kirjataan

## Hallittavat asetukset

- koko ilmoituskeskuksen käyttöönotto
- puuttuvan kirjautumisen hälytykset
- sallittu liukuma 0–240 minuuttia
- työvuoron alkamismuistutus 0–240 minuuttia ennen alkua
- työmääräyksen määräaikamuistutus 0–30 päivää ennen määräpäivää
- myöhässä olevien työmääräysten ilmoitukset

## Luotettavuusperiaatteet

- sama tilanne ei tuota rajattomasti uusia ilmoituksia; jokaisella ilmoituksella on yksilöllinen deduplikointiavain
- ilmoitus ratkaistaan automaattisesti, kun lähdetilanne korjaantuu
- hyväksytty poissaolo estää puuttuvan kirjautumisen hälytyksen
- työvuoron kellonaika tulkitaan organisaation aikavyöhykkeellä
- työntekijän ja työnjohtajan ilmoitukset ovat erillisiä, jotta vastaanottajan toimintakehotus on yksiselitteinen

## Seuraavat vaiheet

Nykyinen tietomalli mahdollistaa myöhemmin lisättävät säännöt ilman uutta ilmoitustaulua. Jatkokehitykseen kuuluvat selaimen/PWA:n push-ilmoitukset käyttäjän suostumuksella, pätevyyksien vanhenemismuistutukset, vakavien turvallisuushavaintojen välitön eskalointi sekä käyttäjäkohtaiset hiljaiset ajat ja ilmoituskanavavalinnat.
