import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260728114500_project_message_supervisor_notifications.sql',
  'utf8',
);

describe('project message supervisor notifications migration', () => {
  it('notifies supervisors of their projects and clears alerts when messages are read', () => {
    expect(migration).toContain('private.project_message_supervisor_targets');
    expect(migration).toContain('private.notify_supervisors_of_project_message');
    expect(migration).toContain("'project_message_new'");
    expect(migration).toContain("'/projektikeskustelut/' || p_message.project_id::text");
    expect(migration).toContain('project_messages_notify_supervisors');
    expect(migration).toContain("dedup_key = 'project-message:' || p_project_id::text || ':' || p_channel");
    expect(migration).toContain("org_member.role = 'supervisor'");
    expect(migration).toContain('mark_project_messages_read');
  });
});
