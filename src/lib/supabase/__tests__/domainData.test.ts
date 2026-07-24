import { describe, expect, it } from 'vitest';

import {
  mapCrmLead,
  mapCustomer,
  mapProject,
  mapTimeEntry,
} from '../domainData';

describe('Supabase domain row mappings', () => {
  it('maps nullable customer columns to safe UI values', () => {
    expect(
      mapCustomer({
        id: 'customer-1',
        name: 'Asunto Oy Testi',
        type: 'Taloyhtiö',
        contact_person: null,
        phone: null,
        email: null,
        address: null,
        project_count: null,
        last_contact: null,
        status: 'Aktiivinen',
      }),
    ).toEqual({
      id: 'customer-1',
      name: 'Asunto Oy Testi',
      type: 'Taloyhtiö',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      projectCount: 0,
      lastContact: '',
      status: 'Aktiivinen',
    });
  });

  it('converts an ISO database date to the time-entry display format', () => {
    const entry = mapTimeEntry({
      id: 'entry-1',
      date: '2026-07-24',
      employee: 'Matti Korhonen',
      project: 'Testiprojekti',
      hours: '7.5',
      overtime: null,
      description: null,
      status: 'Odottaa',
    });

    expect(entry.date).toBe('24.7.2026');
    expect(entry.hours).toBe(7.5);
    expect(entry.overtime).toBe(0);
    expect(entry.description).toBe('');
  });

  it('falls back to canonical statuses when database text is invalid', () => {
    const project = mapProject({
      id: 'project-1',
      name: 'Testi',
      customer: 'Asiakas',
      status: 'unknown',
      start_date: null,
      end_date: null,
      progress: null,
      budget: null,
      spent: null,
    });

    expect(project.status).toBe('Suunniteltu');
    expect(project.progress).toBe(0);
    expect(project.budget).toBe(0);
  });

  it('uses expected_date as the CRM business date', () => {
    const lead = mapCrmLead({
      id: 'lead-1',
      name: 'Linjasaneeraus',
      company: 'Testi Oy',
      value: 125000,
      stage: 'Tarjous tehty',
      assignee: 'Myyjä',
      expected_date: '2026-10-15',
      created_at: '2026-07-24T10:00:00Z',
    });

    expect(lead.date).toBe('2026-10-15');
    expect(lead.value).toBe(125000);
  });
});
