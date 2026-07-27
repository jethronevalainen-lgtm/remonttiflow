# Työmääräysten massapoisto

Työnjohtaja ja pääkäyttäjä voivat avata Työmääräysten ohjaus -näkymästä massapoiston, hakea ja suodattaa työmääräyksiä, valita useita rivejä sekä poistaa valinnan yhdellä vahvistuksella.

## Suojaukset

- Toiminto näkyy vain `supervisor`- ja `admin`-rooleille.
- Poisto käsittelee 1–200 työmääräystä atomisesti.
- Käynnissä olevia tai aktiivisen työaikaistunnon sisältäviä työmääräyksiä ei voi valita käyttöliittymässä.
- Tietokanta tarkistaa aktiiviset `work_order_time_sessions`- ja `work_order_sessions`-istunnot uudelleen ennen poistoa.
- Jos yksikin valittu työ ei ole poistettavissa, mitään valituista töistä ei poisteta.
- Jokaisesta poistetusta työmääräyksestä syntyy audit-loki.
- Kalenterivaraukset ja vastuuhenkilölinkit poistuvat viite-ehtojen mukaisesti. Historialliset tuntikirjaukset säilyvät, mutta niiden työmääräyslinkki tyhjenee.
