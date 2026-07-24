import { supabase } from '@/lib/supabase/client';

export async function sendPersonalMessage(values: {
  organizationId: string;
  senderUserId: string;
  senderName: string;
  recipientUserId: string;
  recipientName: string;
  subject?: string;
  content: string;
}): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    organization_id: values.organizationId,
    created_by: values.senderUserId,
    sender_user_id: values.senderUserId,
    recipient_user_id: values.recipientUserId,
    sender: values.senderName,
    recipient: values.recipientName,
    subject: values.subject?.trim() || null,
    content: values.content.trim(),
    sent_at: new Date().toISOString(),
    read: false,
  });
  if (error) throw new Error(`Viestin lähettäminen epäonnistui: ${error.message}`);
}

export async function markPersonalMessageRead(
  organizationId: string,
  messageId: string,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('organization_id', organizationId)
    .eq('id', messageId);
  if (error) throw new Error(`Viestin lukutilan päivitys epäonnistui: ${error.message}`);
}

export async function deleteSentPersonalMessage(
  organizationId: string,
  messageId: string,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', messageId);
  if (error) throw new Error(`Viestin poistaminen epäonnistui: ${error.message}`);
}
