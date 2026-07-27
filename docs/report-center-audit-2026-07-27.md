# Raporttikeskuksen auditointi ja päätöksenteon tuki

Päiväys: 27.7.2026

## Lähtötilanne

Raporttikeskus muodosti kuusi palvelinpuolista raporttia ja tuki CSV-, Excel-, PDF- ja tulostusvientejä. Aineisto oli teknisesti käyttökelpoista, mutta käyttöliittymä ja viennit painottivat yksittäisiä rivejä. Käyttäjän oli itse pääteltävä, mitkä kirjaukset vaativat toimenpiteitä.

## Auditoinnin keskeiset havainnot

1. Raportit olivat pääosin rivitaulukoita, eivät työnjohdon tilannekuvia.
2. Projektin ja kaluston tilasuodatus oli palvelimella mahdollinen, mutta käyttöliittymä ei tarjonnut valintoja.
3. Kalustoraportti kuvaa nykytilannetta, vaikka käyttöliittymä esitti sille päivämäärärajauksen.
4. Projektikoosteen ajanjakso rajaa tuntitoteumaa, mutta projektin budjetti ja nykytila ovat kokonaisarvoja. Tätä ei selitetty.
5. Viennit eivät sisältäneet raportin rajauksia, tunnuslukujen selitteitä tai tarkistettavia poikkeamia riittävän selkeästi.
6. Tulostaulukosta puuttui paikallinen haku, joten suuren aineiston tarkistaminen oli hidasta.

## Toteutettu ratkaisu

### Käyttöpolku

- raporttityypit kuvataan käyttötarkoituksen kautta
- valmiit ajanjaksot: tämä kuukausi, viime kuukausi, tämä viikko, viimeiset 30 päivää ja tämä vuosi
- kalustoraportin päivämäärärajaus poistettu näkyvistä
- projektikoosteen ajanjakson merkitys selitetty
- projektin ja kaluston tilasuodattimet tuotu käyttöliittymään
- vanhentunut tulos poistetaan heti, kun käyttäjä muuttaa rajauksia

### Raporttikohtainen analyysi

Raportin palvelimelta palauttamia rivejä analysoidaan selaimessa ilman uusia tietokantaoikeuksia tai tauluja.

- **Työaika:** hylätyt ja odottavat kirjaukset, puuttuvat selosteet, hyväksymisaste sekä tunnit henkilöittäin ja projekteittain
- **Työselosteet:** puuttuvat ja liian lyhyet selosteet, hyväksyntäjono sekä tuntijakaumat
- **Läsnäolo:** avoimet kirjautumiset, yli 12 tunnin läsnäolot, työmaa-alueen ulkopuoliset kirjautumiset ja heikko paikannustarkkuus
- **Matka ja kulut:** hylätty ja odottava euromäärä, puuttuvat liitteet, hyväksymisaste sekä kulut lajeittain ja projekteittain
- **Projektit:** budjetin ylitykset, myöhässä olevat projektit, odottavat tunnit, avoimet työmääräykset sekä budjetti–toteuma-vertailu
- **Kalusto:** myöhässä ja pian erääntyvät huollot, vastuuhenkilöttömät kalustot, huollossa oleva kalusto sekä tila- ja projektijakaumat

Automaattinen huomio on päätöksenteon tuki, ei alkuperäisen kirjauksen korvaava päätös. Käyttöliittymä muistuttaa tarkistamaan lähderivin.

### Viennit

CSV-, Excel-, PDF- ja tulostusnäkymään lisättiin:

- organisaatio ja käytetyt rajaukset
- muodostusajankohta
- raporttikohtainen yhteenveto
- tarkistettavat asiat ja niiden selitteet
- varsinainen yksityiskohtainen aineisto

CSV ja Excel sisältävät kaikki rivit. PDF rajataan enintään 500 aineistoriviin, jotta tiedosto säilyy käyttökelpoisena; mahdollinen rajaus ilmoitetaan raportissa.

## Rajaukset ja jatkokehitys

Toteutus ei muuta palvelinraporttien käyttöoikeuksia, RLS-sääntöjä eikä alkuperäistä raporttiaineistoa. Analyysi perustuu vain palvelimen palauttamiin riveihin.

Seuraava erillinen kehitysvaihe on tallennetut raporttipohjat, ajastettu jakelu ja raporttien muodostus-/vientitapahtumien keskitetty audit-loki. Näitä ei lisätty tähän muutokseen, koska ne vaativat uuden tietomallin, käyttöoikeuspäätökset ja jakelukanavien määrittelyn.
