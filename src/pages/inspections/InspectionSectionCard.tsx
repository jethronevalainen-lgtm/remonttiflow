import type { ChangeEvent } from 'react';
import { Camera, CheckCircle2, Image as ImageIcon, Loader2, Save } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  InspectionAttachment, InspectionResultDetail, InspectionResultStatus,
} from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import { RESULT_OPTIONS } from './inspectionUi';

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
  const completeCount = results.filter((result) => result.status !== 'Tarkastamatta').length;
  const sectionSaving = savingKey === `section-${section.sectionId}`;
  return (
    <Card className="break-inside-avoid print:shadow-none">
      <CardHeader className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="text-lg">{section.sectionTitle}</CardTitle>{section.sectionDescription && <p className="mt-1 text-sm text-text-secondary">{section.sectionDescription}</p>}<p className="mt-1 text-xs text-text-muted">{completeCount}/{results.length} käsitelty</p></div>
          {canManage && !locked && (
            <Button variant="outline" size="sm" disabled={Boolean(savingKey)} onClick={() => void onMarkSection(results)} className="print:hidden">
              {sectionSaving ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle2 size={15} className="mr-2" />}Merkitse osio kunnossa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100 p-0">
        {results.map((result, index) => {
          const resultAttachments = attachments.filter((attachment) => attachment.resultId === result.id);
          return (
            <div key={result.id} className="p-4 sm:p-5">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-semibold text-text-primary">{result.itemTitle}</h3>{result.guidance && <p className="mt-1 text-xs text-text-secondary">{result.guidance}</p>}</div>
                    <Badge className={cn('border-0', result.status === 'Kunnossa' ? 'bg-emerald-50 text-emerald-700' : result.status === 'Puute' ? 'bg-red-50 text-red-700' : result.status === 'Tarkastamatta' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700')}>{result.status}</Badge>
                  </div>
                  {canManage && !locked && (
                    <div className="mt-3 grid grid-cols-2 gap-2 print:hidden sm:grid-cols-3 xl:grid-cols-5">
                      {RESULT_OPTIONS.map((option) => (
                        <button key={option.value} type="button" disabled={Boolean(savingKey)} onClick={() => void onStatus(result, option.value)} className={cn('min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-50', option.className, result.status === option.value && 'ring-2 ring-slate-900/20')}>{option.shortLabel}</button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-col gap-2 print:hidden sm:flex-row">
                    <Textarea value={comments[result.id] ?? ''} onChange={(event) => onCommentChange(result.id, event.target.value)} disabled={!canManage || locked} placeholder="Tarkastushuomio tai tarkennus…" className="min-h-20 flex-1" />
                    {canManage && !locked && (
                      <div className="flex gap-2 sm:flex-col">
                        <Button variant="outline" size="sm" disabled={Boolean(savingKey)} onClick={() => void onSaveComment(result)}>{savingKey === `comment-${result.id}` ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}<span className="ml-2 sm:sr-only">Tallenna</span></Button>
                        <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"><Camera size={15} /><span className="ml-2 sm:sr-only">Lisää kuva</span><Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => void onUpload(event, result)} /></Label>
                      </div>
                    )}
                  </div>
                  {(!canManage || locked) && result.comment && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{result.comment}</p>}
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
