export {};

declare global {
  type CustomerType = 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
  type CustomerStatus = 'Aktiivinen' | 'Epäaktiivinen';
  type CrmLeadStage = 'Uusi' | 'Tarjous tehty' | 'Neuvottelu' | 'Sopimus';
  type EmployeeStatus = 'Aktiivinen' | 'Lomalla' | 'Sairas' | 'Koulutuksessa' | 'Eroonnut';
  type EquipmentStatus = 'Vapaa' | 'Käytössä' | 'Huollossa' | 'Vuokralla';
}
