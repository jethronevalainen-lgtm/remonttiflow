export {};

declare global {
  type CustomerType = 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
  type CustomerStatus = 'Aktiivinen' | 'Epäaktiivinen';
  type CrmLeadStage =
    | 'Uusi'
    | 'Kartoitus sovittu'
    | 'Kartoitettu'
    | 'Tarjous laskennassa'
    | 'Tarjous lähetetty'
    | 'Neuvottelu'
    | 'Voitettu'
    | 'Hävitty'
    | 'Jäissä';
  type EmployeeStatus = 'Aktiivinen' | 'Lomalla' | 'Sairas' | 'Koulutuksessa' | 'Eroonnut';
  type EquipmentStatus = 'Vapaa' | 'Käytössä' | 'Huollossa' | 'Vuokralla';
}
