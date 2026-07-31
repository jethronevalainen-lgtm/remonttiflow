import { formatSiteDiaryDate } from '@/lib/siteDiaryRules';
import { createSiteDiaryAttachmentUrl, type SiteDiaryBundle, type WorkItemState } from '@/lib/supabase/siteDiaries';
import { ATTACHMENT_LABELS, EVENT_LABELS, WORKFORCE_LABELS, WORK_ITEM_LABELS } from './labels';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function printDiary(bundle: SiteDiaryBundle): Promise<void> {
  const imageAttachments = bundle.attachments.filter((attachment) => attachment.mimeType.startsWith('image/'));
  const imageUrls = await Promise.all(imageAttachments.map(async (attachment) => ({
    attachment,
    url: await createSiteDiaryAttachmentUrl(attachment.storagePath),
  })));
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) throw new Error('Tulostusikkunaa ei voitu avata. Salli ponnahdusikkunat ja yritä uudelleen.');

  const groupedWork = (['started', 'ongoing', 'completed'] as WorkItemState[])
    .map((state) => {
      const items = bundle.workItems.filter((item) => item.phaseState === state);
      return `<section><h2>${WORK_ITEM_LABELS[state]} työvaiheet</h2>${items.length
        ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.title)}</strong>${item.location ? ` – ${escapeHtml(item.location)}` : ''}${item.responsibleParty ? ` (${escapeHtml(item.responsibleParty)})` : ''}</li>`).join('')}</ul>`
        : '<p>–</p>'}</section>`;
    }).join('');

  const html = `<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>Työmaapäiväkirja ${escapeHtml(bundle.diary.date)}</title><style>
    @page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#111;font-size:11pt;line-height:1.4}h1{font-size:22pt;margin:0}h2{font-size:14pt;background:#edf2f7;padding:8px;margin:22px 0 8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d5dbe3;padding:6px;text-align:left;vertical-align:top}.meta{margin-top:12px}.muted{color:#53606f}.images{display:grid;grid-template-columns:1fr 1fr;gap:10px}.images figure{margin:0;break-inside:avoid}.images img{width:100%;height:230px;object-fit:cover}.signature{margin-top:34px;border-top:1px solid #333;padding-top:6px}.checksum{font-family:monospace;font-size:8pt;word-break:break-all}@media print{button{display:none}}
  </style></head><body>
    <header><h1>Työmaapäiväkirja YSE</h1><p class="muted">${escapeHtml(formatSiteDiaryDate(bundle.diary.date))} · versio ${bundle.diary.version} · ${escapeHtml(bundle.diary.status)}</p></header>
    <table class="meta"><tr><th>Projekti</th><td>${escapeHtml(bundle.diary.project)}</td><th>Osoite</th><td>${escapeHtml(bundle.diary.siteAddress || '–')}</td></tr><tr><th>Laatija</th><td>${escapeHtml(bundle.diary.author || '–')}</td><th>Sopimus / numero</th><td>${escapeHtml(bundle.diary.contractNumber || '–')}</td></tr></table>
    <section><h2>Sää</h2><table><thead><tr><th>Klo</th><th>Lämpötila</th><th>Säätila</th><th>Tuuli</th><th>Vaikutus työhön</th></tr></thead><tbody>${bundle.weather.map((item) => `<tr><td>${escapeHtml(item.observationTime.slice(0, 5))}</td><td>${item.temperatureC ?? '–'} °C</td><td>${escapeHtml(item.weatherCondition || '–')}</td><td>${item.windSpeedMs ?? '–'} m/s${item.windGustMs != null ? ` (${item.windGustMs})` : ''}</td><td>${escapeHtml(item.workImpact || '–')}</td></tr>`).join('')}</tbody></table></section>
    <section><h2>Työvoima</h2><table><thead><tr><th>Ryhmä</th><th>Yritys / ammatti</th><th>Henkilöä</th><th>Lisätieto</th></tr></thead><tbody>${bundle.workforce.map((item) => `<tr><td>${escapeHtml(WORKFORCE_LABELS[item.category])}</td><td>${escapeHtml([item.companyName, item.trade].filter(Boolean).join(' / ') || '–')}</td><td>${item.headcount}</td><td>${escapeHtml(item.notes || '–')}</td></tr>`).join('')}</tbody></table></section>
    ${groupedWork}
    <section><h2>Päivän tapahtumat, katselmukset ja YSE-kirjaukset</h2>${bundle.events.length ? `<table><thead><tr><th>Tyyppi</th><th>Tapahtuma</th><th>Vastuu / määräaika</th><th>Tila</th></tr></thead><tbody>${bundle.events.map((item) => `<tr><td>${escapeHtml(EVENT_LABELS[item.eventType])}</td><td><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.description || '')}</td><td>${escapeHtml(item.responsibleParty || '–')}<br>${item.dueAt ? escapeHtml(new Date(item.dueAt).toLocaleString('fi-FI')) : '–'}</td><td>${escapeHtml(item.status)}</td></tr>`).join('')}</tbody></table>` : '<p>–</p>'}</section>
    <section><h2>Yhteenveto</h2><p>${escapeHtml(bundle.diary.summary || '–')}</p></section>
    ${imageUrls.length ? `<section><h2>Kuvat ja liitteet</h2><div class="images">${imageUrls.map(({ attachment, url }) => `<figure><img src="${escapeHtml(url)}" alt=""><figcaption>${escapeHtml(ATTACHMENT_LABELS[attachment.category])}: ${escapeHtml(attachment.caption || attachment.fileName)}</figcaption></figure>`).join('')}</div></section>` : ''}
    <section><h2>Allekirjoitukset</h2>${bundle.signatures.length ? bundle.signatures.map((signature) => `<div class="signature"><strong>${escapeHtml(signature.signerName)}</strong><br>${escapeHtml(signature.signerTitle || signature.signatureRole)}<br><span class="muted">${escapeHtml(new Date(signature.signedAt).toLocaleString('fi-FI'))}</span></div>`).join('') : '<p>Ei allekirjoituksia.</p>'}</section>
    ${bundle.diary.contentChecksum ? `<p class="checksum">Varmennustunnus: ${escapeHtml(bundle.diary.contentChecksum)}</p>` : ''}
    <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script>
  </body></html>`;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
