begin;

-- Varmuuskopio tallentaa lähdeämpärien tiedostot sellaisina kuin Storage ne
-- palauttaa. Supabase säilyttää ladatun Blob-olion alkuperäisen MIME-tyypin,
-- vaikka upload-kutsussa pyydetään application/octet-stream. Siksi yksittäinen
-- image/jpeg-tiedosto pysäytti koko ajon, kun app-backups hyväksyi vain JSON- ja
-- octet-stream-tyypit.
--
-- app-backups on yksityinen palvelinvarmuuskopioämpäri. Sen pitää hyväksyä kaikki
-- nykyiset ja tulevat lähdeämpärien MIME-tyypit, jotta uusi sallittu tiedostomuoto
-- ei riko koko varmuuskopiointia.
do $$
begin
  update storage.buckets
  set allowed_mime_types = null
  where id = 'app-backups';

  if not found then
    raise exception 'app-backups storage bucket does not exist';
  end if;
end;
$$;

commit;
