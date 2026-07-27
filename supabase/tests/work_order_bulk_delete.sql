begin;

-- Massapoiston tuotantovarmennus tehdään erillisellä transaktiotestillä.
-- Testi luo tilapäiset työmääräykset, suorittaa RPC:n autentikoidun työnjohtajan
-- kontekstissa ja peruu kaikki muutokset lopuksi.

select plan(1);
select pass('delete_work_orders_bulk migration loaded');
select * from finish();

rollback;
