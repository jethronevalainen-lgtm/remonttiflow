import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  'supabase/migrations/20260726193000_complete_customer_collaboration.sql',
);
const uploadFixPath = path.resolve(
  'supabase/migrations/20260726193010_fix_project_message_attachment_upload.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const uploadFix = fs.readFileSync(uploadFixPath, 'utf8');

describe('complete customer collaboration migration', () => {
  it('enables RLS and removes anonymous access from message metadata', () => {
    expect(migration).toContain('alter table public.project_message_mentions enable row level security');
    expect(migration).toContain('alter table public.project_message_attachments enable row level security');
    expect(migration).toContain('revoke all on public.project_message_mentions, public.project_message_attachments from anon');
  });

  it('keeps every security-definer API explicitly authenticated', () => {
    const requiredFunctions = [
      'project_conversation_participants_v2',
      'project_messages_for_user_v2',
      'send_project_message_v2',
      'edit_project_message_v2',
      'delete_project_message_v2',
      'attach_project_message_file_v2',
      'customer_project_documents_v2',
      'set_project_document_customer_visibility_v2',
      'submit_change_order_to_customer_v2',
      'customer_project_change_orders_v2',
      'decide_customer_change_order_v2',
    ];

    for (const functionName of requiredFunctions) {
      expect(migration).toContain(`revoke all on function public.${functionName}`);
      expect(migration).toContain(`grant execute on function public.${functionName}`);
    }
  });

  it('separates customer decisions from management publication', () => {
    expect(migration).toContain("not private.is_management_user(change_row.organization_id, auth.uid())");
    expect(migration).toContain("not private.is_customer_project_user(change_row.project_id, change_row.organization_id, auth.uid())");
    expect(migration).toContain("p_decision not in ('Hyväksytty', 'Hylätty')");
  });

  it('limits message attachments and supports secure first-upload RETURNING', () => {
    expect(migration).toContain('size_bytes <= 10485760');
    expect(migration).toContain("bucket_id = 'project-message-attachments'");
    expect(uploadFix).toContain('owner_id = (select auth.uid())::text');
    expect(uploadFix).toContain('private.can_read_project_message');
  });
});
