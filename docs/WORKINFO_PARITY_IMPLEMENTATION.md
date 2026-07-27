# VaKantti – Workinfo-toiminnallisuuksien toteutusohjelma

Tämä ohjelma toteuttaa Workinfo-auditissa tunnistetut operatiiviset kokonaisuudet VaKanttiin VaKantin omalla tietomallilla, käyttöoikeuksilla ja mobiilikäytettävyydellä.

## Tavoite

VaKantti kokoaa samaan järjestelmään reaaliaikaisen työmaatilanteen, työaika- ja selostekirjaukset, raportoinnin, laskutusaineiston, alihankkijat sekä ajoneuvointegraatioiden rajapinnan.

## Työpaketit

1. **Reaaliaikainen työnjohdon tilannekuva**
   - Työmailla nyt
   - työmaakohtaiset henkilömäärät
   - aktiivisen kirjautumisen kesto
   - sijaintivarmennus
   - puuttuvat kuvaukset ja avoimeksi jääneet kirjautumiset
   - viimeisimmät työselosteet

2. **Raporttikeskus**
   - kuukausi- ja päivämäärärajaukset
   - henkilöstö-, projekti- ja hyväksyntäsuodattimet
   - työaika-, läsnäolo-, seloste-, kilometri-, matka- ja alihankkijaraportit
   - PDF-, XLSX-, CSV- ja tulostusnäkymät

3. **Kirjaukset-keskus**
   - työaika
   - kilometrit
   - kulut
   - materiaalit ja tuotteet
   - koneiden käyttötunnit
   - päivän vapaa seloste

4. **Laskutettavuuden tilaketju**
   - kirjattu → hyväksytty → laskutettava → laskulle lisätty → laskutettu
   - asiakas-, projekti-, työmääräys- ja hintaperuste
   - laskutusaineiston poikkeamat
   - laskutettavan ja laskulle lisäämättömän työn mittarit

5. **Alihankkijat**
   - yritys, Y-tunnus, yhteyshenkilöt ja työntekijät
   - projektit, sopimukset, hinnat ja voimassaolo
   - pätevyydet ja dokumentit
   - QR-kirjautumisoikeudet ja ulkopuolisen henkilön tunniste

6. **Ajoneuvot ja integraatiot**
   - ajoneuvorekisteri, käyttö, kuljettaja ja huolto
   - neutraali telematiikkarajapinta
   - Mapon-tyyppisen datan vastaanotto ilman puhelimen jatkuvaa seurantaa
   - karttanäkymä vain ajoneuvon omasta GPS-/integraatiodatasta

## Pakottavat rajat

- Ei jatkuvaa työntekijän taustasijainnin seurantaa.
- Kaikki organisaatio-, projekti-, tiimi- ja HR-rajat pakotetaan tietokannassa.
- Talousmittareita ei näytetä ilman jäljitettävää hintaperustetta ja laskutuksen tilaa.
- Raporttien luvut lasketaan palvelimella.
- Työnjohtaja näkee HR- ja palkkatietoja vain omasta HR-tiimistään, vaikka töitä voi kohdistaa kaikille.
- Tilaaja ei saa sisäisiä henkilöstö-, kustannus- tai laskentatietoja.

## Julkaisumalli

Kokonaisuus toimitetaan erillisinä, tuotantoon vietävinä PR:inä. Jokainen työpaketti sisältää tietomallin, RLS/RPC-testit, käyttöliittymän, mobiilitestin ja tuotantovarmennuksen.
