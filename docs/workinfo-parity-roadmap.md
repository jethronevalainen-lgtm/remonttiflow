# VaKantti – Workinfo-pariteetin toteutuskokonaisuus

Tämä työpaketti kokoaa Workinfo-auditoinnissa tunnistetut ominaisuudet VaKanttiin siten, että toteutus perustuu VaKantin nykyiseen rooli-, projekti-, tunti-, QR-, palkka- ja raportointimalliin.

## Toteutettavat kokonaisuudet

1. Reaaliaikainen **Työmailla nyt** -tilannekuva
2. **Viimeisimmät työselosteet** ja puutteellisten selosteiden laadunvarmistus
3. Avoimeksi jääneiden työaikojen, poikkeavan pitkien vuorojen ja sijaintipoikkeamien hälytykset
4. PDF-, XLSX-, CSV- ja tulostusraportointi
5. Yhdistetty **Kirjaukset**-keskus: tunnit, kilometrit, kulut, materiaalit, koneet ja päiväseloste
6. Alihankkijarekisteri, alihankkijoiden työntekijät, sopimukset, pätevyydet ja työmaaoikeudet
7. Laskutettavuuden tilaketju: kirjattu → hyväksytty → laskutettava → laskulle lisätty → laskutettu → hyvitetty/hylätty
8. Rakentamiseen liittyvän tiedonantoraportoinnin tietomalli ja vienti
9. Ajoneuvoseurannan integraatiorajapinta; varsinainen kartta vain ulkoisen GPS-lähteen kautta
10. Lukitun palkkakauden hallittu korjausketju
11. Kilometrikorvauksen ja päivärahojen automaattinen laskenta organisaation sääntöjen mukaan

## Toteutusperiaatteet

- Kaikki käyttöoikeusrajaukset palvelimella ja RLS-tasolla.
- Aktiivinen työaikasessio tallennetaan palvelimelle; localStorage ei ole lähdejärjestelmä.
- Sama käyttäjä voi pitää vain yhtä aktiivista työaikasessiota organisaatiossa.
- Työmaalle kirjautuminen ja uloskirjautuminen muodostavat muuttumattoman audit-lokin.
- Tilaaja ei näe henkilöstö-, palkka-, sisäisiä kustannus- tai sisäisiä viestitietoja.
- Jatkuvaa työntekijän sijaintiseurantaa ei toteuteta. Sijainti tallennetaan kirjautumis- ja tarvittaessa uloskirjautumishetkellä.
- Euromittareita ei näytetä ennen kuin hinnan lähde, laskutettavuus ja laskutuksen tila ovat yksiselitteiset.
- Uudet kokonaisuudet julkaistaan pieninä, testattavina PR:inä tuotantoon.

## Julkaisuvaiheet

### Vaihe A – aktiiviset työvuorot ja työnjohdon live-näkymä
- palvelinpuolinen aktiivinen työaikasessio
- turvallinen sisään-/uloskirjaus
- Työmailla nyt -kortti
- live-poikkeamat
- työselostesyöte

### Vaihe B – raportointi ja kirjauskeskus
- raporttityypit ja tallennetut rajaukset
- PDF/XLSX/CSV/tulostus
- Kirjaukset-keskus
- työselosteiden laadunvarmistus

### Vaihe C – alihankkijat ja laskutettavuus
- alihankkijarekisteri
- pätevyydet ja työmaaoikeudet
- laskutettavuuden tilaketju
- laskutuksen poikkeamat

### Vaihe D – palkka- ja viranomaisjatkot
- lukitun palkkakauden korjausketju
- kilometrikorvausten ja päivärahojen automaatio
- rakentamisen tiedonantoraportointi

### Vaihe E – ajoneuvointegraatio
- integraatiorajapinta Maponille tai vastaavalle
- ajoneuvojen viimeisin sijainti, käyttöaste ja huoltohälytykset

## Valmistumiskriteeri

Kokonaisuus on valmis vasta, kun jokainen vaihe on testattu rooleittain, migraatiot on ajettu tuotantoon, Edge Functionit on julkaistu, Cloudflare-julkaisu on varmennettu oikealla commitilla ja audit-loki osoittaa käyttöoikeus- sekä työaikatapahtumat.