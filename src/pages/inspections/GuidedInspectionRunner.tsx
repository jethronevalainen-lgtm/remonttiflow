import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileUp,
  Image as ImageIcon,
  Loader2,
  MinusCircle,
  Save,
  SkipForward,
  XCircle,
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

function StatusIcon({ status, className }: { status: InspectionResultStatus; className?: string }) {
  if (status === 'Kunnossa') return <CheckCircle2 className={className} />;
  if (status === 'Puute') return <XCircle className={className} />;
  if (status === 'Ei voitu tarkastaa') return <AlertTriangle className={className} />;
  if (status === 'Tarkastettava myöhemmin') return <Clock3 className={className} />;
  if (status === 'Ei koske kohdetta') return <MinusCircle className={className} />;
  return <CircleHelp className={className} />;
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
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-text-secondary">
          Tarkastuspohjassa ei ole tarkastuskohtia. Lisää kohdat pohja-asetuksissa ennen tarkastuksen aloittamista.
        </CardContent>
      </Card>
    );
  }

  const currentIndex = Math.max(0, orderedResults.findIndex((result) => result.id === currentResultId));
  const result = orderedResults[currentIndex];
  const resultAttachments = attachments.filter((attachment) => attachment.resultId === result.id);
  const completed = orderedResults.filter((item) => item.status !== 'Tarkastamatta').length;
  const remaining = orderedResults.length - completed;
  const progress = Math.round((completed / orderedResults.length) * 100);
  const busy = Boolean(savingKey);
  const statusSaving = savingKey === result.id;
  const commentChanged = (comments[result.id] ?? '') !== result.comment;
  const sectionResults = orderedResults.filter((item) => item.sectionId === result.sectionId);
  const sectionCompleted = sectionResults.filter((item) => item.status !== 'Tarkastamatta').length;
  const primaryOptions = RESULT_OPTIONS.filter((option) => option.value === 'Kunnossa' || option.value === 'Puute');
  const secondaryOptions = RESULT_OPTIONS.filter((option) => option.value !== 'Kunnossa' && option.value !== 'Puute');
  const missingRequiredDefectPhoto = result.status === 'Puute'
    && result.photoRequiredOnDefect
    && resultAttachments.length === 0;

  const move = (nextIndex: number) => {
    const next = orderedResults[Math.max(0, Math.min(orderedResults.length - 1, nextIndex))];
    if (next) setCurrentResultId(next.id);
  };

  const moveToNextIncomplete = () => {
    const afterCurrent = orderedResults.slice(currentIndex + 1).find((item) => item.status === 'Tarkastamatta');
    const beforeCurrent = orderedResults.slice(0, currentIndex).find((item) => item.status === 'Tarkastamatta');
    const next = afterCurrent ?? beforeCurrent;
    if (next) setCurrentResultId(next.id);
  };

  const chooseStatus = async (status: InspectionResultStatus) => {
    await onStatus(result, status);
    if (status !== 'Puute' && currentIndex < orderedResults.length - 1) move(currentIndex + 1);
  };

  const renderStatusOption = (option: (typeof RESULT_OPTIONS)[number], primary: boolean) => (
    <button
      key={option.value}
      type="button"
      disabled={busy}
      aria-pressed={result.status === option.value}
      onClick={() => void chooseStatus(option.value)}
      className={cn(
        'flex min-h-20 items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
        option.className,
        primary && 'min-h-24 sm:px-5 sm:py-4',
        result.status === option.value && 'ring-2 ring-slate-900/25 ring-offset-2',
      )}
    >
      <span className={cn(
        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80',
        primary && 'h-10 w-10',
      )}>
        <StatusIcon status={option.value} className={primary ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
      <span className="min-w-0">
        <span className={cn('block font-bold leading-tight', primary ? 'text-base' : 'text-sm')}>
          {option.shortLabel}
        </span>
        <span className="mt-1 block text-xs font-medium leading-relaxed opacity-80">
          {option.description}
        </span>
      </span>
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{result.sectionTitle}</p>
            <p className="mt-1 text-sm text-text-secondary">
              Kohta {currentIndex + 1}/{orderedResults.length} · osio {sectionCompleted}/{sectionResults.length} · yhteensä {completed} käsitelty
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusSaving && (
              <span className="inline-flex items-center text-xs font-medium text-text-secondary">
                <Loader2 size={14} className="mr-1.5 animate-spin" /> Tallennetaan
              </span>
            )}
            <Badge className={cn('w-fit border-0', resultStatusBadgeClasses(result.status))} aria-live="polite">
              {resultStatusLabel(result.status)}
            </Badge>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="w-10 text-right text-xs font-bold text-text-secondary">{progress}%</span>
        </div>
      </div>

      <Card className={cn(
        'overflow-hidden border-2 shadow-sm',
        result.status === 'Puute' ? 'border-red-200' : 'border-slate-200',
      )}>
        <CardContent className="space-y-5 p-5 sm:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Tarkastuskohta</Badge>
              {result.required && <Badge className="border-0 bg-blue-50 text-blue-700">Pakollinen</Badge>}
              {result.photoRequiredOnDefect && (
                <Badge className="border-0 bg-violet-50 text-violet-700">Puutteesta kuva</Badge>
              )}
            </div>
            <h2 className="mt-3 max-w-3xl break-words text-xl font-bold leading-tight text-text-primary sm:text-2xl">
              {result.itemTitle}
            </h2>
            {result.guidance && (
              <div className="mt-3 max-w-3xl rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Mitä tarkastetaan</p>
                <p className="mt-1 break-words text-sm leading-6 text-text-secondary">{result.guidance}</p>
              </div>
            )}
          </div>

          {canManage && !locked ? (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm font-semibold text-text-primary">Valitse tulos</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {primaryOptions.map((option) => renderStatusOption(option, true))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Muut tilanteet</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {secondaryOptions.map((option) => renderStatusOption(option, false))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
              Tarkastus on vain luettavissa. Tallennetun tuloksen voi nähdä yllä olevasta tilasta.
            </div>
          )}

          {missingRequiredDefectPhoto && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Lisää puutteesta kuva</p>
                <p className="mt-1 text-xs leading-relaxed">Tämä tarkastuskohta edellyttää kuvan, jotta korjaustarve voidaan todentaa.</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={`inspection-comment-${result.id}`}>Huomio tai mittaustulos</Label>
              {commentChanged && <span className="text-xs font-medium text-amber-700">Tallentamaton muutos</span>}
            </div>
            <Textarea
              id={`inspection-comment-${result.id}`}
              value={comments[result.id] ?? ''}
              onChange={(event) => onCommentChange(result.id, event.target.value)}
              disabled={!canManage || locked}
              placeholder="Kirjaa esimerkiksi mitattu arvo, sijainti tai tarkennus."
              className="mt-2 min-h-24 bg-white"
            />
            {canManage && !locked && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                    <Camera size={16} className="mr-2" /> Ota kuva
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => void onUpload(event, result)}
                    />
                  </Label>
                  <Label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                    <FileUp size={16} className="mr-2" /> Lisää kuva tai PDF
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(event) => void onUpload(event, result)}
                    />
                  </Label>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void onSaveComment(result)}
                  disabled={busy || !commentChanged}
                >
                  {savingKey === `comment-${result.id}`
                    ? <Loader2 size={16} className="mr-2 animate-spin" />
                    : <Save size={16} className="mr-2" />}
                  Tallenna huomio
                </Button>
              </div>
            )}
            {savingKey === `upload-${result.id}` && (
              <p className="mt-2 flex items-center text-sm text-text-secondary">
                <Loader2 size={15} className="mr-2 animate-spin" /> Tiedostoa tallennetaan…
              </p>
            )}
          </div>

          {resultAttachments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Tämän kohdan liitteet ({resultAttachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {resultAttachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => void onOpenAttachment(attachment.objectPath)}
                    className="inline-flex min-h-11 items-center gap-2 break-words rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <ImageIcon size={16} className="shrink-0" />
                    {attachment.fileName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => move(currentIndex - 1)}
            disabled={currentIndex === 0 || busy}
            className="px-3 sm:px-4"
          >
            <ChevronLeft size={17} className="sm:mr-1" />
            <span className="hidden sm:inline">Edellinen</span>
          </Button>
          <button
            type="button"
            onClick={moveToNextIncomplete}
            disabled={remaining === 0 || busy}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-xs font-semibold text-text-secondary hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
          >
            {remaining > 0 ? <SkipForward size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />}
            <span className="truncate">{remaining > 0 ? `${remaining} tarkastamatta` : 'Kaikki käsitelty'}</span>
          </button>
          <Button
            onClick={() => move(currentIndex + 1)}
            disabled={currentIndex === orderedResults.length - 1 || busy}
            className="px-3 sm:px-4"
          >
            <span className="hidden sm:inline">Seuraava</span>
            <ChevronRight size={17} className="sm:ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
