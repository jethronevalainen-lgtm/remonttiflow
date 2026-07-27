from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root = Path(__file__).resolve().parents[1]
detail_path = root / "src/pages/inspections/InspectionDetailView.tsx"
section_path = root / "src/pages/inspections/InspectionSectionCard.tsx"
migration_path = root / "supabase/migrations/20260727121500_guided_kitchen_self_handover.sql"

detail = detail_path.read_text(encoding="utf-8")
section = section_path.read_text(encoding="utf-8")

detail = replace_once(
    detail,
    "import { useEffect, useMemo, useState, type ChangeEvent } from 'react';",
    "import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';",
    "add useRef import",
)
detail = replace_once(
    detail,
    "  ChevronLeft,\n  ClipboardCheck,",
    "  ChevronLeft,\n  ChevronRight,\n  ClipboardCheck,",
    "add ChevronRight import",
)
detail = replace_once(
    detail,
    "  const [voidOpen, setVoidOpen] = useState(false);",
    "  const [voidOpen, setVoidOpen] = useState(false);\n  const [activeStage, setActiveStage] = useState(0);\n  const initializedInspectionRef = useRef<string | null>(null);",
    "add guided stage state",
)

sections_block = """  const sections = useMemo(() => {
    if (!detail) return [];
    const grouped = detail.results.reduce<Record<string, InspectionResultDetail[]>>((result, item) => {
      (result[item.sectionId] ??= []).push(item);
      return result;
    }, {});
    return Object.values(grouped).sort((a, b) => a[0].sectionOrder - b[0].sectionOrder);
  }, [detail]);
"""
sections_replacement = sections_block + """
  useEffect(() => {
    if (!detail || sections.length === 0 || initializedInspectionRef.current === inspectionId) return;
    const storageKey = `inspection-stage:${inspectionId}`;
    const savedStage = Number(window.sessionStorage.getItem(storageKey));
    const firstIncomplete = sections.findIndex((results) =>
      results.some((result) => result.status === 'Tarkastamatta'));
    const fallbackStage = firstIncomplete >= 0 ? firstIncomplete : sections.length;
    const maxStage = sections.length + 2;
    setActiveStage(Number.isInteger(savedStage) && savedStage >= 0 && savedStage <= maxStage
      ? savedStage
      : fallbackStage);
    initializedInspectionRef.current = inspectionId;
  }, [detail, inspectionId, sections]);

  useEffect(() => {
    if (initializedInspectionRef.current !== inspectionId) return;
    window.sessionStorage.setItem(`inspection-stage:${inspectionId}`, String(activeStage));
  }, [activeStage, inspectionId]);
"""
detail = replace_once(detail, sections_block, sections_replacement, "add stage initialization effects")

detail = replace_once(
    detail,
    "  const openSignature = () => { setOperationError(null); setSignatureOpen(true); };",
    "  const openSignature = () => { setOperationError(null); setSignatureOpen(true); };\n  const goToStage = (stage: number) => {\n    setActiveStage(stage);\n    window.requestAnimationFrame(() => scrollTo('inspection-guided-flow'));\n  };",
    "add stage navigation helper",
)

stage_anchor = """  const signatureReady = canManage && !locked && preSignatureBlockers.length === 0;
  const canApprove = canManage && !locked && approvalBlockers.length === 0;
  const workflowActiveStep = !inspectionComplete ? 1 : blockingFindings.length > 0 ? 2 : !hasHandoverPhoto ? 3 : 4;
"""
stage_logic = """  const signatureReady = canManage && !locked && preSignatureBlockers.length === 0;
  const canApprove = canManage && !locked && approvalBlockers.length === 0;
  const workflowActiveStep = !inspectionComplete ? 1 : blockingFindings.length > 0 ? 2 : !hasHandoverPhoto ? 3 : 4;
  const sectionIsComplete = (results: InspectionResultDetail[]) =>
    results.length > 0 && results.every((result) => result.status !== 'Tarkastamatta');
  const sectionStageCount = sections.length;
  const findingsStageIndex = sectionStageCount;
  const attachmentsStageIndex = sectionStageCount + 1;
  const signatureStageIndex = sectionStageCount + 2;
  const firstIncompleteSectionIndex = sections.findIndex((results) => !sectionIsComplete(results));
  const guidedStages = [
    ...sections.map((results, index) => ({
      title: results[0]?.sectionTitle || `Tarkastusvaihe ${index + 1}`,
      description: `${results.filter((result) => result.status !== 'Tarkastamatta').length}/${results.length} kohtaa käsitelty`,
      complete: sectionIsComplete(results),
      available: index === 0 || sections.slice(0, index).every(sectionIsComplete),
    })),
    {
      title: 'Puutteet',
      description: blockingFindings.length > 0 ? `${blockingFindings.length} estävää puutetta avoinna` : 'Tarkista ja sulje havaitut puutteet',
      complete: findingsReady,
      available: inspectionComplete,
    },
    {
      title: 'Luovutuskuvat',
      description: hasHandoverPhoto ? 'Valmis kohde dokumentoitu' : 'Ota vähintään yksi kuva valmiista kohteesta',
      complete: hasHandoverPhoto,
      available: findingsReady,
    },
    {
      title: 'Allekirjoitus',
      description: hasHandwrittenSignature ? 'Allekirjoitus tallennettu' : 'Vahvista tarkastus allekirjoituksella',
      complete: hasHandwrittenSignature,
      available: findingsReady && hasHandoverPhoto,
    },
  ];
  const activeGuidedStage = guidedStages[activeStage] ?? guidedStages[0];
  const canAdvanceGuidedStage = activeStage < sectionStageCount
    ? sectionIsComplete(sections[activeStage] ?? [])
    : activeStage === findingsStageIndex
      ? blockingFindings.length === 0
      : activeStage === attachmentsStageIndex
        ? hasHandoverPhoto
        : false;
  const nextGuidedStageLabel = activeStage + 1 < sectionStageCount
    ? `Jatka: ${sections[activeStage + 1]?.[0]?.sectionTitle || 'seuraava vaihe'}`
    : activeStage < sectionStageCount
      ? 'Jatka puutteisiin'
      : activeStage === findingsStageIndex
        ? 'Jatka luovutuskuviin'
        : 'Jatka allekirjoitukseen';
"""
detail = replace_once(detail, stage_anchor, stage_logic, "add guided stage calculations")

next_action_pattern = re.compile(
    r"  const nextAction = !inspectionComplete\n.*?          : \{ title: 'Hyväksy tarkastus', description: 'Kaikki luovutuksen vaatimukset täyttyvät\.', action: \(\) => setApprovalOpen\(true\), icon: ShieldCheck \};",
    re.S,
)
next_action_replacement = """  const nextAction = !inspectionComplete
    ? {
        title: 'Jatka tarkastusta',
        description: `${completedResults}/${detail.results.length} tarkastuskohtaa käsitelty.`,
        action: () => goToStage(firstIncompleteSectionIndex >= 0 ? firstIncompleteSectionIndex : 0),
        icon: ClipboardCheck,
      }
    : blockingFindings.length > 0
      ? {
          title: 'Käsittele avoimet puutteet',
          description: `${blockingFindings.length} puutetta estää luovutuksen.`,
          action: () => goToStage(findingsStageIndex),
          icon: AlertTriangle,
        }
      : !hasHandoverPhoto
        ? {
            title: 'Ota luovutuskuva',
            description: 'Dokumentoi valmis kohde ennen allekirjoitusta.',
            action: () => goToStage(attachmentsStageIndex),
            icon: Camera,
          }
        : !hasHandwrittenSignature
          ? {
              title: 'Allekirjoita tarkastus',
              description: 'Tarkastustyö on valmis. Tee allekirjoitus ennen hyväksyntää.',
              action: () => goToStage(signatureStageIndex),
              icon: Signature,
            }
          : { title: 'Hyväksy tarkastus', description: 'Kaikki luovutuksen vaatimukset täyttyvät.', action: () => setApprovalOpen(true), icon: ShieldCheck };"""
detail, count = next_action_pattern.subn(next_action_replacement, detail, count=1)
if count != 1:
    raise RuntimeError(f"replace nextAction: expected one match, found {count}")

guided_card = """
      {canManage && !locked && guidedStages.length > 0 && (
        <Card id="inspection-guided-flow" className="scroll-mt-6 border-primary/20 print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2"><ClipboardCheck size={19} />Ohjattu itselleluovutus</CardTitle>
            <p className="text-sm text-text-secondary">Etene vaihe kerrallaan. Seuraava vaihe avautuu, kun nykyinen vaihe on käsitelty.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {guidedStages.map((stage, index) => (
                  <button
                    key={`${index}-${stage.title}`}
                    type="button"
                    disabled={!stage.available && index !== activeStage}
                    onClick={() => goToStage(index)}
                    className={cn(
                      'flex w-52 items-start gap-3 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
                      index === activeStage ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-white hover:border-primary/30',
                    )}
                  >
                    <span className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      stage.complete ? 'bg-emerald-600 text-white' : index === activeStage ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-700',
                    )}>
                      {stage.complete ? <CheckCircle2 size={15} /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text-primary">{stage.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-text-secondary">{stage.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Vaihe {activeStage + 1}/{guidedStages.length}</p>
                  <p className="mt-1 font-semibold text-text-primary">{activeGuidedStage?.title}</p>
                  <p className="mt-1 text-sm text-text-secondary">{activeGuidedStage?.description}</p>
                </div>
                {!canAdvanceGuidedStage && activeStage < signatureStageIndex && (
                  <Badge className="mt-2 w-fit border-0 bg-amber-50 text-amber-800 sm:mt-0">Käsittele vaihe loppuun</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" disabled={activeStage === 0 || Boolean(savingKey)} onClick={() => goToStage(Math.max(0, activeStage - 1))}>
                <ChevronLeft size={16} className="mr-2" />Edellinen vaihe
              </Button>
              {activeStage < signatureStageIndex && (
                <Button disabled={!canAdvanceGuidedStage || Boolean(savingKey)} onClick={() => goToStage(Math.min(signatureStageIndex, activeStage + 1))}>
                  {nextGuidedStageLabel}<ChevronRight size={16} className="ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
"""
sections_render = """      <div id="inspection-sections" className="scroll-mt-6 space-y-5">
        {sections.map((results) => <InspectionSectionCard key={results[0].sectionId} results={results} attachments={detail.attachments} canManage={canManage} locked={locked} savingKey={savingKey} comments={comments} onCommentChange={(id, value) => setComments((previous) => ({ ...previous, [id]: value }))} onStatus={saveStatus} onSaveComment={saveComment} onMarkSection={markSectionOkay} onUpload={uploadResult} onOpenAttachment={openAttachment} />)}
      </div>
"""
sections_render_replacement = guided_card + """
      <div id="inspection-sections" className={cn('scroll-mt-6 space-y-5', canManage && !locked && activeStage >= sectionStageCount && 'hidden', 'print:block')}>
        {sections.map((results, index) => (
          <div key={results[0].sectionId} className={cn(canManage && !locked && activeStage !== index && 'hidden', 'print:block')}>
            <InspectionSectionCard results={results} attachments={detail.attachments} canManage={canManage} locked={locked} savingKey={savingKey} comments={comments} onCommentChange={(id, value) => setComments((previous) => ({ ...previous, [id]: value }))} onStatus={saveStatus} onSaveComment={saveComment} onMarkSection={markSectionOkay} onUpload={uploadResult} onOpenAttachment={openAttachment} />
          </div>
        ))}
      </div>
"""
detail = replace_once(detail, sections_render, sections_render_replacement, "replace section list with guided stage rendering")

detail = replace_once(
    detail,
    '<Card id="inspection-findings" className="scroll-mt-6 print:shadow-none">',
    '<Card id="inspection-findings" className={cn(\'scroll-mt-6 print:shadow-none\', canManage && !locked && activeStage !== findingsStageIndex && \'hidden\', \'print:block\')}>',
    "gate findings stage",
)
detail = replace_once(
    detail,
    '<Card id="inspection-attachments" className="scroll-mt-6 print:shadow-none">',
    '<Card id="inspection-attachments" className={cn(\'scroll-mt-6 print:shadow-none\', canManage && !locked && activeStage !== attachmentsStageIndex && \'hidden\', \'print:block\')}>',
    "gate attachments stage",
)
detail = replace_once(
    detail,
    '<Card id="inspection-signatures" className="scroll-mt-6 overflow-hidden border-slate-200 print:shadow-none">',
    '<Card id="inspection-signatures" className={cn(\'scroll-mt-6 overflow-hidden border-slate-200 print:shadow-none\', canManage && !locked && activeStage !== signatureStageIndex && \'hidden\', \'print:block\')}>',
    "gate signature stage",
)
detail = replace_once(
    detail,
    '<label className={uploadLabelClasses}><Camera size={16} className="mr-2" />Lisää luovutuskuva<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadInspectionFile(event, \'Luovutuskuva\')} /></label>',
    '<label className={uploadLabelClasses}><Camera size={16} className="mr-2" />Ota luovutuskuva<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadInspectionFile(event, \'Luovutuskuva\')} /></label>',
    "rename direct camera action",
)
detail = replace_once(
    detail,
    '<label className={uploadLabelClasses}><ImageIcon size={16} className="mr-2" />Lisää yleiskuva<input className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadInspectionFile(event, \'Yleiskuva\')} /></label>',
    '<label className={uploadLabelClasses}><ImageIcon size={16} className="mr-2" />Valitse kuva<input className="sr-only" type="file" accept="image/*" onChange={(event) => void uploadInspectionFile(event, \'Yleiskuva\')} /></label>',
    "rename gallery action",
)

section = replace_once(
    section,
    "import { Camera, CheckCircle2, Image as ImageIcon, Loader2, MessageSquarePlus, Save } from 'lucide-react';",
    "import { Camera, CheckCircle2, FileUp, Image as ImageIcon, Loader2, MessageSquarePlus, Save } from 'lucide-react';",
    "add FileUp icon",
)
old_upload = """                      <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent">
                        <Camera size={15} className="mr-2" />Lisää kuva
                        <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => void onUpload(event, result)} />
                      </Label>
"""
new_upload = """                      <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent">
                        <Camera size={15} className="mr-2" />Ota kuva
                        <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void onUpload(event, result)} />
                      </Label>
                      <Label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent">
                        <FileUp size={15} className="mr-2" />Valitse kuva tai PDF
                        <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => void onUpload(event, result)} />
                      </Label>
"""
section = replace_once(section, old_upload, new_upload, "split camera and gallery actions")

migration = r"""do $$
declare
  template_uuid uuid;
  version_uuid uuid;
  section_uuid uuid;
  next_version integer;
  section_value jsonb;
  item_value jsonb;
  section_order integer := 0;
  item_order integer;
  change_marker constant text := 'Ohjattu vaiheistus ja tarkennettu keittiön itselleluovutus';
  sections_payload jsonb := $payload$
  [
    {
      "title": "Kalusteiden asennus ja linjaus",
      "description": "Aloita kalusterungoista ja etene näkyviin osiin. Tarkista kokonaisuus sekä silmämääräisesti että kokeilemalla liikkuvat osat.",
      "items": [
        {"title":"Kalusterungot ovat suorassa, samassa linjassa ja tukevasti kiinnitetty","guidance":"Tarkista ylä- ja alakaappien linjat, kiinnitykset sekä seinärakenteeseen sopivat kiinnikkeet."},
        {"title":"Ovet ja etusarjat ovat ehjät ja keskenään samassa linjassa","guidance":"Katso kokonaisuus edestä ja sivusta. Pintojen, reunojen ja kulmien pitää olla ehjiä."},
        {"title":"Ovien käyntivälit ja saranasäädöt ovat kunnossa","guidance":"Avaa ja sulje jokainen ovi. Ovien ei pidä hangata, osua toisiinsa tai jäädä vinoon."},
        {"title":"Laatikot, korit, mekanismit ja hidastimet toimivat","guidance":"Vedä jokainen laatikko ja kori kokonaan auki ja sulje se. Tarkista myös ulosvedettävät mekanismit."},
        {"title":"Vetimet ovat suorassa ja tukevasti kiinnitetty","guidance":"Tarkista vetimien linja sekä kiinnitys käsin kokeilemalla."},
        {"title":"Sokkelit, päätylevyt, peitelevyt ja täytteet ovat siistit","guidance":"Liittymien, leikkausten ja kiinnitysten pitää olla viimeisteltyjä ilman näkyviä rakoja tai vaurioita."},
        {"title":"Kaappien sisäpinnat, hyllyt ja laatikot ovat puhtaat ja ehjät","guidance":"Poista asennusjätteet, pöly, merkinnät ja suojamateriaalit."}
      ]
    },
    {
      "title": "Työtasot, välitila ja liittymät",
      "description": "Tarkista tasot ja välitila yhtenä kokonaisuutena. Kiinnitä erityinen huomio aukotuksiin, liitoksiin ja kosteudelle alttiisiin kohtiin.",
      "items": [
        {"title":"Työtaso on ehjä, suorassa ja tukevasti kiinnitetty","guidance":"Tarkista pinta, etureuna, kannatus ja mahdollinen taipuma koko tasopituudelta."},
        {"title":"Työtason liitokset ovat tasaiset, tiiviit ja siistit","guidance":"Liitoksissa ei saa olla porrastusta, avointa saumaa tai liimajäämiä."},
        {"title":"Reunat, päädyt ja aukotukset ovat viimeistelty","guidance":"Tarkista sahausjäljet, reunalistat sekä altaan ja kodinkoneiden aukotukset."},
        {"title":"Allasaukko, liesiaukko ja muut läpiviennit ovat tiivistetty","guidance":"Tarkista kosteudelle alttiit leikkauspinnat ja läpivientien tiivistys."},
        {"title":"Työtason seinäliittymät ja silikonisaumat ovat yhtenäiset","guidance":"Sauman pitää olla tiivis, siisti ja katkeamaton koko liittymän matkalla."},
        {"title":"Välitilan materiaali, saumat ja rajaukset ovat ehjät ja siistit","guidance":"Tarkista levyt, laatat, saumat sekä rajaukset kalusteisiin, pistorasioihin ja nurkkiin."}
      ]
    },
    {
      "title": "Vesi, viemäri ja vuotosuojaus",
      "description": "Tee toimintakoe vedellä. Tarkista liitokset kuivin käsin ja valolla sekä ennen juoksutusta että sen jälkeen.",
      "items": [
        {"title":"Allas on ehjä ja tukevasti kiinnitetty","guidance":"Tarkista altaan kiinnitys, reunat ja liittymä työtasoon."},
        {"title":"Hana on tukevasti kiinnitetty ja toimii kaikilla käyttöasennoilla","guidance":"Kokeile kylmä ja lämmin vesi, vivun liike sekä mahdollinen ulosvedettävä juoksuputki."},
        {"title":"Veden juoksutus ja viemäröinti on toimintakokeiltu","guidance":"Juoksuta vettä riittävästi ja varmista, että allas tyhjenee normaalisti ilman pulputusta tai hajuhaittaa."},
        {"title":"Vesi- ja viemäriliitoksissa ei ole vuotoja","guidance":"Tarkista sulut, liitosmutterit, letkut, hajulukko ja poistoputki heti toimintakokeen jälkeen."},
        {"title":"Hajulukko on oikein asennettu, tuettu ja puhdistettavissa","guidance":"Varmista, ettei putkisto jää jännitykseen ja että huoltaminen on mahdollista ilman rakenteiden purkua."},
        {"title":"Vuotokaukalot ja sovittu vuotosuojaus ovat paikoillaan","guidance":"Tarkista allaskaappi, astianpesukone sekä muut vesiliitäntäiset laitteet sovitun laajuuden mukaisesti."},
        {"title":"Läpiviennit, vedenohjaus ja allaskaapin suojaus ovat kunnossa","guidance":"Mahdollisen vuodon pitää ohjautua näkyville eikä rakenteisiin."}
      ]
    },
    {
      "title": "Kodinkoneet ja toimintakokeet",
      "description": "Tarkista jokainen toimitukseen kuuluva laite erikseen. Pelkkä paikalleen asennus ei riitä, vaan perustoiminto pitää kokeilla.",
      "items": [
        {"title":"Kodinkoneet ovat oikeilla paikoillaan, suorassa ja siististi asennettu","guidance":"Tarkista korkeus, linja kalusteoviin ja tasoihin sekä näkyvät kolhut tai naarmut."},
        {"title":"Laitteiden ovet, luukut ja vetolaatikot avautuvat esteettä","guidance":"Avaa jokainen laite kokonaan ja varmista, ettei se osu kalusteisiin, vetimiin tai seinään."},
        {"title":"Kalusteisiin kuuluvat laitekiinnitykset ja kallistumisen estot ovat tehty","guidance":"Tarkista erityisesti integroidut laitteet ja valmistajan edellyttämät kiinnitykset."},
        {"title":"Näkyvät sähkö-, vesi-, viemäri- ja ilmanvaihtoliitännät ovat asianmukaiset","guidance":"Johdot ja letkut eivät saa olla puristuksissa, taittuneina tai hankautua teräviin reunoihin."},
        {"title":"Jokaisen laitteen perustoiminto on kokeiltu","guidance":"Käynnistä laite soveltuvalla lyhyellä testillä ja varmista, ettei näkyviä virheitä tai poikkeavia ääniä ilmene."},
        {"title":"Suojamuovit, kuljetustuet ja pakkausmateriaalit on poistettu","guidance":"Tarkista myös laitteiden sisäosat ja vaikeasti näkyvät reunat."},
        {"title":"Käyttöohjeet, tuotetiedot ja sovitut dokumentit ovat tallessa","guidance":"Varmista, että luovutettavat ohjeet ja mahdolliset takuutiedot voidaan yksilöidä kohteeseen."}
      ]
    },
    {
      "title": "Sähkö, valaistus ja ilmanvaihto",
      "description": "Tarkista näkyvät asennukset ja käyttötoiminnot. Varsinaiset sähkömittaukset kuuluvat pätevälle sähköurakoitsijalle.",
      "items": [
        {"title":"Pistorasiat, kytkimet, peitelevyt ja suojakannet ovat ehjät ja paikoillaan","guidance":"Tarkista linjaus, kiinnitys ja näkyvät vauriot."},
        {"title":"Kalustevalot ja muut toimitukseen kuuluvat valaisimet toimivat","guidance":"Kokeile kaikki kytkennät, himmennykset ja ovikytkimet, jos niitä on."},
        {"title":"Näkyvät johdotukset, muuntajat ja läpiviennit ovat siistit ja suojatut","guidance":"Johdot eivät saa roikkua, puristua tai jäädä kuumien pintojen läheisyyteen."},
        {"title":"Liesituuletin tai -kupu toimii sovitun toteutuksen mukaisesti","guidance":"Kokeile puhallus, valot ja säätimet. Tarkista myös näkyvät kanava- ja suodatinosat."},
        {"title":"Ilmanvaihtoventtiilit ja korvausilmareitit ovat puhtaat ja esteettömät","guidance":"Varmista, ettei kaluste tai asennus peitä suunniteltua ilmankulkua."},
        {"title":"Työn edellyttämät sähkö- ja käyttöönottodokumentit on vastaanotettu","guidance":"Merkitse ei koske kohdetta, jos työ ei ole sisältänyt dokumentointia edellyttäviä sähkömuutoksia."}
      ]
    },
    {
      "title": "Viimeistely ja luovutusvalmius",
      "description": "Tee lopuksi rauhallinen kokonaiskierros ovelta alkaen. Tarkista näkyvät pinnat, puhtaus ja se, että tila on aidosti käyttövalmis.",
      "items": [
        {"title":"Seinä-, katto- ja lattiapinnat ovat ehjät ja viimeistellyt","guidance":"Tarkista paikkaukset, maalaukset, rajaukset ja asennustöiden mahdollisesti aiheuttamat vauriot."},
        {"title":"Listat, silikonit, saumat ja muut liittymät ovat siistit","guidance":"Kierrä kalusteiden, seinien, lattian ja tasojen liittymät järjestelmällisesti."},
        {"title":"Suojaukset, työkalut, jätteet ja ylimääräiset materiaalit on poistettu","guidance":"Tilan pitää olla turvallinen ja välittömästi käytettävissä."},
        {"title":"Kaikki näkyvät pinnat, kaapit, laatikot ja laitteet ovat puhtaat","guidance":"Tarkista erityisesti pöly, liimajäämät, sormenjäljet ja pakkausmateriaalit."},
        {"title":"Havaitut puutteet ja poikkeamat on kirjattu vastuineen","guidance":"Älä merkitse kohtaa kunnossa, jos korjausta vaativa havainto on vielä kirjaamatta."},
        {"title":"Keittiö on turvallinen, käyttövalmis ja vastaa sovittua työn laajuutta","guidance":"Varmista kokonaisuus ennen siirtymistä puutteiden käsittelyyn ja luovutuskuviin."}
      ]
    }
  ]
  $payload$::jsonb;
begin
  select id into template_uuid
  from public.inspection_templates
  where name = 'Keittiöremontin itselleluovutus'
    and active = true
  order by is_system desc, created_at
  limit 1;

  if template_uuid is null then
    raise exception 'Keittiöremontin itselleluovutuksen tarkastuspohjaa ei löytynyt.';
  end if;

  if exists (
    select 1 from public.inspection_template_versions
    where template_id = template_uuid and change_note = change_marker
  ) then
    return;
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.inspection_template_versions
  where template_id = template_uuid;

  insert into public.inspection_template_versions (
    template_id, version, status, change_note, published_at, published_by
  ) values (
    template_uuid, next_version, 'Julkaistu', change_marker, now(), null
  ) returning id into version_uuid;

  for section_value in select value from jsonb_array_elements(sections_payload)
  loop
    section_order := section_order + 1;
    insert into public.inspection_template_sections (version_id, title, description, sort_order)
    values (
      version_uuid,
      section_value ->> 'title',
      section_value ->> 'description',
      section_order
    ) returning id into section_uuid;

    item_order := 0;
    for item_value in select value from jsonb_array_elements(section_value -> 'items')
    loop
      item_order := item_order + 1;
      insert into public.inspection_template_items (
        section_id, title, guidance, response_type, required,
        photo_required_on_defect, measurement_unit, sort_order
      ) values (
        section_uuid,
        item_value ->> 'title',
        item_value ->> 'guidance',
        'condition',
        true,
        true,
        null,
        item_order
      );
    end loop;
  end loop;

  update public.inspection_templates
  set description = 'Vaiheittainen keittiöremontin itselleluovutus: kalusteet, tasot, vesi, kodinkoneet, sähkö, viimeistely, puutteet ja luovutusdokumentointi.',
      updated_at = now()
  where id = template_uuid;
end;
$$;
"""

detail_path.write_text(detail, encoding="utf-8")
section_path.write_text(section, encoding="utf-8")
migration_path.write_text(migration, encoding="utf-8")
