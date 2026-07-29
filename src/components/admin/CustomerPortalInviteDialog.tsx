import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, FolderKanban, MailPlus, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inviteOrganizationMember } from '@/lib/supabase/organizationAdmin';

export interface CustomerPortalInviteProject {
  id: string;
  name: string;
  location?: string;
  status?: string;
}

interface CustomerPortalInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  customer: { id: string; name: string } | null;
  projects: CustomerPortalInviteProject[];
  fixedProject?: CustomerPortalInviteProject | null;
  allowPersistent?: boolean;
  initialFullName?: string;
  initialEmail?: string;
  onInvited?: (message: string) => void;
}

type AccessMode = 'persistent' | 'selected_projects';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CustomerPortalInviteDialog({
  open,
  onOpenChange,
  organizationId,
  customer,
  projects,
  fixedProject = null,
  allowPersistent = true,
  initialFullName = '',
  initialEmail = '',
  onInvited,
}: CustomerPortalInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessMode, setAccessMode] = useState<AccessMode>('persistent');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setFullName(initialFullName);
    setAccessMode(fixedProject || !allowPersistent ? 'selected_projects' : 'persistent');
    setSelectedProjectIds(fixedProject ? [fixedProject.id] : []);
    setError(null);
  }, [allowPersistent, fixedProject, initialEmail, initialFullName, open]);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedProjectIds.includes(project.id)),
    [projects, selectedProjectIds],
  );

  const toggleProject = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((current) => checked
      ? [...new Set([...current, projectId])]
      : current.filter((id) => id !== projectId));
  };

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!organizationId || !customer) {
      setError('Tilaaja-asiakkuutta ei voitu tunnistaa.');
      return;
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError('Anna kelvollinen sähköpostiosoite.');
      return;
    }
    if (accessMode === 'selected_projects' && selectedProjectIds.length === 0) {
      setError('Valitse tilaajalle vähintään yksi projekti.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await inviteOrganizationMember({
        organizationId,
        email: normalizedEmail,
        fullName: fullName.trim(),
        role: 'customer',
        customerAccess: [{
          customerId: customer.id,
          customerName: customer.name,
          accessScope: accessMode === 'persistent' ? 'all_projects' : 'selected_projects',
          projectIds: accessMode === 'selected_projects' ? selectedProjectIds : [],
        }],
      });
      onInvited?.(result.message);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tilaajakutsun lähettäminen epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fixedProject ? 'Kutsu tilaaja projektiin' : 'Kutsu tilaajaportaaliin'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-start gap-3">
              <Building2 size={20} className="mt-0.5 shrink-0 text-teal-700" />
              <div>
                <p className="font-semibold text-teal-950">{customer?.name || 'Tilaaja'}</p>
                <p className="mt-1 text-sm leading-6 text-teal-900">
                  Kutsuttu henkilö saa oman tilaajatyötilan. Hän näkee vain tässä määritetyn asiakkuuden ja sallitut projektit.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-invite-name">Nimi</Label>
              <Input
                id="customer-invite-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={120}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-invite-email">Sähköposti *</Label>
              <Input
                id="customer-invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nimi@yritys.fi"
                autoComplete="email"
              />
            </div>
          </div>

          {!fixedProject && (
            <div className="space-y-2">
              <Label>Käyttöoikeuden laajuus</Label>
              <Select value={accessMode} onValueChange={(value: AccessMode) => {
                setAccessMode(value);
                if (value === 'persistent') setSelectedProjectIds([]);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowPersistent && (
                    <SelectItem value="persistent">Pysyvä tilaaja — kaikki nykyiset ja tulevat projektit</SelectItem>
                  )}
                  <SelectItem value="selected_projects">Projektikohtainen tilaaja — vain valitut projektit</SelectItem>
                </SelectContent>
              </Select>
              {!allowPersistent && (
                <p className="text-xs leading-5 text-slate-500">
                  Projektikoordinaattori voi myöntää vain projektikohtaisia tilaajaoikeuksia.
                </p>
              )}
            </div>
          )}

          {accessMode === 'persistent' ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold">Pysyvä tilaaja</p>
                <p className="mt-1 leading-6">Käyttäjä näkee tämän asiakkuuden nykyiset ja myöhemmin luotavat projektit sekä voi tehdä uusia projektipyyntöjä.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="flex items-center gap-2"><FolderKanban size={16} /> Sallitut projektit *</Label>
                <p className="mt-1 text-xs leading-5 text-slate-500">Valitse vain ne projektit, joiden tiedot tilaaja saa nähdä.</p>
              </div>
              {projects.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Asiakkuudella ei ole vielä projekteja. Pysyvän tilaajan voi kutsua Asiakkaat-näkymästä, kun oikeutesi sallivat sen.
                </div>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                  {projects.map((project) => {
                    const checked = selectedProjectIds.includes(project.id);
                    const locked = fixedProject?.id === project.id;
                    return (
                      <label key={project.id} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                        <Checkbox
                          checked={checked}
                          disabled={saving || locked}
                          onCheckedChange={(value) => toggleProject(project.id, value === true)}
                        />
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-medium text-slate-950">{project.name}</span>
                          <span className="mt-1 block break-words text-xs text-slate-500">{project.location || project.status || 'Ei sijaintia'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedProjects.length > 0 && (
                <p className="text-xs font-medium text-teal-700">Valittu {selectedProjects.length} projektia.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Peruuta</Button>
          <Button onClick={() => void submit()} disabled={saving || !customer || !organizationId} className="gap-2">
            <MailPlus size={16} /> {saving ? 'Lähetetään…' : 'Lähetä kutsu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
