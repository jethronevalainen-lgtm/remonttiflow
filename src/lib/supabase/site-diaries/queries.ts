import { supabase } from '../client';
import {
  assertNoError,
  mapAttachment,
  mapCompletion,
  mapDiary,
  mapEvent,
  mapSignature,
  mapWeather,
  mapWorkforce,
  mapWorkItem,
} from './mappers';
import type { SiteDiary, SiteDiaryBundle, SiteDiaryListFilters } from './types';

export async function listSiteDiaries(
  organizationId: string,
  filters: SiteDiaryListFilters = {},
): Promise<SiteDiary[]> {
  let query = supabase
    .from('diary_entries')
    .select('*')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false })
    .order('version', { ascending: false });

  if (!filters.includeHistory) query = query.eq('is_current', true);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);

  const { data, error } = await query;
  await assertNoError(error, 'Työmaapäiväkirjojen haku epäonnistui.');
  const diaries = (Array.isArray(data) ? data : []).map(mapDiary);
  const search = filters.search?.trim().toLocaleLowerCase('fi');
  return search
    ? diaries.filter((diary) => [diary.project, diary.siteAddress ?? '', diary.author, diary.summary ?? '']
      .some((value) => value.toLocaleLowerCase('fi').includes(search)))
    : diaries;
}

export async function createOrGetSiteDiary(input: {
  organizationId: string;
  projectId: string;
  date: string;
}): Promise<SiteDiary> {
  const { data, error } = await supabase.rpc('create_or_get_site_diary', {
    p_organization_id: input.organizationId,
    p_project_id: input.projectId,
    p_date: input.date,
  });
  await assertNoError(error, 'Päiväkirjan avaaminen epäonnistui.');
  return mapDiary(data);
}

export async function loadSiteDiaryBundle(
  organizationId: string,
  diaryId: string,
): Promise<SiteDiaryBundle> {
  const diaryQuery = supabase
    .from('diary_entries')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', diaryId)
    .single();

  const [
    diaryResult,
    completionResult,
    weatherResult,
    workforceResult,
    workItemsResult,
    eventsResult,
    attachmentsResult,
    signaturesResult,
  ] = await Promise.all([
    diaryQuery,
    supabase.rpc('get_site_diary_completion', { p_diary_id: diaryId }),
    supabase.from('site_diary_weather_observations').select('*').eq('diary_id', diaryId).order('observation_time'),
    supabase.from('site_diary_workforce_rows').select('*').eq('diary_id', diaryId).order('sort_order').order('created_at'),
    supabase.from('site_diary_work_items').select('*').eq('diary_id', diaryId).order('phase_state').order('sort_order').order('created_at'),
    supabase.from('site_diary_events').select('*').eq('diary_id', diaryId).order('occurred_at').order('sort_order'),
    supabase.from('site_diary_attachments').select('*').eq('diary_id', diaryId).order('sort_order').order('created_at'),
    supabase.from('site_diary_signatures').select('*').eq('diary_id', diaryId).order('signed_at'),
  ]);

  const firstError = [
    diaryResult.error,
    completionResult.error,
    weatherResult.error,
    workforceResult.error,
    workItemsResult.error,
    eventsResult.error,
    attachmentsResult.error,
    signaturesResult.error,
  ].find(Boolean);
  await assertNoError(firstError ?? null, 'Työmaapäiväkirjan tietojen haku epäonnistui.');

  return {
    diary: mapDiary(diaryResult.data),
    completion: mapCompletion(completionResult.data),
    weather: (weatherResult.data ?? []).map(mapWeather),
    workforce: (workforceResult.data ?? []).map(mapWorkforce),
    workItems: (workItemsResult.data ?? []).map(mapWorkItem),
    events: (eventsResult.data ?? []).map(mapEvent),
    attachments: (attachmentsResult.data ?? []).map(mapAttachment),
    signatures: (signaturesResult.data ?? []).map(mapSignature),
  };
}
