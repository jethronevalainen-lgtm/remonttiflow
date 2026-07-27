do $$
declare
  template_uuid uuid;
  version_uuid uuid;
  section_uuid uuid;
  next_version integer;
  section_value jsonb;
  item_value jsonb;
  section_order integer := 0;
  item_order integer;
  change_marker constant text := 'Ohjattu vaiheistus ja tarkennettu keittiön itselleluovutus';
  sections_payload jsonb := $payload$
  [
    {
      "title": "Kalusteiden asennus ja linjaus",
      "description": "Aloita kalusterungoista ja etene näkyviin osiin. Tarkista kokonaisuus sekä silmämääräisesti että kokeilemalla liikkuvat osat.",
      "items": [
        {"title":"Kalusterungot ovat suorassa, samassa linjassa ja tukevasti kiinnitetty","guidance":"Tarkista ylä- ja alakaappien linjat, kiinnitykset sekä seinärakenteeseen sopivat kiinnikkeet."},
        {"title":"Ovet ja etusarjat ovat ehjät ja keskenään samassa linjassa","guidance":"Katso kokonaisuus edestä ja sivusta. Pintojen, reunojen ja kulmien pitää olla ehjiä."},
        {"title":"Ovien käyntivälit ja saranasäädöt ovat kunnossa","guidance":"Avaa ja sulje jokainen ovi. Ovien ei pidä hangata, osua toisiinsa tai jäädä vinoon."},
        {"title":"Laatikot, korit, mekanismit ja hidastimet toimivat","guidance":"Vedä jokainen laatikko ja kori kokonaan auki ja sulje se. Tarkista myös ulosvedettävät mekanismit."},
        {"title":"Vetimet ovat suorassa ja tukevasti kiinnitetty","guidance":"Tarkista vetimien linja sekä kiinnitys käsin kokeilemalla."},
        {"title":"Sokkelit, päätylevyt, peitelevyt ja täytteet ovat siistit","guidance":"Liittymien, leikkausten ja kiinnitysten pitää olla viimeisteltyjä ilman näkyviä rakoja tai vaurioita."},
        {"title":"Kaappien sisäpinnat, hyllyt ja laatikot ovat puhtaat ja ehjät","guidance":"Poista asennusjätteet, pöly, merkinnät ja suojamateriaalit."}
      ]
    },
    {
      "title": "Työtasot, välitila ja liittymät",
      "description": "Tarkista tasot ja välitila yhtenä kokonaisuutena. Kiinnitä erityinen huomio aukotuksiin, liitoksiin ja kosteudelle alttiisiin kohtiin.",
      "items": [
        {"title":"Työtaso on ehjä, suorassa ja tukevasti kiinnitetty","guidance":"Tarkista pinta, etureuna, kannatus ja mahdollinen taipuma koko tasopituudelta."},
        {"title":"Työtason liitokset ovat tasaiset, tiiviit ja siistit","guidance":"Liitoksissa ei saa olla porrastusta, avointa saumaa tai liimajäämiä."},
        {"title":"Reunat, päädyt ja aukotukset ovat viimeistelty","guidance":"Tarkista sahausjäljet, reunalistat sekä altaan ja kodinkoneiden aukotukset."},
        {"title":"Allasaukko, liesiaukko ja muut läpiviennit ovat tiivistetty","guidance":"Tarkista kosteudelle alttiit leikkauspinnat ja läpivientien tiivistys."},
        {"title":"Työtason seinäliittymät ja silikonisaumat ovat yhtenäiset","guidance":"Sauman pitää olla tiivis, siisti ja katkeamaton koko liittymän matkalla."},
        {"title":"Välitilan materiaali, saumat ja rajaukset ovat ehjät ja siistit","guidance":"Tarkista levyt, laatat, saumat sekä rajaukset kalusteisiin, pistorasioihin ja nurkkiin."}
      ]
    },
    {
      "title": "Vesi, viemäri ja vuotosuojaus",
      "description": "Tee toimintakoe vedellä. Tarkista liitokset kuivin käsin ja valolla sekä ennen juoksutusta että sen jälkeen.",
      "items": [
        {"title":"Allas on ehjä ja tukevasti kiinnitetty","guidance":"Tarkista altaan kiinnitys, reunat ja liittymä työtasoon."},
        {"title":"Hana on tukevasti kiinnitetty ja toimii kaikilla käyttöasennoilla","guidance":"Kokeile kylmä ja lämmin vesi, vivun liike sekä mahdollinen ulosvedettävä juoksuputki."},
        {"title":"Veden juoksutus ja viemäröinti on toimintakokeiltu","guidance":"Juoksuta vettä riittävästi ja varmista, että allas tyhjenee normaalisti ilman pulputusta tai hajuhaittaa."},
        {"title":"Vesi- ja viemäriliitoksissa ei ole vuotoja","guidance":"Tarkista sulut, liitosmutterit, letkut, hajulukko ja poistoputki heti toimintakokeen jälkeen."},
        {"title":"Hajulukko on oikein asennettu, tuettu ja puhdistettavissa","guidance":"Varmista, ettei putkisto jää jännitykseen ja että huoltaminen on mahdollista ilman rakenteiden purkua."},
        {"title":"Vuotokaukalot ja sovittu vuotosuojaus ovat paikoillaan","guidance":"Tarkista allaskaappi, astianpesukone sekä muut vesiliitäntäiset laitteet sovitun laajuuden mukaisesti."},
        {"title":"Läpiviennit, vedenohjaus ja allaskaapin suojaus ovat kunnossa","guidance":"Mahdollisen vuodon pitää ohjautua näkyville eikä rakenteisiin."}
      ]
    },
    {
      "title": "Kodinkoneet ja toimintakokeet",
      "description": "Tarkista jokainen toimitukseen kuuluva laite erikseen. Pelkkä paikalleen asennus ei riitä, vaan perustoiminto pitää kokeilla.",
      "items": [
        {"title":"Kodinkoneet ovat oikeilla paikoillaan, suorassa ja siististi asennettu","guidance":"Tarkista korkeus, linja kalusteoviin ja tasoihin sekä näkyvät kolhut tai naarmut."},
        {"title":"Laitteiden ovet, luukut ja vetolaatikot avautuvat esteettä","guidance":"Avaa jokainen laite kokonaan ja varmista, ettei se osu kalusteisiin, vetimiin tai seinään."},
        {"title":"Kalusteisiin kuuluvat laitekiinnitykset ja kallistumisen estot ovat tehty","guidance":"Tarkista erityisesti integroidut laitteet ja valmistajan edellyttämät kiinnitykset."},
        {"title":"Näkyvät sähkö-, vesi-, viemäri- ja ilmanvaihtoliitännät ovat asianmukaiset","guidance":"Johdot ja letkut eivät saa olla puristuksissa, taittuneina tai hankautua teräviin reunoihin."},
        {"title":"Jokaisen laitteen perustoiminto on kokeiltu","guidance":"Käynnistä laite soveltuvalla lyhyellä testillä ja varmista, ettei näkyviä virheitä tai poikkeavia ääniä ilmene."},
        {"title":"Suojamuovit, kuljetustuet ja pakkausmateriaalit on poistettu","guidance":"Tarkista myös laitteiden sisäosat ja vaikeasti näkyvät reunat."},
        {"title":"Käyttöohjeet, tuotetiedot ja sovitut dokumentit ovat tallessa","guidance":"Varmista, että luovutettavat ohjeet ja mahdolliset takuutiedot voidaan yksilöidä kohteeseen."}
      ]
    },
    {
      "title": "Sähkö, valaistus ja ilmanvaihto",
      "description": "Tarkista näkyvät asennukset ja käyttötoiminnot. Varsinaiset sähkömittaukset kuuluvat pätevälle sähköurakoitsijalle.",
      "items": [
        {"title":"Pistorasiat, kytkimet, peitelevyt ja suojakannet ovat ehjät ja paikoillaan","guidance":"Tarkista linjaus, kiinnitys ja näkyvät vauriot."},
        {"title":"Kalustevalot ja muut toimitukseen kuuluvat valaisimet toimivat","guidance":"Kokeile kaikki kytkennät, himmennykset ja ovikytkimet, jos niitä on."},
        {"title":"Näkyvät johdotukset, muuntajat ja läpiviennit ovat siistit ja suojatut","guidance":"Johdot eivät saa roikkua, puristua tai jäädä kuumien pintojen läheisyyteen."},
        {"title":"Liesituuletin tai -kupu toimii sovitun toteutuksen mukaisesti","guidance":"Kokeile puhallus, valot ja säätimet. Tarkista myös näkyvät kanava- ja suodatinosat."},
        {"title":"Ilmanvaihtoventtiilit ja korvausilmareitit ovat puhtaat ja esteettömät","guidance":"Varmista, ettei kaluste tai asennus peitä suunniteltua ilmankulkua."},
        {"title":"Työn edellyttämät sähkö- ja käyttöönottodokumentit on vastaanotettu","guidance":"Merkitse ei koske kohdetta, jos työ ei ole sisältänyt dokumentointia edellyttäviä sähkömuutoksia."}
      ]
    },
    {
      "title": "Viimeistely ja luovutusvalmius",
      "description": "Tee lopuksi rauhallinen kokonaiskierros ovelta alkaen. Tarkista näkyvät pinnat, puhtaus ja se, että tila on aidosti käyttövalmis.",
      "items": [
        {"title":"Seinä-, katto- ja lattiapinnat ovat ehjät ja viimeistellyt","guidance":"Tarkista paikkaukset, maalaukset, rajaukset ja asennustöiden mahdollisesti aiheuttamat vauriot."},
        {"title":"Listat, silikonit, saumat ja muut liittymät ovat siistit","guidance":"Kierrä kalusteiden, seinien, lattian ja tasojen liittymät järjestelmällisesti."},
        {"title":"Suojaukset, työkalut, jätteet ja ylimääräiset materiaalit on poistettu","guidance":"Tilan pitää olla turvallinen ja välittömästi käytettävissä."},
        {"title":"Kaikki näkyvät pinnat, kaapit, laatikot ja laitteet ovat puhtaat","guidance":"Tarkista erityisesti pöly, liimajäämät, sormenjäljet ja pakkausmateriaalit."},
        {"title":"Havaitut puutteet ja poikkeamat on kirjattu vastuineen","guidance":"Älä merkitse kohtaa kunnossa, jos korjausta vaativa havainto on vielä kirjaamatta."},
        {"title":"Keittiö on turvallinen, käyttövalmis ja vastaa sovittua työn laajuutta","guidance":"Varmista kokonaisuus ennen siirtymistä puutteiden käsittelyyn ja luovutuskuviin."}
      ]
    }
  ]
  $payload$::jsonb;
begin
  select id into template_uuid
  from public.inspection_templates
  where name = 'Keittiöremontin itselleluovutus'
    and active = true
  order by is_system desc, created_at
  limit 1;

  if template_uuid is null then
    raise exception 'Keittiöremontin itselleluovutuksen tarkastuspohjaa ei löytynyt.';
  end if;

  if exists (
    select 1 from public.inspection_template_versions
    where template_id = template_uuid and change_note = change_marker
  ) then
    return;
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.inspection_template_versions
  where template_id = template_uuid;

  insert into public.inspection_template_versions (
    template_id, version, status, change_note, published_at, published_by
  ) values (
    template_uuid, next_version, 'Julkaistu', change_marker, now(), null
  ) returning id into version_uuid;

  for section_value in select value from jsonb_array_elements(sections_payload)
  loop
    section_order := section_order + 1;
    insert into public.inspection_template_sections (version_id, title, description, sort_order)
    values (
      version_uuid,
      section_value ->> 'title',
      section_value ->> 'description',
      section_order
    ) returning id into section_uuid;

    item_order := 0;
    for item_value in select value from jsonb_array_elements(section_value -> 'items')
    loop
      item_order := item_order + 1;
      insert into public.inspection_template_items (
        section_id, title, guidance, response_type, required,
        photo_required_on_defect, measurement_unit, sort_order
      ) values (
        section_uuid,
        item_value ->> 'title',
        item_value ->> 'guidance',
        'condition',
        true,
        true,
        null,
        item_order
      );
    end loop;
  end loop;

  update public.inspection_templates
  set description = 'Vaiheittainen keittiöremontin itselleluovutus: kalusteet, tasot, vesi, kodinkoneet, sähkö, viimeistely, puutteet ja luovutusdokumentointi.',
      updated_at = now()
  where id = template_uuid;
end;
$$;
