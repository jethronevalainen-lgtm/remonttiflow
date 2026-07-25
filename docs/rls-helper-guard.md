# RLS-apufunktioiden oikeussuojaus

VaKantin migraatiot tarkistetaan osana `npm run ship:check` -laatuporttia. Tarkistus estää migraation, joka poistaisi `authenticated`-roolilta RLS-politiikkojen tarvitsemien `private`-skeeman apufunktioiden suoritusoikeuden ilman korvaavaa grant-komentoa.

Tuotantotietokannan oikeudet voidaan tarkistaa tiedostolla `supabase/verify_rls_helper_grants.sql`. Käyttäjälle ei näytetä tietokannan raakavirheitä; tekninen virhe tallennetaan sovelluksen lokiin.