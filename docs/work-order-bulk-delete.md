# Työmääräysten massapoisto

Työnjohtaja ja pääkäyttäjä voivat valita useita työmääräyksiä Työmääräysten ohjaus -näkymässä ja poistaa ne yhdellä vahvistuksella.

## Suojaukset

- Vain `supervisor`- ja `admin`-roolit voivat poistaa.
- Poisto käsittelee 1–200 työmääräystä atomisesti.
- Käynnissä olevia työmääräyksiä ei voi valita käyttöliittymässä.
- Tietokanta estää poiston myös silloin, jos valitulla työllä on aktiivinen `work_order_time_sessions`- tai `work_order_sessions`-istunto.
- Jokaisesta poistetusta työmääräyksestä syntyy audit-loki.
- Kalenterivaraukset ja vastuuhenkilölinkit poistuvat viite-ehtojen mukaisesti. Historialliset tuntikirjaukset säilyvät, mutta niiden työmääräyslinkki muuttuu tyhjäksi.
