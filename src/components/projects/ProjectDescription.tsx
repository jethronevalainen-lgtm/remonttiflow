import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  Eraser,
  Heading2,
  Highlighter,
  Info,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type RichTextColor = 'orange' | 'blue' | 'green' | 'red';
export type CalloutTone = 'info' | 'warning' | 'success';

export interface RichTextRun {
  text: string;
  bold?: boolean;
  color?: RichTextColor;
  highlight?: boolean;
}

export type RichTextBlock =
  | { type: 'paragraph'; runs: RichTextRun[] }
  | { type: 'heading'; level: 2 | 3; runs: RichTextRun[] }
  | { type: 'bulletList'; items: RichTextRun[][] }
  | { type: 'orderedList'; items: RichTextRun[][] }
  | { type: 'callout'; tone: CalloutTone; runs: RichTextRun[] };

export interface RichTextDocument {
  version: 1;
  blocks: RichTextBlock[];
}

export const RICH_DESCRIPTION_PREFIX = 'vakantti-rich:v1:';

const COLOR_CLASSES: Record<RichTextColor, string> = {
  orange: 'text-orange-700',
  blue: 'text-blue-700',
  green: 'text-emerald-700',
  red: 'text-red-700',
};

const COLOR_HEX: Record<RichTextColor, string> = {
  orange: '#c2410c',
  blue: '#1d4ed8',
  green: '#047857',
  red: '#b91c1c',
};

const COLOR_VALUES: Record<RichTextColor, string[]> = {
  orange: ['#c2410c', 'rgb(194,65,12)', 'rgb(194, 65, 12)'],
  blue: ['#1d4ed8', 'rgb(29,78,216)', 'rgb(29, 78, 216)'],
  green: ['#047857', 'rgb(4,120,87)', 'rgb(4, 120, 87)'],
  red: ['#b91c1c', 'rgb(185,28,28)', 'rgb(185, 28, 28)'],
};

const HIGHLIGHT_VALUES = ['#fef3c7', 'rgb(254,243,199)', 'rgb(254, 243, 199)'];
const LEGACY_INLINE_TOKEN = /(\*\*.+?\*\*|\{\{(?:orange|blue|green|red):.+?\}\})/g;

function sameRunStyle(left: RichTextRun, right: RichTextRun) {
  return left.bold === right.bold
    && left.color === right.color
    && left.highlight === right.highlight;
}

function compactRuns(runs: RichTextRun[]) {
  const compacted: RichTextRun[] = [];
  runs.forEach((run) => {
    if (!run.text) return;
    const previous = compacted.at(-1);
    if (previous && sameRunStyle(previous, run)) {
      previous.text += run.text;
      return;
    }
    compacted.push({ ...run });
  });
  return compacted;
}

function blockIsEmpty(block: RichTextBlock) {
  if (block.type === 'bulletList' || block.type === 'orderedList') {
    return block.items.every((item) => item.every((run) => !run.text.trim()));
  }
  return block.runs.every((run) => !run.text.trim());
}

function normalizeDocument(documentValue: RichTextDocument): RichTextDocument {
  const blocks = documentValue.blocks.map((block): RichTextBlock => {
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      return {
        ...block,
        items: block.items.map((item) => compactRuns(item)),
      };
    }
    return { ...block, runs: compactRuns(block.runs) };
  });

  while (blocks.length > 1 && blockIsEmpty(blocks.at(-1) as RichTextBlock)) {
    blocks.pop();
  }

  return {
    version: 1,
    blocks: blocks.length > 0 ? blocks : [{ type: 'paragraph', runs: [] }],
  };
}

function isRichTextRun(value: unknown): value is RichTextRun {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.text === 'string'
    && (candidate.bold === undefined || typeof candidate.bold === 'boolean')
    && (candidate.highlight === undefined || typeof candidate.highlight === 'boolean')
    && (
      candidate.color === undefined
      || candidate.color === 'orange'
      || candidate.color === 'blue'
      || candidate.color === 'green'
      || candidate.color === 'red'
    );
}

function isRichTextBlock(value: unknown): value is RichTextBlock {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === 'bulletList' || candidate.type === 'orderedList') {
    return Array.isArray(candidate.items)
      && candidate.items.every((item) => Array.isArray(item) && item.every(isRichTextRun));
  }
  if (candidate.type === 'paragraph') {
    return Array.isArray(candidate.runs) && candidate.runs.every(isRichTextRun);
  }
  if (candidate.type === 'heading') {
    return (candidate.level === 2 || candidate.level === 3)
      && Array.isArray(candidate.runs)
      && candidate.runs.every(isRichTextRun);
  }
  if (candidate.type === 'callout') {
    return (candidate.tone === 'info' || candidate.tone === 'warning' || candidate.tone === 'success')
      && Array.isArray(candidate.runs)
      && candidate.runs.every(isRichTextRun);
  }
  return false;
}

function isRichTextDocument(value: unknown): value is RichTextDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && Array.isArray(candidate.blocks)
    && candidate.blocks.every(isRichTextBlock);
}

function legacyInlineRuns(value: string): RichTextRun[] {
  return compactRuns(value.split(LEGACY_INLINE_TOKEN).filter(Boolean).map((part): RichTextRun => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return { text: part.slice(2, -2), bold: true };
    }

    const colorMatch = /^\{\{(orange|blue|green|red):(.+)\}\}$/.exec(part);
    if (colorMatch) {
      return {
        text: colorMatch[2],
        color: colorMatch[1] as RichTextColor,
      };
    }

    return { text: part };
  }));
}

function legacyDescriptionToDocument(value: string): RichTextDocument {
  const blocks: RichTextBlock[] = [];
  let listType: 'bulletList' | 'orderedList' | null = null;
  let listItems: RichTextRun[][] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    blocks.push({ type: listType, items: listItems });
    listType = null;
    listItems = [];
  };

  value.replace(/\r\n/g, '\n').split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      const previous = blocks.at(-1);
      if (previous && !blockIsEmpty(previous)) {
        blocks.push({ type: 'paragraph', runs: [] });
      }
      return;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || ordered) {
      const nextType = bullet ? 'bulletList' : 'orderedList';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push(legacyInlineRuns((bullet ?? ordered)?.[1] ?? ''));
      return;
    }

    flushList();

    const callout = /^>\s*\[!(HUOMIO|VAROITUS|ONNISTUI)\]\s*(.*)$/i.exec(line);
    if (callout) {
      const type = callout[1].toUpperCase();
      blocks.push({
        type: 'callout',
        tone: type === 'VAROITUS' ? 'warning' : type === 'ONNISTUI' ? 'success' : 'info',
        runs: legacyInlineRuns(callout[2]),
      });
      return;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, runs: legacyInlineRuns(line.slice(4)) });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, runs: legacyInlineRuns(line.slice(3)) });
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'heading', level: 2, runs: legacyInlineRuns(line.slice(2)) });
    } else {
      blocks.push({ type: 'paragraph', runs: legacyInlineRuns(line) });
    }
  });

  flushList();
  return normalizeDocument({ version: 1, blocks });
}

export function decodeRichDescription(value: string): RichTextDocument {
  if (value.startsWith(RICH_DESCRIPTION_PREFIX)) {
    try {
      const parsed: unknown = JSON.parse(value.slice(RICH_DESCRIPTION_PREFIX.length));
      if (isRichTextDocument(parsed)) return normalizeDocument(parsed);
    } catch {
      // Viallinen arvo näytetään alla tavallisena tekstinä tietojen menettämisen sijaan.
    }
  }
  return legacyDescriptionToDocument(value);
}

export function encodeRichDescription(documentValue: RichTextDocument) {
  return `${RICH_DESCRIPTION_PREFIX}${JSON.stringify(normalizeDocument(documentValue))}`;
}

function documentHasContent(documentValue: RichTextDocument) {
  return documentValue.blocks.some((block) => !blockIsEmpty(block));
}

function renderRunText(value: string) {
  return value.split('\n').map((part, index, parts) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && <br />}
    </span>
  ));
}

function renderRuns(runs: RichTextRun[]) {
  return runs.map((run, index) => {
    let content: ReactNode = renderRunText(run.text);
    if (run.bold) content = <strong>{content}</strong>;
    if (run.highlight) content = <mark className="rounded bg-amber-100 px-0.5 text-inherit">{content}</mark>;
    if (run.color) content = <span className={COLOR_CLASSES[run.color]}>{content}</span>;
    return <span key={`${run.text}-${index}`}>{content}</span>;
  });
}

function calloutClasses(tone: CalloutTone) {
  if (tone === 'warning') return 'border-red-200 bg-red-50 text-red-900';
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-orange-200 bg-orange-50 text-orange-950';
}

function calloutEditorClasses(tone: CalloutTone) {
  if (tone === 'warning') return 'my-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900';
  if (tone === 'success') return 'my-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900';
  return 'my-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-950';
}

export function ProjectDescription({ value, className }: { value: string; className?: string }) {
  const documentValue = decodeRichDescription(value);

  return (
    <div className={cn('space-y-3 text-sm', className)}>
      {documentValue.blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Heading = block.level === 2 ? 'h2' : 'h3';
          return (
            <Heading
              key={`heading-${index}`}
              className={block.level === 2
                ? 'pt-1 text-lg font-bold text-slate-950'
                : 'pt-1 text-sm font-bold uppercase tracking-wide text-slate-700'}
            >
              {renderRuns(block.runs)}
            </Heading>
          );
        }

        if (block.type === 'bulletList' || block.type === 'orderedList') {
          const ListTag = block.type === 'bulletList' ? 'ul' : 'ol';
          return (
            <ListTag
              key={`list-${index}`}
              className={block.type === 'bulletList'
                ? 'ml-5 list-disc space-y-1.5 text-slate-700'
                : 'ml-5 list-decimal space-y-1.5 text-slate-700'}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`item-${itemIndex}`} className="pl-1 leading-6">{renderRuns(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'callout') {
          const Icon = block.tone === 'warning'
            ? AlertTriangle
            : block.tone === 'success'
              ? CheckCircle2
              : Info;
          const label = block.tone === 'warning'
            ? 'Varoitus'
            : block.tone === 'success'
              ? 'Valmis'
              : 'Huomio';
          return (
            <div
              key={`callout-${index}`}
              className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', calloutClasses(block.tone))}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
                <p className="mt-0.5 leading-6">{renderRuns(block.runs)}</p>
              </div>
            </div>
          );
        }

        if (block.runs.length === 0) return <div key={`space-${index}`} className="h-2" aria-hidden="true" />;
        return <p key={`paragraph-${index}`} className="whitespace-pre-wrap leading-6 text-slate-700">{renderRuns(block.runs)}</p>;
      })}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function runsToEditorHtml(runs: RichTextRun[]) {
  if (runs.length === 0) return '<br>';
  return runs.map((run) => {
    let content = escapeHtml(run.text).replaceAll('\n', '<br>');
    if (run.bold) content = `<strong>${content}</strong>`;
    if (run.highlight) content = `<mark style="background-color:#fef3c7">${content}</mark>`;
    if (run.color) {
      content = `<span data-color="${run.color}" style="color:${COLOR_HEX[run.color]}">${content}</span>`;
    }
    return content;
  }).join('');
}

function documentToEditorHtml(documentValue: RichTextDocument) {
  return documentValue.blocks.map((block) => {
    if (block.type === 'heading') {
      const tag = block.level === 2 ? 'h2' : 'h3';
      return `<${tag}>${runsToEditorHtml(block.runs)}</${tag}>`;
    }
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      const tag = block.type === 'bulletList' ? 'ul' : 'ol';
      return `<${tag}>${block.items.map((item) => `<li>${runsToEditorHtml(item)}</li>`).join('')}</${tag}>`;
    }
    if (block.type === 'callout') {
      return `<blockquote data-callout="${block.tone}" class="${calloutEditorClasses(block.tone)}">${runsToEditorHtml(block.runs)}</blockquote>`;
    }
    return `<p>${runsToEditorHtml(block.runs)}</p>`;
  }).join('');
}

function colorFromCssValue(value: string | null | undefined): RichTextColor | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  return (Object.keys(COLOR_VALUES) as RichTextColor[])
    .find((color) => COLOR_VALUES[color].includes(normalized));
}

interface RunStyle {
  bold?: boolean;
  color?: RichTextColor;
  highlight?: boolean;
}

function styleForElement(element: HTMLElement, inherited: RunStyle): RunStyle {
  const tag = element.tagName.toUpperCase();
  const fontWeight = Number.parseInt(element.style.fontWeight, 10);
  const color = element.dataset.color as RichTextColor | undefined
    ?? colorFromCssValue(element.style.color)
    ?? colorFromCssValue(tag === 'FONT' ? element.getAttribute('color') : undefined)
    ?? inherited.color;
  const background = element.style.backgroundColor.toLowerCase();

  return {
    bold: inherited.bold
      || tag === 'STRONG'
      || tag === 'B'
      || element.style.fontWeight === 'bold'
      || (Number.isFinite(fontWeight) && fontWeight >= 600),
    color,
    highlight: inherited.highlight
      || tag === 'MARK'
      || HIGHLIGHT_VALUES.includes(background),
  };
}

function runsFromNodes(nodes: NodeListOf<ChildNode> | ChildNode[], inherited: RunStyle = {}) {
  const runs: RichTextRun[] = [];

  Array.from(nodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent ?? '', ...inherited });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName.toUpperCase() === 'BR') {
      runs.push({ text: '\n', ...inherited });
      return;
    }
    runs.push(...runsFromNodes(node.childNodes, styleForElement(node, inherited)));
  });

  return compactRuns(runs);
}

function documentFromEditor(root: HTMLElement): RichTextDocument {
  const blocks: RichTextBlock[] = [];

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) blocks.push({ type: 'paragraph', runs: [{ text }] });
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    const tag = node.tagName.toUpperCase();
    if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
      blocks.push({
        type: 'heading',
        level: tag === 'H3' ? 3 : 2,
        runs: runsFromNodes(node.childNodes),
      });
      return;
    }

    if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(node.children)
        .filter((child) => child.tagName.toUpperCase() === 'LI')
        .map((child) => runsFromNodes(child.childNodes));
      blocks.push({ type: tag === 'UL' ? 'bulletList' : 'orderedList', items });
      return;
    }

    if (tag === 'BLOCKQUOTE') {
      const rawTone = node.dataset.callout;
      const tone: CalloutTone = rawTone === 'warning' || rawTone === 'success' ? rawTone : 'info';
      blocks.push({ type: 'callout', tone, runs: runsFromNodes(node.childNodes) });
      return;
    }

    blocks.push({ type: 'paragraph', runs: runsFromNodes(node.childNodes) });
  });

  return normalizeDocument({ version: 1, blocks });
}

interface ProjectDescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export function ProjectDescriptionEditor({ id, value, onChange }: ProjectDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValueRef = useRef<string | null>(null);
  const [hasContent, setHasContent] = useState(() => documentHasContent(decodeRichDescription(value)));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEmittedValueRef.current) return;
    const documentValue = decodeRichDescription(value);
    editor.innerHTML = documentToEditorHtml(documentValue);
    setHasContent(documentHasContent(documentValue));
  }, [value]);

  const syncFromEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const documentValue = documentFromEditor(editor);
    const encoded = encodeRichDescription(documentValue);
    lastEmittedValueRef.current = encoded;
    setHasContent(documentHasContent(documentValue));
    onChange(encoded);
  }, [onChange]);

  const runCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, commandValue);
    syncFromEditor();
  };

  const insertCallout = (tone: 'info' | 'warning') => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('formatBlock', false, 'blockquote');

    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
    const quote = anchorElement?.closest('blockquote');
    if (quote instanceof HTMLElement && editor.contains(quote)) {
      quote.dataset.callout = tone;
      quote.className = calloutEditorClasses(tone);
    }
    syncFromEditor();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const plainText = event.clipboardData.getData('text/plain');
    document.execCommand(
      'insertHTML',
      false,
      escapeHtml(plainText).replace(/\r?\n/g, '<br>'),
    );
    syncFromEditor();
  };

  const preserveSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto border-b border-slate-200 bg-slate-50">
        <div className="flex w-max min-w-full items-center gap-1.5 p-2">
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => runCommand('formatBlock', 'p')} className="gap-1.5"><Pilcrow size={15} /> Teksti</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => runCommand('formatBlock', 'h2')} className="gap-1.5"><Heading2 size={15} /> Otsikko</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => runCommand('bold')} className="gap-1.5"><Bold size={15} /> Lihavoi</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => runCommand('insertUnorderedList')} className="gap-1.5"><List size={15} /> Luettelo</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => runCommand('insertOrderedList')} className="gap-1.5"><ListOrdered size={15} /> Numerointi</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => insertCallout('info')} className="gap-1.5"><Info size={15} /> Huomio</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => insertCallout('warning')} className="gap-1.5"><AlertTriangle size={15} /> Varoitus</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={preserveSelection} onClick={() => runCommand('hiliteColor', '#fef3c7')} className="gap-1.5"><Highlighter size={15} /> Korosta</Button>
          {(Object.keys(COLOR_HEX) as RichTextColor[]).map((color) => (
            <Button
              key={color}
              type="button"
              variant="outline"
              size="icon"
              onMouseDown={preserveSelection}
              onClick={() => runCommand('foreColor', COLOR_HEX[color])}
              aria-label={`Vaihda tekstin väriksi ${color}`}
              title={`Tekstin väri: ${color}`}
              className="h-9 w-9"
            >
              <span className={cn('h-3.5 w-3.5 rounded-full', {
                'bg-orange-600': color === 'orange',
                'bg-blue-700': color === 'blue',
                'bg-emerald-700': color === 'green',
                'bg-red-700': color === 'red',
              })} />
            </Button>
          ))}
          <Button type="button" variant="outline" size="icon" onMouseDown={preserveSelection} onClick={() => runCommand('removeFormat')} aria-label="Poista muotoilu" title="Poista muotoilu"><Eraser size={15} /></Button>
          <Button type="button" variant="outline" size="icon" onMouseDown={preserveSelection} onClick={() => runCommand('undo')} aria-label="Kumoa" title="Kumoa"><Undo2 size={15} /></Button>
          <Button type="button" variant="outline" size="icon" onMouseDown={preserveSelection} onClick={() => runCommand('redo')} aria-label="Tee uudelleen" title="Tee uudelleen"><Redo2 size={15} /></Button>
        </div>
      </div>

      <div className="relative">
        {!hasContent && (
          <p className="pointer-events-none absolute left-4 top-3 z-10 max-w-[calc(100%-2rem)] text-sm leading-6 text-slate-400">
            Kirjoita projektin aikataulu, vastuut ja tärkeät huomiot. Muotoilu näkyy heti kirjoitusalueella.
          </p>
        )}
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-label="Projektin kuvaus"
          contentEditable
          suppressContentEditableWarning
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          onPaste={handlePaste}
          className={cn(
            'min-h-[280px] w-full overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-800 outline-none',
            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500',
            '[&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-950',
            '[&_h3]:my-3 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide',
            '[&_p]:my-2 [&_ul]:my-3 [&_ul]:ml-6 [&_ul]:list-disc',
            '[&_ol]:my-3 [&_ol]:ml-6 [&_ol]:list-decimal [&_li]:my-1',
            '[&_blockquote]:my-3 [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:px-4 [&_blockquote]:py-3',
            '[&_mark]:rounded [&_mark]:bg-amber-100 [&_mark]:px-0.5',
          )}
        />
      </div>
      <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-xs leading-5 text-slate-500">
        Valitse teksti ja käytä työkaluriviä. Vanhojen projektien kuvaukset avautuvat automaattisesti muotoiltavina.
      </div>
    </div>
  );
}
