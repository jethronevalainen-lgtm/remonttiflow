import { useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, FileUp, Image as ImageIcon, Loader2, MessageSquarePlus, Save } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import type {
  InspectionAttachment, InspectionResultDetail, InspectionResultStatus,
} from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import {
  RESULT_OPTIONS, resultStatusBadgeClasses, resultStatusLabel,
} from './inspectionUi';

const PRIMARY_RESULT_OPTIONS = RESULT_OPTIONS.filter((option) => !option.secondary);
const SECONDARY_RESULT_OPTION = RESULT_OPTIONS.find((option) => option.secondary);

export default function InspectionSectionCard({
  results,
  attachments,
  canManage,
  locked,
  savingKey,
  comments,
  onCommentChange,
  onStatus,
  onSaveComment,
  onMarkSection,
  onUpload,
  onOpenAttachment,
}: {
  results: InspectionResultDetail[];
  attachments: InspectionAttachment[];
  canManage: boolean;
  locked: boolean;
  savingKey: string | null;
  comments: Record<string, string>;
  onCommentChange: (resultId: string, value: string) => void;
  onStatus: (result: InspectionResultDetail, status: InspectionResultStatus) => Promise<void>;
  onSaveComment: (result: InspectionResultDetail) => Promise<void>;
  onMarkSection: (results: InspectionResultDetail[]) => Promise<void>;
  onUpload: (event: ChangeEvent<HTMLInputElement>, result: InspectionResultDetail) => Promise<void>;
  onOpenAttachment: (objectPath: string) => Promise<void>;
}) {
  const section = results[0];
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const completeCount = results.filter((result) => result.status !== 'Tarkastamatta').length;
  const uncheckedCount = results.length - completeCount;
  const progress = results.length === 0 ? 0 : Math.round((completeCount / results.length) * 100);
  const sectionSaving = savingKey === `section-${section.sectionId}`;

  return (
    <Card className="break-inside-avoid overflow-hidden print:shadow-none">
      <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{section.sectionTitle}</CardTitle>
              {completeCount === results.length && <Badge className="border-0 bg-emerald-50 text-emerald-800"><CheckCircle2 size={14} className="mr-1" />Valmis</Badge>}
            </div>
            {section.sectionDescription && <p className="mt-1 text-sm text-text-secondary">{section.sectionDescription}</p>}
            <div className="mt-3 flex max-w-md items-center gap-3">
              <Progress value={progress} className="h-2" />
              <span className="shrink-0 text-xs font-semibold text-text-secondary">{completeCount}/{results.length}</span>
            </div>
          </div>
          {canManage && !locked && uncheckedCount > 0 && (
            <Button variant="outline" size="sm" disabled={Boolean(savingKey)} onClick={() => void onMarkSection(results)} className="print:hidden">
              {sectionSaving ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle2 size={15} className="mr-2" />}Merkitse {uncheckedCount} tarkastamatonta kunnossa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100 p-0">
        {results.map((result, index) => {
          const resultAttachments = attachments.filter((attachment) => attachment.resultId === result.id);
          const noteOpen = openNotes[result.id] || Boolean(comments[result.id]);
          return (
            <div key={result.id} className={cn('p-4 transition-colors sm:p-5', result.status === 'Puute' && 'bg-red-50/30')}>
              <div className="flex gap-3">
                <span className={cn(
                  'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  result.status === 'Kunnossa' ? 'bg-emerald-100 text-emerald-800' : result.status === 'Puute' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700',
                )}>{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="max-w-4xl"><h3 className="font-semibold leading-snug text-text-primary">{result.itemTitle}</h3>{result.guidance && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{result.guidance}</p>}</div>
                    <Badge className={cn('border-0', resultStatusBadgeClasses(result.status))}>{resultStatusLabel(result.status)}</Badge>
                  </div>

                  {canManage && !locked && (
                    <div className="mt-3 print:hidden">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {PRIMARY_RESULT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={Boolean(savingKey)}
                            onClick={() => void onStatus(result, option.value)}
                            className={cn(
                              'min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold leading-tight transition-all disabled:opacity-50',
                              option.className,
                              result.status === option.value && 'ring-2 ring-slate-900/25 ring-offset-1 shadow-sm',
                            )}
                          >
                            {option.shortLabel}
                          </button>
                        ))}
                      </div>
                      {SECONDARY_RESULT_OPTION && (
                        <button
                          type="button"
                          disabled={Boolean(savingKey)}
                          onClick={() => void onStatus(result, SECONDARY_RESULT_OPTION.value)}
                          className={cn(
                            'mt-2 min-h-9 rounded-lg border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50',
                            SECONDARY_RESULT_OPTION.className,
                            result.status === SECONDARY_RESULT_OPTION.value && 'ring-2 ring-slate-900/25 ring-offset-1 shadow-sm',
                          )}
                        >
                          {SECONDARY_RESULT_OPTION.shortLabel}
                        </button>
                      )}
                    </div>
                  )}

                  {canManage && !locked && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
                      <Button variant="ghost" size="sm" onClick={() => setOpenNotes((previous) => ({ ...previous, [result.id]: !noteOpen }))}>
                        <MessageSquarePlus size={15} className="mr-2" />{noteOpen ? 'Piilota huomio' : 'Lisää huomio'}
                      </Button>
                      <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent">
                        <Camera size={15} className="mr-2" />Ota kuva
                        <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void onUpload(event, result)} />
                      </Label>
                      <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent">
                        <FileUp size={15} className="mr-2" />Valitse kuva tai PDF
                        <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => void onUpload(event, result)} />
                      </Label>
                      {savingKey === `upload-${result.id}` && <span className="inline-flex items-center text-xs text-text-secondary"><Loader2 size={14} className="mr-1 animate-spin" />Lähetetään…</span>}
                    </div>
                  )}

                  {noteOpen && canManage && !locked && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 print:hidden">
                      <Textarea value={comments[result.id] ?? ''} onChange={(event) => onCommentChange(result.id, event.target.value)} placeholder="Kirjaa tarkastushuomio tai tarkennus…" className="min-h-20 bg-white" />
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" disabled={Boolean(savingKey)} onClick={() => void onSaveComment(result)}>{savingKey === `comment-${result.id}` ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Save size={15} className="mr-2" />}Tallenna huomio</Button>
                      </div>
                    </div>
                  )}

                  {(!canManage || locked) && result.comment && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{result.comment}</p>}
                  {resultAttachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{resultAttachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => void onOpenAttachment(attachment.objectPath)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"><ImageIcon size={14} />{attachment.fileName}</button>)}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
