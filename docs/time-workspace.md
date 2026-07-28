# Työaikatyötila

VaKantin työaikatyötila korvaa päällekkäiset tuntimäärä-, kellonaika- ja työmaaleimausnäkymät yhdellä roolikohtaisella kokonaisuudella.

## Kanoninen kirjausketju

1. Työntekijä aloittaa hänelle määrätyn työmääräyksen.
2. Palvelin avaa yhden aktiivisen `work_order_time_sessions`-istunnon.
3. Mahdollinen selaimen sijaintinäyte tallennetaan vain aloitushetkellä `work_site_check_ins`-tietueeseen.
4. Uuden työn aloittaminen päättää käyttäjän edellisen aktiivisen istunnon automaattisesti.
5. Työn päättäminen muodostaa kellonaikapohjaisen `time_entries`-rivin palvelimella.
6. Tauko, maksettava aika ja työaikalisät lasketaan organisaation sääntöjen mukaan.
7. Työnjohto hyväksyy päivän kokonaisuutena tai lähettää perustellun korjauspyynnön.
8. Palkkakauden lukituksen jälkeen alkuperäistä kirjausta ei muuteta tavallisesta työaikanäkymästä.

Manuaalinen kirjaus on poikkeuspolku puuttuvan työajan lisäämiseen. Se käyttää aina alku- ja loppuaikaa eikä pyydä työntekijää laskemaan desimaalitunteja.

## Roolit

### Työntekijä

- näkee oman aktiivisen työn ja oman työaikahistorian
- aloittaa vain käyttöoikeuksiinsa kuuluvan työmääräyksen
- vaihtaa työtä aloittamalla uuden määrätyn työn
- päättää työpäivän yhdellä toiminnolla
- lisää puuttuvan työajan kellonaikoina
- lähettää oman kirjauksen korjauspyynnön
- ei näe organisaation työmaaleimaus- tai sijaintihistoriaa

### Työnjohtaja

Työnjohtajalla on lähes sama operatiivinen näkymä kuin järjestelmänvalvojalla:

- kaikki organisaation työajat
- päiväkohtainen hyväksyntä
- korjauspyynnöt ja niiden ratkaiseminen
- työaikapoikkeamat
- aktiiviset työntekijät ja tarvittaessa aloitussijainnin karttalinkki
- työajan lisääminen toiselle työntekijälle
- palkkakaudet, lukitukset ja palkka-aineistoon siirtyminen

Työnjohtaja ei muuta koko organisaation työaikasääntöjä.

### Järjestelmänvalvoja

Järjestelmänvalvojalla on kaikki työnjohtajan operatiiviset työkalut sekä organisaation työaikasääntöjen hallinta.

### Projektikoordinaattori

- näkee vain käyttöoikeuksiinsa kuuluvien projektien työajat
- näkee projektien tuntikertymät, työmääräykset ja aktiivisen työn
- ei hyväksy, hylkää, muokkaa tai poista työaikaa
- ei näe tarpeetonta organisaation henkilöstö- tai sijaintihistoriaa

### Tilaaja

Tilaajalla ei ole pääsyä sisäiseen työaikatyötilaan.

## Käyttöoikeudet

Työaikatoiminnot on erotettu seuraaviin käyttöoikeuksiin:

- `time_entries.read.own`
- `time_entries.read.projects`
- `time_entries.read.all`
- `time_entries.create.own`
- `time_entries.create.others`
- `time_entries.request_correction`
- `time_entries.resolve_corrections`
- `time_entries.approve.all`
- `time_entries.manage.rules`
- `time_entries.lock.period`
- `time_entries.export.payroll`
- `work_sessions.read.own`
- `work_sessions.read.projects`
- `work_sessions.read.all`

Palvelin tarkistaa organisaatiojäsenyyden, roolin, projektipääsyn, työmääräyksen käyttöoikeuden ja palkkakauden lukituksen riippumatta käyttöliittymästä.

## Poikkeamat

Työnjohdon näkymä nostaa esiin vähintään:

- yli 12 tuntia avoinna olleen työvuoron
- yli 12 tunnin työaikakirjauksen
- useita päiviä hyväksyntää odottaneen kirjauksen
- työmaa-alueen ulkopuolella tehdyn aloitusleimauksen

Poikkeama ei muuta työaikaa automaattisesti. Se ohjaa työnjohdon tarkastamaan päivän ennen hyväksyntää.
