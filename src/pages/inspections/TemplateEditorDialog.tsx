import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

function newItem() {
  return {
    id: crypto.randomUUID(),
    title: '',
    guidance: '',
    required: true,
    photoRequiredOnDefect: true,
  };
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function TemplateEditorDialog({ open, organizationId, template, onClose, onPublished }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Muu');
  const [description, setDescription] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [sections, setSections] = useState<TemplateEditorSection[]>([emptyTemplateSection()]);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setError(null);
      setLoading(Boolean(template));
      if (!template) {
        const initial = emptyTemplateSection();
        setName('');
        setCategory('Muu');
        setDescription('');
        setChangeNote('Ensimmäinen versio');
        setSections([initial]);
        setActiveSectionId(initial.id);
        return;
      }
      try {
        const loaded = await loadTemplateEditor(template.versionId);
        if (cancelled) return;
        const nextSections = loaded.map((section) => ({
          ...section,
          id: crypto.randomUUID(),
          items: section.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
        }));
        setName(template.system ? `${template.name} – oma` : template.name);
        setCategory(template.category);
        setDescription(template.description);
        setChangeNote(template.system ? 'Mukautettu VaKantti-pohjasta' : '');
        setSections(nextSections.length ? nextSections : [emptyTemplateSection()]);
        setActiveSectionId(nextSections[0]?.id ?? '');
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Pohjan avaaminen epäonnistui.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open, template]);

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const questionCount = useMemo(() => sections.reduce((total, section) => total + section.items.length, 0), [sections]);

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

  const addSection = () => {
    const section = emptyTemplateSection();
    setSections((previous) => [...previous, section]);
    setActiveSectionId(section.id);
  };

  const duplicateSection = (section: TemplateEditorSection) => {
    const copy: TemplateEditorSection = {
      ...section,
      id: crypto.randomUUID(),
      title: `${section.title} – kopio`,
      items: section.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    };
    setSections((previous) => [...previous, copy]);
    setActiveSectionId(copy.id);
  };

  const deleteSection = (sectionId: string) => {
    setSections((previous) => {
      const next = previous.filter((section) => section.id !== sectionId);
      setActiveSectionId(next[0]?.id ?? '');
      return next;
    });
  };

  const valid = Boolean(name.trim() && category.trim() && sections.length
    && sections.every((section) => section.title.trim() && section.items.length
      && section.items.every((item) => item.title.trim())));

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await publishInspectionTemplate({
        organizationId,
        templateId: template && !template.system ? template.id : undefined,
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
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[96vh] overflow-hidden p-0 sm:max-w-6xl">
        <div className="flex max-h-[96vh] flex-col">
          <DialogHeader className="border-b px-6 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle>{template?.system ? 'Mukauta tarkastuspohja omaan käyttöön' : template ? `Muokkaa tarkastuspohjaa: ${template.name}` : 'Luo tarkastuspohja'}</DialogTitle>
                <p className="mt-1 text-sm text-text-secondary">Julkaisu luo uuden version. Käynnissä olevien ja aiempien tarkastusten kysymykset eivät muutu.</p>
              </div>
              <div className="flex gap-2"><Badge variant="outline">{sections.length} osiota</Badge><Badge variant="outline">{questionCount} kysymystä</Badge></div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : (
              <div className="space-y-5">
                <Card>
                  <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                    <div><Label>Pohjan nimi *</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
                    <div><Label>Kategoria *</Label><Input value={category} onChange={(event) => setCategory(event.target.value)} /></div>
                    <div className="sm:col-span-2"><Label>Kuvaus</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-20" /></div>
                    <div className="sm:col-span-2"><Label>Versiomuutos</Label><Input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Mitä tässä versiossa muutettiin?" /></div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <Card className="h-fit lg:sticky lg:top-0">
                    <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">Osiot</CardTitle><Button variant="ghost" size="icon" onClick={addSection} aria-label="Lisää osio"><Plus size={16} /></Button></div></CardHeader>
                    <CardContent className="space-y-2">
                      {sections.map((section, index) => (
                        <div key={section.id} className="flex items-center gap-1">
                          <button type="button" onClick={() => setActiveSectionId(section.id)} className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-left ${section.id === activeSection?.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <p className="break-words text-sm font-semibold">{section.title || `Nimetön osio ${index + 1}`}</p>
                            <p className="mt-0.5 text-xs text-text-muted">{section.items.length} kysymystä</p>
                          </button>
                          <div className="flex flex-col">
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => setSections((previous) => move(previous, index, index - 1))} aria-label="Siirrä osiota ylös"><ArrowUp size={13} /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === sections.length - 1} onClick={() => setSections((previous) => move(previous, index, index + 1))} aria-label="Siirrä osiota alas"><ArrowDown size={13} /></Button>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" className="w-full" onClick={addSection}><Plus size={15} className="mr-2" />Lisää osio</Button>
                    </CardContent>
                  </Card>

                  {activeSection && (
                    <Card>
                      <CardHeader className="border-b bg-slate-50/60 pb-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="flex items-center gap-2 text-base"><GripVertical size={16} className="text-text-muted" />Osion asetukset</CardTitle>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div><Label>Osion nimi *</Label><Input value={activeSection.title} onChange={(event) => patchSection(activeSection.id, { title: event.target.value })} /></div>
                              <div><Label>Ohjeteksti</Label><Input value={activeSection.description} onChange={(event) => patchSection(activeSection.id, { description: event.target.value })} /></div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => duplicateSection(activeSection)}><Copy size={14} className="mr-1" />Kopioi</Button>
                            {sections.length > 1 && <Button variant="ghost" size="sm" className="text-red-700" onClick={() => deleteSection(activeSection.id)}><Trash2 size={14} className="mr-1" />Poista</Button>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 p-4 sm:p-5">
                        {activeSection.items.map((item, itemIndex) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2"><GripVertical size={15} className="text-text-muted" /><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Kysymys {itemIndex + 1}</p></div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={itemIndex === 0} onClick={() => patchSection(activeSection.id, { items: move(activeSection.items, itemIndex, itemIndex - 1) })} aria-label="Siirrä kysymystä ylös"><ArrowUp size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={itemIndex === activeSection.items.length - 1} onClick={() => patchSection(activeSection.id, { items: move(activeSection.items, itemIndex, itemIndex + 1) })} aria-label="Siirrä kysymystä alas"><ArrowDown size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => patchSection(activeSection.id, { items: [...activeSection.items.slice(0, itemIndex + 1), { ...item, id: crypto.randomUUID(), title: `${item.title} – kopio` }, ...activeSection.items.slice(itemIndex + 1)] })} aria-label="Kopioi kysymys"><Copy size={14} /></Button>
                                {activeSection.items.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-700" onClick={() => patchSection(activeSection.id, { items: activeSection.items.filter((candidate) => candidate.id !== item.id) })} aria-label="Poista kysymys"><Trash2 size={14} /></Button>}
                              </div>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div><Label>Tarkastuskysymys *</Label><Input value={item.title} onChange={(event) => patchItem(activeSection.id, item.id, { title: event.target.value })} /></div>
                              <div><Label>Tarkastajan ohje</Label><Input value={item.guidance} onChange={(event) => patchItem(activeSection.id, item.id, { guidance: event.target.value })} /></div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-5 rounded-lg bg-slate-50 px-3 py-2">
                              <label className="flex items-center gap-2 text-sm"><Checkbox checked={item.required} onCheckedChange={(checked) => patchItem(activeSection.id, item.id, { required: checked === true })} />Pakollinen kysymys</label>
                              <label className="flex items-center gap-2 text-sm"><Checkbox checked={item.photoRequiredOnDefect} onCheckedChange={(checked) => patchItem(activeSection.id, item.id, { photoRequiredOnDefect: checked === true })} />Puutteesta vaaditaan kuva</label>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" onClick={() => patchSection(activeSection.id, { items: [...activeSection.items, newItem()] })}><Plus size={15} className="mr-2" />Lisää kysymys</Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" disabled={saving} onClick={onClose}>Peruuta</Button>
            <Button disabled={loading || saving || !valid} onClick={() => void submit()}>{saving && <Loader2 size={16} className="mr-2 animate-spin" />}{template?.system ? 'Tallenna omaksi pohjaksi' : 'Julkaise uusi versio'}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
