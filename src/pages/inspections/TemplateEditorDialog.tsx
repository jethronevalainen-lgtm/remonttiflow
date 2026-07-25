import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  loadTemplateEditor, publishInspectionTemplate, type InspectionTemplateSummary,
  type TemplateEditorSection,
} from '@/lib/supabase/inspectionEntities';
import { emptyTemplateSection } from './inspectionUi';

interface Props {
  open: boolean;
  organizationId: string;
  template: InspectionTemplateSummary | null;
  onClose: () => void;
  onPublished: () => Promise<unknown>;
}

export default function TemplateEditorDialog({ open, organizationId, template, onClose, onPublished }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Muu');
  const [description, setDescription] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [sections, setSections] = useState<TemplateEditorSection[]>([emptyTemplateSection()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setError(null);
      if (!template) {
        setName(''); setCategory('Muu'); setDescription(''); setChangeNote('Ensimmäinen versio');
        setSections([emptyTemplateSection()]);
        return;
      }
      setLoading(true);
      try {
        const loaded = await loadTemplateEditor(template.versionId);
        if (cancelled) return;
        setName(template.name); setCategory(template.category); setDescription(template.description); setChangeNote('');
        setSections(loaded.map((section) => ({
          ...section,
          id: crypto.randomUUID(),
          items: section.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
        })));
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Pohjan avaaminen epäonnistui.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open, template]);

  const patchSection = (sectionId: string, patch: Partial<TemplateEditorSection>) => {
    setSections((previous) => previous.map((section) => section.id === sectionId ? { ...section, ...patch } : section));
  };

  const patchItem = (
    sectionId: string,
    itemId: string,
    patch: Partial<TemplateEditorSection['items'][number]>,
  ) => {
    setSections((previous) => previous.map((section) => section.id === sectionId
      ? { ...section, items: section.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) }
      : section));
  };

  const valid = Boolean(name.trim() && category.trim() && sections.length
    && sections.every((section) => section.title.trim() && section.items.length
      && section.items.every((item) => item.title.trim())));

  const submit = async () => {
    if (!valid) return;
    setSaving(true); setError(null);
    try {
      await publishInspectionTemplate({
        organizationId,
        templateId: template?.id,
        name,
        category,
        description,
        changeNote,
        sections,
      });
      await onPublished();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pohjan julkaisu epäonnistui.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>{template ? `Uusi versio: ${template.name}` : 'Luo oma tarkastuspohja'}</DialogTitle></DialogHeader>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Pohjan nimi *</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div><Label>Kategoria *</Label><Input value={category} onChange={(event) => setCategory(event.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Kuvaus</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Versiomuutos</Label><Input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Mitä tässä versiossa muutettiin?" /></div>
          </div>

          <div className="space-y-4">
            {sections.map((section, sectionIndex) => (
              <Card key={section.id}>
                <CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Osio {sectionIndex + 1}</CardTitle>{sections.length > 1 && <Button variant="ghost" size="sm" onClick={() => setSections((previous) => previous.filter((item) => item.id !== section.id))}><Trash2 size={15} className="mr-2" />Poista osio</Button>}</div></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2"><div><Label>Osion nimi *</Label><Input value={section.title} onChange={(event) => patchSection(section.id, { title: event.target.value })} /></div><div><Label>Ohjeteksti</Label><Input value={section.description} onChange={(event) => patchSection(section.id, { description: event.target.value })} /></div></div>
                  <div className="space-y-3">
                    {section.items.map((item, itemIndex) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Kohta {itemIndex + 1}</p>{section.items.length > 1 && <Button variant="ghost" size="sm" onClick={() => patchSection(section.id, { items: section.items.filter((candidate) => candidate.id !== item.id) })}>Poista</Button>}</div>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2"><div><Label>Tarkastuskohta *</Label><Input value={item.title} onChange={(event) => patchItem(section.id, item.id, { title: event.target.value })} /></div><div><Label>Tarkennus</Label><Input value={item.guidance} onChange={(event) => patchItem(section.id, item.id, { guidance: event.target.value })} /></div></div>
                        <div className="mt-3 flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><Checkbox checked={item.required} onCheckedChange={(checked) => patchItem(section.id, item.id, { required: checked === true })} />Pakollinen</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={item.photoRequiredOnDefect} onCheckedChange={(checked) => patchItem(section.id, item.id, { photoRequiredOnDefect: checked === true })} />Kuva vaaditaan puutteesta</label></div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => patchSection(section.id, { items: [...section.items, { id: crypto.randomUUID(), title: '', guidance: '', required: true, photoRequiredOnDefect: true }] })}><Plus size={15} className="mr-2" />Lisää tarkastuskohta</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => setSections((previous) => [...previous, emptyTemplateSection()])}><Plus size={16} className="mr-2" />Lisää osio</Button>
          </div>
        </>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Peruuta</Button><Button disabled={loading || saving || !valid} onClick={() => void submit()}>{saving && <Loader2 size={16} className="mr-2 animate-spin" />}Julkaise uusi versio</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
