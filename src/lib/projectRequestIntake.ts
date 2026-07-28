export const PROJECT_REQUEST_TYPES = [
  'Korjaus',
  'Remontti',
  'Huolto',
  'Tarkastus tai kartoitus',
  'Muu',
] as const;

export const DEADLINE_FLEXIBILITY_OPTIONS = ['Ehdoton', 'Joustava', 'Ei tiedossa'] as const;
export const OCCUPANCY_OPTIONS = ['Asuttu', 'Tyhjä', 'Tyhjenee ennen työn alkua', 'Ei tiedossa'] as const;
export const YES_NO_UNKNOWN_OPTIONS = ['Kyllä', 'Ei', 'Ei tiedossa'] as const;
export const CONTRACT_STATUS_OPTIONS = ['Ei sopimusta', 'Valmistelussa', 'Allekirjoitettu', 'Ei tiedossa'] as const;
export const ACCESS_METHOD_OPTIONS = [
  'Avain työnjohdolta',
  'Avain asukkaalta',
  'Asukas avaa',
  'Avainhallinta',
  'Sovittava',
] as const;

export type ProjectRequestType = (typeof PROJECT_REQUEST_TYPES)[number];
export type DeadlineFlexibility = (typeof DEADLINE_FLEXIBILITY_OPTIONS)[number];
export type OccupancyStatus = (typeof OCCUPANCY_OPTIONS)[number];
export type YesNoUnknown = (typeof YES_NO_UNKNOWN_OPTIONS)[number];
export type ContractStatus = (typeof CONTRACT_STATUS_OPTIONS)[number];
export type AccessMethod = (typeof ACCESS_METHOD_OPTIONS)[number] | '';

export interface ProjectRequestFormValues {
  customerId: string;
  title: string;
  requestType: ProjectRequestType;
  location: string;
  building: string;
  staircase: string;
  apartment: string;
  customerReference: string;
  description: string;
  desiredStartDate: string;
  desiredEndDate: string;
  deadlineFlexibility: DeadlineFlexibility;
  occupancyStatus: OccupancyStatus;
  currentResidentMovingOut: boolean;
  currentResidentMoveOutDate: string;
  incomingResidentStatus: YesNoUnknown;
  incomingResidentMoveInDate: string;
  incomingContractStatus: ContractStatus;
  deadlineReason: string;
  accessMethod: AccessMethod;
  allowedWorkingHours: string;
  accessNotes: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  residentContactName: string;
  residentContactPhone: string;
  residentContactEmail: string;
  residentContactAllowed: boolean;
  contactInstructions: string;
}

export function emptyProjectRequestForm(customerId = '', contactName = ''): ProjectRequestFormValues {
  return {
    customerId,
    title: '',
    requestType: 'Korjaus',
    location: '',
    building: '',
    staircase: '',
    apartment: '',
    customerReference: '',
    description: '',
    desiredStartDate: '',
    desiredEndDate: '',
    deadlineFlexibility: 'Joustava',
    occupancyStatus: 'Ei tiedossa',
    currentResidentMovingOut: false,
    currentResidentMoveOutDate: '',
    incomingResidentStatus: 'Ei tiedossa',
    incomingResidentMoveInDate: '',
    incomingContractStatus: 'Ei tiedossa',
    deadlineReason: '',
    accessMethod: '',
    allowedWorkingHours: 'Arkisin 7.00–16.00',
    accessNotes: '',
    contactName,
    contactPhone: '',
    contactEmail: '',
    residentContactName: '',
    residentContactPhone: '',
    residentContactEmail: '',
    residentContactAllowed: false,
    contactInstructions: '',
  };
}

export function validateProjectRequestStep(values: ProjectRequestFormValues, step: number): string[] {
  const errors: string[] = [];
  if (step === 0 || step === 3) {
    if (!values.customerId) errors.push('Valitse tilaaja-asiakkuus.');
    if (values.title.trim().length < 3) errors.push('Anna työlle vähintään kolmen merkin otsikko.');
    if (!values.location.trim()) errors.push('Anna kohteen osoite tai sijainti.');
    if (values.description.trim().length < 20) errors.push('Kuvaile työ vähintään 20 merkillä.');
  }
  if (step === 1 || step === 3) {
    if (values.desiredStartDate && values.desiredEndDate && values.desiredEndDate < values.desiredStartDate) {
      errors.push('Valmistumispäivä ei voi olla ennen aloituspäivää.');
    }
    if (values.deadlineFlexibility === 'Ehdoton' && !values.desiredEndDate) {
      errors.push('Anna ehdoton valmistumispäivä.');
    }
    if (values.incomingResidentStatus === 'Kyllä' && !values.incomingResidentMoveInDate) {
      errors.push('Anna uuden asukkaan muuttopäivä.');
    }
    if (values.occupancyStatus === 'Asuttu' && !values.accessMethod) {
      errors.push('Valitse, miten asuttuun kohteeseen päästään.');
    }
  }
  if (step === 3) {
    if (values.residentContactAllowed && !values.residentContactName.trim()) {
      errors.push('Anna asukkaan tai kohteen yhteyshenkilö.');
    }
  }
  return errors;
}

export function projectRequestLocationLabel(values: Pick<ProjectRequestFormValues, 'location' | 'building' | 'staircase' | 'apartment'>): string {
  return [
    values.location.trim(),
    values.building.trim() ? `Rakennus ${values.building.trim()}` : '',
    values.staircase.trim() ? `Rappu ${values.staircase.trim()}` : '',
    values.apartment.trim() ? `Asunto ${values.apartment.trim()}` : '',
  ].filter(Boolean).join(' · ');
}

export function isSupportedProjectRequestFile(file: Pick<File, 'name' | 'type'>): boolean {
  const acceptedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);
  if (acceptedMimeTypes.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|pdf|txt|csv|docx?|xlsx?)$/i.test(file.name);
}
