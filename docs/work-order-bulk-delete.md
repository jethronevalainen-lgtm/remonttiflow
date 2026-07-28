# Työmääräysten massapoisto

Työnjohtaja ja pääkäyttäjä valitsevat poistettavat työmääräykset suoraan Työmääräykset-taulukon valintaruuduilla. Valinnan jälkeen avautuvan massatoimintopalkin **Poista valitut** -toiminto käyttää samaa valintaa kuin muut massamuutokset. Erillistä kelluvaa massapoistopainiketta tai toista valintanäkymää ei ole.

## Käyttöliittymä

- Rivejä voi valita yksittäin tai valita kaikki nykyisen sivun rivit.
- Osittainen sivuvalinta näkyy valintaruudun epämääräisenä tilana.
- Vahvistusikkuna näyttää poistettavan määrän, ensimmäiset valitut työt sekä mahdolliset poiston estot.
- Käynnissä oleva tai aktiivista työaikaa sisältävä työ estää koko valitun erän poistamisen.
- Yhdellä kertaa voi poistaa enintään 200 työmääräystä.
- Onnistuneen poiston jälkeen valinta tyhjennetään ja työmääräysnäkymä päivitetään.

## Suojaukset

- Toiminto näkyy vain `supervisor`- ja `admin`-rooleille eikä roolin esikatselutilassa.
- Tietokannan `delete_work_orders_bulk`-toiminto poistaa 1–200 työmääräystä atomisesti.
- Tietokanta tarkistaa organisaation, käyttäjäroolin, tunnisteet ja aktiiviset `work_order_time_sessions`-istunnot uudelleen ennen poistoa.
- Jos yksikin valittu työ ei ole poistettavissa, mitään valituista töistä ei poisteta.
- Jokaisesta poistetusta työmääräyksestä syntyy audit-loki.
- Kalenterivaraukset ja vastuuhenkilölinkit poistuvat viite-ehtojen mukaisesti. Historialliset tuntikirjaukset säilyvät, mutta niiden työmääräyslinkki tyhjenee.
