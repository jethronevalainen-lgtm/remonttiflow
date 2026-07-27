# Tarkastukset ja itselleluovutukset

VaKantin työnjohdon tarkastusmoduuli kattaa:

- huoneisto-, yleisremontti-, keittiö- ja kylpyhuoneitselleluovutukset
- projekti-, rakennus-, rappu- ja huoneistorekisterin
- versioidut organisaatiokohtaiset tarkastuspohjat
- mobiili- ja työpöytäkäytön
- puutteiden vastuuttamisen, korjauskuittauksen ja uusintatarkastuksen
- korjaustehtävän muodostamisen työmääräykseksi
- valokuvat ja PDF-liitteet suojatussa Supabase Storage -säilössä
- käsin tehtävän allekirjoituksen
- hyväksyntämerkinnät, muuttumattoman raporttisnapshotin ja audit trailin
- hyväksytyn raportin tulostamisen tai tallentamisen PDF-muotoon selaimen tulostustoiminnolla

## Alkutiedot

Itselleluovutuksen raportilla näytetään projektin ja huoneiston rekisteritiedoista:

- kiinteistö ja sijainti
- huoneisto
- työnumero
- tarkastuksen päivämäärä
- työmaan aloitus ja luovutus
- asukkaalle suunniteltu luovutus
- tarkastuksen suorittaja

Tietoja ei kopioida erillisiin vapaisiin tekstikenttiin, vaan ne perustuvat projektin ja huoneiston hallittuihin perustietoihin.

## Roolit

- **Admin:** kaikki työnjohdon oikeudet, omien pohjien julkaisu ja hyväksytyn tarkastuksen perusteltu mitätöinti.
- **Työnjohtaja:** tarkastusten luonti, suoritus, puutteiden käsittely, uusintatarkastus, allekirjoitus ja hyväksyntä.
- **Työntekijä:** vain hänelle osoitetut korjauspuutteet, korjauskommentti ja korjauksen jälkeinen kuva.

## Hyväksyntäehdot

Tarkastusta ei voi hyväksyä, jos:

- pakollisia kohtia on käsittelemättä
- avoinna on vähintään yksi luovutuksen estävä puute
- tarkastuksesta puuttuu käsin tehty allekirjoitus
- tarkastuksesta puuttuu vähintään yksi luovutus- tai yleiskuva

Hyväksyntä lukitsee tarkastuksen sisällön ja muodostaa versionoidun raporttisnapshotin. Snapshot sisältää tarkastustulokset, puutteet, allekirjoitukset ja liitteet.

## Tietoturva

Organisaatio- ja roolirajat pakotetaan PostgreSQL Row Level Security -politiikoilla. Tarkastusliitteet ovat yksityisessä `inspection-files`-säilössä. Selain käyttää vain lyhytikäisiä allekirjoitettuja latausosoitteita. Liitteen tietokantarivi voidaan rekisteröidä vain saman käyttäjän juuri lataamalle objektille ja objektipolku sidotaan organisaatiokansioon.
