import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OrganizationPerson } from '@/lib/supabase/workManagement';

import { DEFAULT_ASSIGNEE, roleLabel } from './workPlanFormatting';

interface Props {
  value: string[];
  people: OrganizationPerson[];
  fallbackText: string;
  onChange: (userIds: string[]) => void;
}

export default function AssigneeSelect({ value, people, fallbackText, onChange }: Props) {
  return (
    <Select
      value={value[0] || DEFAULT_ASSIGNEE}
      onValueChange={(next) => onChange(next === DEFAULT_ASSIGNEE ? [] : [next])}
    >
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_ASSIGNEE}>{fallbackText}</SelectItem>
        {people.map((person) => (
          <SelectItem key={person.userId} value={person.userId}>
            {person.name} ({roleLabel(person.role)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
