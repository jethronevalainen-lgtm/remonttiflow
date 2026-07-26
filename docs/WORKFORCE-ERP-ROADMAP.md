# VaKantti – koko yrityksen toiminnanohjauksen kehitysohjelma

## Tavoite

VaKantti rakennetaan suomalaiseksi rakennusalan toiminnanohjaus-, työajanseuranta-, henkilöstö-, palkka-aineisto- ja työmaajärjestelmäksi. Tavoite ei ole kopioida Workinfoa käyttöliittymätasolla, vaan toteuttaa samat ydinkyvykkyydet yhtenäisempänä, turvallisempana ja rakennusalan työnjohdon arkea paremmin palvelevana kokonaisuutena.

## Käyttöoikeusperiaate

- Admin hallitsee koko organisaatiota ja kaikkia HR- ja palkkatietoja.
- Työnjohtaja voi jakaa töitä koko organisaation henkilöstölle.
- Työnjohtaja näkee HR- ja palkkatiedot vain niistä työntekijöistä, jotka admin on liittänyt hänen omaan tiimiinsä.
- Työntekijä näkee vain omat HR-, palkka-, työaika-, matka- ja dokumenttitietonsa.
- Tilaaja ei näe sisäisiä henkilöstö- tai palkkatietoja.
- Käyttöoikeusrajat toteutetaan PostgreSQL:n RLS-politiikoilla ja palvelinfunktioilla. Pelkkä käyttöliittymän piilotus ei ole tietoturvaraja.

## Toteutusvaiheet

### Vaihe 1 – henkilöstö- ja työaikaperusta

- työnjohtajakohtaiset omat tiimit
- työntekijän henkilökortti
- työsuhde-, pankki- ja verotiedot
- palkka- ja lisähistoria voimassaolojaksoineen
- työntekijän oma näkymä
- adminin ja oman työnjohtajan rajattu HR-näkymä
- QR-työmaalle kirjautuminen
- työmaan sijaintirajaus
- kahdesti vuorokaudessa ajettava sovellustason varmuuskopio
- varmuuskopioiden ajoloki ja säilytyskierto

### Vaihe 2 – suomalainen työaika- ja TES-moottori

- työaikalajit ja yrityskohtaiset säännöt
- normaalitunnit, 50 % ja 100 % ylityö
- ilta-, yö-, lauantai- ja sunnuntailisät
- matka-aika, kilometrikorvaus, päiväraha ja ateriakorvaus
- automaattiset tauot ja pyöristyssäännöt
- käyttäjä- ja ryhmäkohtaiset kirjausasetukset
- palkkakauden lukitus, korjausketju ja audit trail
- palkka-aineiston tarkistusnäkymä

### Vaihe 3 – taloushallinnon integraatiot

- Netvisor
- Fennoa
- Procountor
- Fivaldi-yhteensopiva siirtotiedosto
- laskutus- ja palkka-aineistojen vientiprofiilit
- integraatioiden virheloki, uudelleenajo ja täsmäytys

### Vaihe 4 – resurssit, varasto ja dokumentit

- työntekijädokumentit ja vanhenemismuistutukset
- kuitti- ja työkuvat
- tuotteet, varastopaikat, huoltoautot ja saldot
- materiaalien otot, palautukset ja työmääräyskohdistus
- toistuvat työvuorot ja vuoropohjat
- yhtenäinen henkilö-, kalusto- ja työmaaresursointi

### Vaihe 5 – raportointi ja automaatio

- käyttäjän muodostamat raporttipohjat
- työajan, palkan, tuottavuuden ja kannattavuuden raportit
- automaattinen ajopäiväkirja ja Mapon-liitäntä
- muistutukset, poikkeamahälytykset ja hyväksyntäjonot
- alihankkijoiden ja vuokratyöntekijöiden rajatut työtilat

## Visuaalinen ja käytettävyyslinja

- mobiilikäyttö suunnitellaan ensisijaiseksi työntekijälle
- tärkeimmät toiminnot ovat yhden tai kahden painalluksen päässä
- teknisiä tietokantatermejä ei näytetä loppukäyttäjälle
- jokainen näkymä kertoo käyttäjälle mitä pitää tehdä seuraavaksi
- kriittiset virheet, puuttuvat kirjaukset ja vanhenevat pätevyydet nostetaan näkyvästi esiin
- desktop-näkymissä käytetään tiiviitä mutta luettavia työpöytiä; mobiilissa korttipohjaisia näkymiä
- visuaalinen laatu, saavutettavuus ja responsiivisuus kuuluvat jokaisen ominaisuuden hyväksymiskriteereihin

## Varmuuskopiointistrategia

1. Supabasen hallittu tietokantavarmistus tai PITR toimii ensisijaisena katastrofipalautuksena.
2. VaKantti muodostaa kahdesti vuorokaudessa oman loogisen JSON-varmuuskopion liiketoimintatauluista yksityiseen Storage-buckettiin.
3. Jokaisesta ajosta tallennetaan tila, tiedostopolku, rivimäärä, koko ja virheviesti.
4. Sovellustason varmuuskopioille käytetään 30 vuorokauden säilytyskiertoa.
5. Storage-tiedostojen erillinen arkistointi lisätään, kun liitteiden määrä kasvaa; Supabasen tietokantavarmistus ei yksin palauta poistettuja Storage-objekteja.
6. Palautusmenettely testataan säännöllisesti erilliseen kehitysprojektiin.

## Hyväksymiskriteeri

Ominaisuutta ei katsota valmiiksi, ennen kuin käyttöoikeudet, tietokantamigraatio, virhetilat, mobiilinäkymä, testit, audit trail ja tuotantoonvientipolku on tarkistettu.