import { useRef, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bold,
  Heading2,
  Highlighter,
  Info,
  List,
  ListOrdered,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type HighlightColor = 'orange' | 'blue' | 'green' | 'red';

const HIGHLIGHT_CLASSES: Record<HighlightColor, string> = {
  orange: 'font-semibold text-orange-700',
  blue: 'font-semibold text-blue-700',
  green: 'font-semibold text-emerald-700',
  red: 'font-semibold text-red-700',
};

const INLINE_TOKEN = /(\*\*.+?\*\*|\{\{(?:orange|blue|green|red):.+?\}\})/g;

function inlineContent(value: string): ReactNode[] {
  return value.split(INLINE_TOKEN).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    const colorMatch = /^\{\{(orange|blue|green|red):(.+)\}\}$/.exec(part);
    if (colorMatch) {
      const color = colorMatch[1] as HighlightColor;
      return <span key={`${part}-${index}`} className={HIGHLIGHT_CLASSES[color]}>{colorMatch[2]}</span>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function ProjectDescription({ value, className }: { value: string; className?: string }) {
  const nodes: ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const Tag = listType;
    nodes.push(
      <Tag
        key={`list-${nodes.length}`}
        className={listType === 'ul' ? 'ml-5 list-disc space-y-1' : 'ml-5 list-decimal space-y-1'}
      >
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{inlineContent(item)}</li>)}
      </Tag>,
    );
    listType = null;
    listItems = [];
  };

  value.replace(/\r\n/g, '\n').split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || ordered) {
      const nextType = bullet ? 'ul' : 'ol';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((bullet ?? ordered)?.[1] ?? '');
      return;
    }

    flushList();

    const callout = /^>\s*\[!(HUOMIO|VAROITUS|ONNISTUI)\]\s*(.*)$/i.exec(line);
    if (callout) {
      const type = callout[1].toUpperCase();
      const isWarning = type === 'VAROITUS';
      const isSuccess = type === 'ONNISTUI';
      nodes.push(
        <div
key={`callout-${nodes.length}`}
className={cn(
  'flex items-start gap-3 rounded-xl border px-4 py-3',
  isWarning && 'border-red-200 bg-red-50 text-red-800',
  isSuccess && 'border-emerald-200 bg-emerald-50 text-emerald-800',
  !isWarning && !isSuccess && 'border-orange-200 bg-orange-50 text-orange-900',
)}
        >
{isWarning ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <Info size={18} className="mt-0.5 shrink-0" />}
<div><p className="text-xs font-bold uppercase tracking-wide">{type === 'ONNISTUI' ? 'Valmis' : type}</p><p className="mt-0.5 leading-6">{inlineContent(callout[2])}</p></div>
        </div>,
      );
      return;
    }

    if (line.startsWith('### ')) {
      nodes.push(<h4 key={`h4-${nodes.length}`} className="pt-1 text-sm font-bold uppercase tracking-wide text-slate-700">{inlineContent(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      nodes.push(<h3 key={`h3-${nodes.length}`} className="pt-1 text-base font-bold text-slate-950">{inlineContent(line.slice(3))}</h3>);
    } else if (line.startsWith('# ')) {
      nodes.push(<h2 key={`h2-${nodes.length}`} className="pt-1 text-lg font-bold text-slate-950">{inlineContent(line.slice(2))}</h2>);
    } else {
      nodes.push(<p key={`p-${nodes.length}`} className="leading-6 text-slate-700">{inlineContent(line)}</p>);
    }
  });
  flushList();

  return <div className={cn('space-y-2 text-sm', className)}>{nodes}</div>;
}

interface ProjectDescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export function ProjectDescriptionEditor({ id, value, onChange }: ProjectDescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const replaceSelection = (before: string, after: string, fallback: string) => {
    const element = textareaRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const replacement = `${before}${selected}${after}`;
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const prefixSelection = (prefix: string, fallback: string) => {
    const element = textareaRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const replacement = selected.split('\n').map((line) => `${prefix}${line}`).join('\n');
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start, start + replacement.length);
    });
  };

  const insertCallout = (type: 'HUOMIO' | 'VAROITUS') => {
    const element = textareaRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end) || (type === 'HUOMIO' ? 'Kirjoita tärkeä huomio' : 'Kirjoita varoitus');
    const replacement = `> [!${type}] ${selected}`;
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + replacement.length, start + replacement.length);
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-slate-50 p-2">
        <Button type="button" variant="outline" size="sm" onClick={() => prefixSelection('## ', 'Väliotsikko')} title="Väliotsikko"><Heading2 size={15} /> Otsikko</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => replaceSelection('**', '**', 'lihavoitu teksti')} title="Lihavointi"><Bold size={15} /> Lihavoi</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => prefixSelection('- ', 'Luettelokohta')} title="Luettelo"><List size={15} /> Luettelo</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => prefixSelection('1. ', 'Luettelokohta')} title="Numeroitu luettelo"><ListOrdered size={15} /> Numerointi</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => insertCallout('HUOMIO')} title="Huomiolaatikko"><Info size={15} /> Huomio</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => insertCallout('VAROITUS')} title="Varoituslaatikko"><AlertTriangle size={15} /> Varoitus</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => replaceSelection('{{orange:', '}}', 'korostettu teksti')} title="Oranssi korostus"><Highlighter size={15} className="text-orange-600" /> Korosta</Button>
        <Button type="button" variant="outline" size="sm" className="text-blue-700" onClick={() => replaceSelection('{{blue:', '}}', 'sininen teksti')}>Sininen</Button>
        <Button type="button" variant="outline" size="sm" className="text-emerald-700" onClick={() => replaceSelection('{{green:', '}}', 'vihreä teksti')}>Vihreä</Button>
        <Button type="button" variant="outline" size="sm" className="text-red-700" onClick={() => replaceSelection('{{red:', '}}', 'punainen teksti')}>Punainen</Button>
      </div>
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={10}
        className="min-h-[260px] resize-y rounded-none border-0 px-4 py-3 leading-6 shadow-none focus-visible:ring-0"
        placeholder={'## Aikataulu\n- A1: 20.7.–31.7.2026 — Marko\n\n> [!HUOMIO] Huoneistoa A2 voidaan käyttää taukotilana.'}
      />
      <div className="border-t border-slate-200 bg-slate-50/70 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Esikatselu</p>
        {value.trim() ? <ProjectDescription value={value} /> : <p className="text-sm text-slate-500">Muotoiltu kuvaus näkyy tässä.</p>}
      </div>
    </div>
  );
}
