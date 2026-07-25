# Tarkastukset ja itselleluovutukset

VaKantin työnjohdon tarkastusmoduuli kattaa:

- huoneisto-, yleisremontti-, keittiö- ja kylpyhuoneitselleluovutukset
- projekti-, rakennus-, rappu- ja huoneistorekisterin
- versioidut organisaatiokohtaiset tarkastuspohjat
- mobiili- ja työpöytäkäytön
- puutteiden vastuuttamisen, korjauskuittauksen ja uusintatarkastuksen
- korjaustehtävän muodostamisen työmääräykseksi
- valokuvat ja PDF-liitteet suojatussa Supabase Storage -säilössä
- hyväksyntämerkinnät, muuttumattoman raporttisnapshotin ja audit trailin
- hyväksytyn raportin tulostamisen tai tallentamisen PDF-muotoon selaimen tulostustoiminnolla

## Roolit

- **Admin:** kaikki työnjohdon oikeudet, omien pohjien julkaisu ja hyväksytyn tarkastuksen perusteltu mitätöinti.
- **Työnjohtaja:** tarkastusten luonti, suoritus, puutteiden käsittely, uusintatarkastus ja hyväksyntä.
- **Työntekijä:** vain hänelle osoitetut korjauspuutteet, korjauskommentti ja korjauksen jälkeinen kuva.

## Hyväksyntäehdot

Tarkastusta ei voi hyväksyä, jos pakollisia kohtia on käsittelemättä tai avoinna on vähintään yksi luovutuksen estävä puute. Hyväksyntä lukitsee tarkastuksen sisällön ja muodostaa versionoidun raporttisnapshotin.

## Tietoturva

Organisaatio- ja roolirajat pakotetaan PostgreSQL Row Level Security -politiikoilla. Tarkastusliitteet ovat yksityisessä `inspection-files`-säilössä. Selain käyttää vain lyhytikäisiä allekirjoitettuja latausosoitteita.
