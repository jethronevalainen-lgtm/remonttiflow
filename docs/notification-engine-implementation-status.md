# Ilmoitusmoottorin toteutustila

## Toteutettu tässä muutoksessa

- palvelinpuolinen `app_notifications`-tietomalli
- organisaation ilmoitusasetukset ja validoinnit
- viiden minuutin välein ajettava PostgreSQL/pg_cron-tarkistus
- työvuoron alkamismuistutus työntekijälle
- puuttuvan sisäänkirjautumisen muistutus työntekijälle
- puuttuvan sisäänkirjautumisen hälytys työnjohtajalle
- työmääräyksen määräaikamuistutus
- myöhässä olevan työmääräyksen ilmoitus
- hyväksytyn poissaolon huomiointi
- ilmoitusten deduplikointi ja automaattinen ratkaisu
- RLS-rajaus käyttäjän omiin ilmoituksiin
- reaaliaikainen kellovalikon päivitys
- asetuskortti organisaation hallintaan
- lukeminen ja kaikkien merkitseminen luetuiksi

## Ei sisälly ensimmäiseen vaiheeseen

- selaimen/PWA:n taustapush sovelluksen ollessa kokonaan suljettu
- sähköposti- tai tekstiviestikanava
- käyttäjäkohtaiset hiljaiset ajat
- pätevyys-, huolto- ja turvallisuuseskalointien lisäsäännöt

Tietomalli on rakennettu siten, että nämä voidaan lisätä myöhemmin ilman uuden ilmoituskeskuksen rakentamista.
