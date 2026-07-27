# Vaihe A – Työmailla nyt ja työselosteiden live-tilannekuva

## Tavoite

Työnjohto näkee palvelimelta ajantasaisesti, kuka on kirjautunut mille työmaalle, mitä hän tekee, kuinka pitkään työaika on ollut käynnissä ja mitkä kirjaukset vaativat huomiota.

## Tietomalli

Aktiivisen session lähdejärjestelmä on PostgreSQL. Selaimen localStorage toimii vain käyttöliittymän palautumisen apuna.

### `work_time_sessions`

- `id uuid primary key`
- `organization_id uuid not null`
- `user_id uuid not null`
- `employee_id uuid null`
- `project_id uuid not null`
- `work_order_id uuid null`
- `check_in_id uuid null`
- `started_at timestamptz not null`
- `ended_at timestamptz null`
- `description text null`
- `start_latitude numeric null`
- `start_longitude numeric null`
- `start_accuracy_m numeric null`
- `start_distance_from_site_m numeric null`
- `end_latitude numeric null`
- `end_longitude numeric null`
- `end_accuracy_m numeric null`
- `end_distance_from_site_m numeric null`
- `source text not null`
- `status text not null`
- `closed_time_entry_id uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Pakotetaan osittaisella uniikki-indeksillä korkeintaan yksi aktiivinen sessio käyttäjälle ja organisaatiolle:

```sql
create unique index work_time_sessions_one_active_per_user
on public.work_time_sessions (organization_id, user_id)
where ended_at is null and status = 'active';
```

## Palvelinfunktiot

- `start_work_time_session(...)`
- `finish_work_time_session(...)`
- `list_active_work_time_sessions(organization_id)`
- `list_recent_work_descriptions(organization_id, limit)`
- `list_workforce_attention_items(organization_id)`

Kaikki funktiot tarkistavat organisaatiojäsenyyden ja roolin. Työntekijä voi lukea ja sulkea vain oman sessionsa. Työnjohtaja näkee oman HR-tiiminsä. Admin näkee organisaation kaikki tiedot.

## Poikkeamasäännöt

- aktiivinen sessio yli organisaation määrittämän enimmäiskeston
- edellisen paikallisen työpäivän aikana aloitettu avoin sessio
- puuttuva tai alle määritetyn merkkimäärän työseloste
- puuttuva työmääräys, kun projekti vaatii työmääräyksen
- sijaintitarkkuus heikompi kuin organisaation raja
- etäisyys työmaan keskipisteestä lähellä sallittua rajaa
- käyttäjällä ei ole aktiivista projektijäsenyyttä

## Käyttöliittymä

### Työnjohdon dashboard

- Työmailla nyt -mittari
- päivän hyväksytyt ja odottavat tunnit
- avoimet työaikapoikkeamat
- Työmailla nyt -lista
- Viimeisimmät työselosteet
- Vaatii huomiota -lista

### Työntekijä

- aktiivisen työajan pysyvä tilapalkki
- työmaan, aloitusajan ja keston näyttö
- Lopeta työpäivä -toiminto
- työselosteen täydentäminen ennen sulkemista

## Testit

- yksi aktiivinen sessio käyttäjää kohti
- rinnakkaiset aloitusyritykset eivät luo kaksoissessiota
- työntekijä ei näe muiden sessioita
- työnjohtajan HR-tiimirajaus
- adminin organisaatiorajaus
- uloskirjaus muodostaa yhden tuntikirjauksen
- toistettu uloskirjaus on idempotentti
- aikavyöhyke, yövuoro ja automaattinen tauko
- sijaintirajan ja tarkkuuden poikkeamat
- mobiilinäkymä Pixel 7 -koossa
