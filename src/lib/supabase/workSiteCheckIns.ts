import { supabase } from './client';

export interface CapturedWorkSiteLocation {
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: string;
}

export interface WorkSiteCheckIn {
  id: string;
  organizationId: string;
  userId: string;
  projectId?: string;
  projectName: string;
  employeeName: string;
  description?: string;
  checkedInAt: string;
  locationCapturedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  checkedOutAt?: string;
  timeEntryId?: string;
}

type WorkSiteCheckInRow = {
  id: string;
  organization_id: string;
  user_id: string;
  project_id: string | null;
  project_name: string;
  employee_name: string;
  description: string | null;
  checked_in_at: string;
  location_captured_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  checked_out_at: string | null;
  time_entry_id: string | null;
};

function mapWorkSiteCheckIn(row: WorkSiteCheckInRow): WorkSiteCheckIn {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name,
    employeeName: row.employee_name,
    description: row.description ?? undefined,
    checkedInAt: row.checked_in_at,
    locationCapturedAt: row.location_captured_at,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyM: Number(row.accuracy_m),
    checkedOutAt: row.checked_out_at ?? undefined,
    timeEntryId: row.time_entry_id ?? undefined,
  };
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Sijaintilupa evättiin. Salli sijainti selaimen asetuksista, jotta voit kirjautua työmaalle.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Sijaintia ei saatu määritettyä. Tarkista laitteen sijaintipalvelu ja yritä uudelleen.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Sijainnin määritys aikakatkaistiin. Siirry avoimempaan paikkaan ja yritä uudelleen.';
  }
  return 'Sijainnin määritys epäonnistui.';
}

export function captureCurrentWorkSiteLocation(): Promise<CapturedWorkSiteLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Tämä selain tai laite ei tue sijainnin määritystä.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(latitude)
          || !Number.isFinite(longitude)
          || !Number.isFinite(accuracy)
          || latitude < -90
          || latitude > 90
          || longitude < -180
          || longitude > 180
          || accuracy < 0
        ) {
          reject(new Error('Laite palautti virheellisen sijaintitiedon.'));
          return;
        }

        resolve({
          latitude,
          longitude,
          accuracyM: accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      (error) => reject(new Error(geolocationErrorMessage(error))),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    );
  });
}

export async function createWorkSiteCheckIn(input: {
  organizationId: string;
  userId: string;
  projectId?: string;
  projectName: string;
  employeeName: string;
  description?: string;
  location: CapturedWorkSiteLocation;
}): Promise<WorkSiteCheckIn> {
  const { data, error } = await supabase
    .from('work_site_check_ins')
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      project_id: input.projectId ?? null,
      project_name: input.projectName,
      employee_name: input.employeeName,
      description: input.description?.trim() || null,
      location_captured_at: input.location.capturedAt,
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      accuracy_m: input.location.accuracyM,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Työmaalle kirjautuminen epäonnistui: ${error.message}`);
  }

  return mapWorkSiteCheckIn(data as WorkSiteCheckInRow);
}

export async function completeWorkSiteCheckIn(checkInId: string): Promise<string> {
  const { data, error } = await supabase.rpc('complete_work_site_check_in', {
    p_check_in_id: checkInId,
  });

  if (error) {
    throw new Error(`Työmaalta uloskirjautuminen epäonnistui: ${error.message}`);
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Työmaalta uloskirjautuminen ei palauttanut tuntikirjausta.');
  }

  return data;
}

export async function listWorkSiteCheckIns(organizationId: string): Promise<WorkSiteCheckIn[]> {
  const { data, error } = await supabase
    .from('work_site_check_ins')
    .select('*')
    .eq('organization_id', organizationId)
    .order('checked_in_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Työmaalle kirjautumisten haku epäonnistui: ${error.message}`);
  }

  return (data ?? []).map((row) => mapWorkSiteCheckIn(row as WorkSiteCheckInRow));
}

export function workSiteMapUrl(checkIn: Pick<WorkSiteCheckIn, 'latitude' | 'longitude'>): string {
  const latitude = checkIn.latitude.toFixed(6);
  const longitude = checkIn.longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
}
