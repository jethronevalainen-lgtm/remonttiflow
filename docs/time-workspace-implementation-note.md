# Työaikauudistuksen migraatiohuomio

Migraatio `20260728110500_time_workspace_v3.sql` säilyttää olemassa olevat tuntikirjaukset, palkkakaudet, lukitukset ja automaattiset työmääräysistunnot.

Se lisää työaikatyötilan palvelinrajapinnat, työmääräysistunnon ja aloitussijainnin linkityksen sekä auditoidun korjauspyyntöketjun. Vanhoja tuntikirjauksia ei kopioida eikä poisteta.

Käyttöliittymä lakkaa käyttämästä erillistä työmaaleimausajastinta uutena työaikarivien lähteenä. Uusi aloitus- ja lopetuspolku käyttää työmääräysistuntoa kanonisena työajan lähteenä ja liittää mahdollisen sijaintinäytteen samaan istuntoon.
