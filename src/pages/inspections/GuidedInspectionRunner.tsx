import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Save,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import type {
  InspectionAttachment,
  InspectionResultDetail,
  InspectionResultStatus,
} from '@/lib/supabase/inspectionEntities';
import { cn } from '@/lib/utils';
import {
  RESULT_OPTIONS,
  resultStatusBadgeClasses,
  resultStatusLabel,
} from './inspectionUi';

interface Props {
  results: InspectionResultDetail[];
  attachments: InspectionAttachment[];
  canManage: boolean;
  locked: boolean;
  savingKey: string | null;
  comments: Record<string, string>;
  onCommentChange: (resultId: string, value: string) => void;
  onStatus: (result: InspectionResultDetail, status: InspectionResultStatus) => Promise<void>;
  onSaveComment: (result: InspectionResultDetail) => Promise<void>;
  onUpload: (event: ChangeEvent<HTMLInputElement>, result: InspectionResultDetail) => Promise<void>;
  onOpenAttachment: (objectPath: string) => Promise<void>;
}

export default function GuidedInspectionRunner({
  results,
  attachments,
  canManage,
  locked,
  savingKey,
  comments,
  onCommentChange,
  onStatus,
  onSaveComment,
  onUpload,
  onOpenAttachment,
}: Props) {
  const orderedResults = useMemo(() => [...results].sort((left, right) => (
    left.sectionOrder - right.sectionOrder || left.itemOrder - right.itemOrder
  )), [results]);
  const [currentResultId, setCurrentResultId] = useState('');

  useEffect(() => {
    if (orderedResults.length === 0) return;
    if (currentResultId && orderedResults.some((result) => result.id === currentResultId)) return;
    const firstIncomplete = orderedResults.find((result) => result.status === 'Tarkastamatta');
    setCurrentResultId((firstIncomplete ?? orderedResults[0]).id);
  }, [currentResultId, orderedResults]);

  if (orderedResults.length === 0) {
    return <Card><CardContent className="p-8 text-center text-sm text-text-secondary">Tarkastuksessa ei ole tarkastuskohtia.</CardContent></Card>;
  }

  const currentIndex = Math.max(0, orderedResults.findIndex((result) => result.id === currentResultId));
  const result = orderedResults[currentIndex];
  const resultAttachments = attachments.filter((attachment) => attachment.resultId === result.id);
  const completed = orderedResults.filter((item) => item.status !== 'Tarkastamatta').length;
  const progress = Math.round((completed / orderedResults.length) * 100);
  const busy = Boolean(savingKey);

  const move = (nextIndex: number) => {
    const next = orderedResults[Math.max(0, Math.min(orderedResults.length - 1, nextIndex))];
    if (next) setCurrentResultId(next.id);
  };

  const chooseStatus = async (status: InspectionResultStatus) => {
    await onStatus(result, status);
    if (status !== 'Puute' && currentIndex < orderedResults.length - 1) move(currentIndex + 1);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{result.sectionTitle}</p>
            <p className="mt-1 text-sm text-text-secondary">
              Kohta {currentIndex + 1}/{orderedResults.length} · {completed} käsitelty
            </p>
          </div>
          <Badge className={cn('w-fit border-0', resultStatusBadgeClasses(result.status))}>
            {resultStatusLabel(result.status)}
          </Badge>
        </div>
        <Progress value={progress} className="mt-3 h-2" />
      </div>

      <Card className={cn('overflow-hidden border-2 shadow-sm', result.status === 'Puute' ? 'border-red-200' : 'border-slate-200')}>
        <CardContent className="space-y-5 p-5 sm:p-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Tarkastuskohta
            </p>
            <h2 className="mx-auto mt-2 max-w-2xl break-words text-xl font-bold leading-tight text-text-primary sm:text-2xl">
              {result.itemTitle}
            </h2>
            {result.guidance && (
              <p className="mx-auto mt-3 max-w-2xl break-words text-sm leading-6 text-text-secondary">
                {result.guidance}
              </p>
            )}
          </div>

          {canManage && !locked && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {RESULT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={busy}
                  onClick={() => void chooseStatus(option.value)}
                  className={cn(
                    'min-h-14 rounded-xl border-2 px-4 py-3 text-base font-bold leading-tight transition disabled:opacity-50',
                    option.className,
                    option.secondary && 'sm:col-span-2 lg:col-span-1',
                    result.status === option.value && 'ring-2 ring-slate-900/25 ring-offset-2',
                  )}
                >
                  {savingKey === result.id && result.status === option.value
                    ? <Loader2 size={18} className="mx-auto animate-spin" />
                    : option.shortLabel}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <Label htmlFor={`inspection-comment-${result.id}`}>Huomio</Label>
            <Textarea
              id={`inspection-comment-${result.id}`}
              value={comments[result.id] ?? ''}
              onChange={(event) => onCommentChange(result.id, event.target.value)}
              disabled={!canManage || locked}
              placeholder="Kirjaa tarkennus, havainto tai mittaustulos."
              className="mt-2 min-h-24 bg-white"
            />
            {canManage && !locked && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm font-medium">
                    <Camera size={16} className="mr-2" /> Ota kuva
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => void onUpload(event, result)}
                    />
                  </Label>
                  <Label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm font-medium">
                    <FileUp size={16} className="mr-2" /> Valitse kuva tai PDF
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(event) => void onUpload(event, result)}
                    />
                  </Label>
                </div>
                <Button variant="outline" onClick={() => void onSaveComment(result)} disabled={busy}>
                  {savingKey === `comment-${result.id}`
                    ? <Loader2 size={16} className="mr-2 animate-spin" />
                    : <Save size={16} className="mr-2" />}
                  Tallenna huomio
                </Button>
              </div>
            )}
            {savingKey === `upload-${result.id}` && (
              <p className="mt-2 flex items-center text-sm text-text-secondary">
                <Loader2 size={15} className="mr-2 animate-spin" /> Kuvaa tallennetaan…
              </p>
            )}
          </div>

          {resultAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {resultAttachments.map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => void onOpenAttachment(attachment.objectPath)}
                  className="inline-flex min-h-11 items-center gap-2 break-words rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm"
                >
                  <ImageIcon size={16} className="shrink-0" />
                  {attachment.fileName}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
        <Button variant="outline" onClick={() => move(currentIndex - 1)} disabled={currentIndex === 0 || busy}>
          <ChevronLeft size={17} className="mr-1" /> Edellinen
        </Button>
        <span className="text-center text-xs font-semibold text-text-secondary">
          {currentIndex + 1} / {orderedResults.length}
        </span>
        <Button onClick={() => move(currentIndex + 1)} disabled={currentIndex === orderedResults.length - 1 || busy}>
          Seuraava <ChevronRight size={17} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
