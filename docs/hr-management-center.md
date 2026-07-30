# VaKantti HR-keskus

HR-keskus kokoaa työntekijän työsuhteen, palkkatiedot, osaamisen, koulutukset, pätevyydet, tavoitteet, keskustelut, dokumentit, perehdytyksen, poistumisen, poissaolot ja vastuukaluston yhteen työntekijäkorttiin.

## Käyttöoikeudet

- **Admin** hallitsee koko organisaation HR-tietoja ja näkee `Vain HR` -dokumentit.
- **Työnjohtaja** hallitsee oman HR-tiiminsä tietoja ja näkee tiimille sallitut dokumentit.
- **Työntekijä** näkee omat RLS-politiikkojen sallimat tiedot ja työntekijälle jaetut dokumentit. Esihenkilön luottamukselliset HR-merkinnät ovat erillisessä manager-only-taulussa.
- HR-tapahtumahistoria on sovelluskäyttäjille vain luettavissa.

## Tietojen lähteet

Nykyiset palkkaehdot, pätevyydet, poissaolot, työnjohtajatiimit ja kalustovastuut säilyvät omissa kanonisissa tauluissaan. HR-keskus täydentää niitä uusilla rakenteisilla elinkaaritiedoilla eikä kopioi samoja arvoja rinnakkaisiin kenttiin.

Esihenkilön HR-merkinnät tallennetaan `employee_manager_notes`-tauluun. Työsuhteen muut kentät säilyvät työntekijän itsepalvelua varten erillisessä `employee_employment_profiles`-taulussa. Molemmat päivittyvät samalla tietokantafunktiolla, joten tallennus on atominen.

## Dokumentit

Dokumentit tallennetaan yksityiseen `employee-hr-documents`-säiliöön. Tiedostot avataan määräaikaisilla allekirjoitetuilla osoitteilla. Tuetut tiedostotyypit ovat PDF, Word ja yleiset kuvaformaatit, ja yksittäisen tiedoston enimmäiskoko on 15 Mt.

## Todennus

Tietosuoja on varmennettu eristetyllä, kokonaan perutulla tietokantatransaktiolla: admin pystyy tallentamaan työsuhdeprofiilin ja esihenkilömerkinnän, työntekijä näkee oman työsuhdeprofiilinsa mutta ei manager-only-merkintää eikä pysty käyttämään tallennusfunktiota. Auditointiloki kirjaa muutoksen tallentamatta merkinnän sisältöä.
