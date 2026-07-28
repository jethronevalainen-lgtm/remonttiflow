from pathlib import Path

CONTROL = Path('src/pages/workOrders/WorkOrderControlPanel.tsx')
TYOM = Path('src/pages/TyomaarayksetV2.tsx')
DIALOG = Path('src/pages/workOrders/WorkOrderDialog.tsx')
BULK_COMPONENT = Path('src/pages/workOrders/WorkOrderBulkDelete.tsx')
DOC = Path('docs/work-order-bulk-delete.md')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one occurrence, got {count}: {old[:140]!r}')
    return text.replace(old, new, 1)


def update_control() -> None:
    text = CONTROL.read_text(encoding='utf-8')

    def apply(old: str, new: str, label: str) -> None:
        nonlocal text
        text = replace_once(text, old, new, label)

    apply("  Plus,\n", "", 'remove duplicate create icon')
    apply(
        "} from '@/lib/supabase/workOrderControl';\nimport { cn } from '@/lib/utils';",
        "} from '@/lib/supabase/workOrderControl';\nimport { deleteManagedWorkOrders } from '@/lib/supabase/workOrderBulkDelete';\nimport { cn } from '@/lib/utils';",
        'import bulk delete service',
    )
    apply("interface Props {\n  canCreate: boolean;", "interface Props {\n  canDelete: boolean;", 'replace create permission')
    apply("  onCreate: () => void;\n", "", 'remove create callback')
    apply(
        "const DEFAULT_COLUMNS: ColumnKey[] = [\n",
        "const WORK_ORDER_GRID_COLUMNS = 'lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_7.5rem_6.5rem_7rem_auto]';\n\nconst DEFAULT_COLUMNS: ColumnKey[] = [\n",
        'shared grid columns',
    )
    apply(
        "function assignmentLabel(order: ManagedWorkOrder) {\n  if (order.assignmentScope === 'project_team') return 'Koko projektitiimi';\n  return order.assigneeNames.length > 0 ? order.assigneeNames.join(', ') : 'Vastuuhenkilö puuttuu';\n}\n",
        "function assignmentLabel(order: ManagedWorkOrder) {\n  if (order.assignmentScope === 'project_team') return 'Koko projektitiimi';\n  return order.assigneeNames.length > 0 ? order.assigneeNames.join(', ') : 'Vastuuhenkilö puuttuu';\n}\n\nfunction deletionBlockReason(order: ControlledWorkOrder): string | null {\n  if (order.activeSessionCount > 0) return 'Työaika on käynnissä';\n  if (order.status === 'Käynnissä') return 'Työmääräyksen tila on Käynnissä';\n  return null;\n}\n",
        'delete eligibility helper',
    )
    apply("export default function WorkOrderControlPanel({\n  canCreate,", "export default function WorkOrderControlPanel({\n  canDelete,", 'destructure delete permission')
    apply("  onCreate,\n", "", 'remove create callback destructuring')
    apply(
        "  const [bulkAssignees, setBulkAssignees] = useState<string[]>([]);\n",
        "  const [bulkAssignees, setBulkAssignees] = useState<string[]>([]);\n  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);\n",
        'delete confirmation state',
    )
    apply(
        "  const selectedOrders = controlledOrders.filter((order) => selectedIds.includes(order.id));\n  const pageAllSelected = pageOrders.length > 0 && pageOrders.every((order) => selectedIds.includes(order.id));\n",
        "  const selectedOrders = controlledOrders.filter((order) => selectedIds.includes(order.id));\n  const pageAllSelected = pageOrders.length > 0 && pageOrders.every((order) => selectedIds.includes(order.id));\n  const pageSomeSelected = pageOrders.some((order) => selectedIds.includes(order.id));\n  const blockedDeletionOrders = selectedOrders.flatMap((order) => {\n    const reason = deletionBlockReason(order);\n    return reason ? [{ order, reason }] : [];\n  });\n  const deletionLimitExceeded = selectedOrders.length > 200;\n  const canConfirmBulkDelete = canDelete\n    && selectedOrders.length > 0\n    && blockedDeletionOrders.length === 0\n    && !deletionLimitExceeded;\n\n  useEffect(() => {\n    const existingIds = new Set(controlledOrders.map((order) => order.id));\n    setSelectedIds((current) => {\n      const next = current.filter((id) => existingIds.has(id));\n      return next.length === current.length ? current : next;\n    });\n  }, [controlledOrders]);\n",
        'selection and delete eligibility state',
    )
    apply(
        "  const saveMetadata = async () => {\n",
        "  const removeSelected = async () => {\n    if (!canConfirmBulkDelete) return;\n\n    setSaving(true);\n    setOperationError(null);\n    setOperationSuccess(null);\n    try {\n      const deletedCount = await deleteManagedWorkOrders({\n        organizationId,\n        workOrderIds: selectedOrders.map((order) => order.id),\n      });\n      const deletedIds = new Set(selectedOrders.map((order) => order.id));\n      setDetailOrderId((current) => current && deletedIds.has(current) ? null : current);\n      setDeleteConfirmOpen(false);\n      setSelectedIds([]);\n      await onRefresh();\n      setOperationSuccess(`${deletedCount} työmääräystä poistettiin.`);\n    } catch (caught) {\n      setOperationError(caught instanceof Error ? caught.message : 'Työmääräysten poistaminen epäonnistui.');\n    } finally {\n      setSaving(false);\n    }\n  };\n\n  const saveMetadata = async () => {\n",
        'bulk delete action',
    )
    apply(
        "            <div className=\"flex flex-wrap items-center gap-2\">\n              <Button variant=\"outline\" size=\"sm\" onClick={exportCsv} className=\"gap-2\"><Download size={15} /> Vie CSV</Button>\n              {canCreate && <Button size=\"sm\" onClick={onCreate} className=\"gap-2 bg-orange-600 hover:bg-orange-700\"><Plus size={15} /> Uusi työmääräys</Button>}\n            </div>",
        "            <div className=\"flex flex-wrap items-center gap-2\">\n              <Button variant=\"outline\" size=\"sm\" onClick={exportCsv} className=\"gap-2\"><Download size={15} /> Vie CSV</Button>\n            </div>",
        'remove duplicate create button',
    )
    apply(
        "            <Button size=\"sm\" variant=\"secondary\" onClick={() => setBulkAction('dueDate')}>Määräpäivä</Button>\n",
        "            <Button size=\"sm\" variant=\"secondary\" onClick={() => setBulkAction('dueDate')}>Määräpäivä</Button>\n            {canDelete && (\n              <Button size=\"sm\" variant=\"destructive\" className=\"gap-2\" onClick={() => setDeleteConfirmOpen(true)}>\n                <Trash2 size={14} /> Poista valitut\n              </Button>\n            )}\n",
        'integrated delete button',
    )
    apply(
        "              <div className=\"hidden items-center gap-3 bg-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_7.5rem_6.5rem_7rem_auto]\">",
        "              <div className={cn('hidden items-center gap-3 bg-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid', WORK_ORDER_GRID_COLUMNS)}>",
        'shared header grid',
    )
    apply("                  checked={pageAllSelected}\n", "                  checked={pageAllSelected ? true : pageSomeSelected ? 'indeterminate' : false}\n", 'indeterminate page select')
    apply(
        "                        'grid gap-3 px-4 py-4 hover:bg-orange-50/30 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_7.5rem_6.5rem_7rem_auto] lg:items-start',\n",
        "                        'grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 hover:bg-orange-50/30 lg:items-start lg:gap-3',\n                        WORK_ORDER_GRID_COLUMNS,\n",
        'shared row grid',
    )
    apply("                      <div className=\"flex items-start gap-3 lg:contents\">\n", "", 'remove fragile contents wrapper')
    apply(
        "                        </div>\n                      </div>\n\n                      <div className=\"min-w-0 space-y-1 text-sm\">\n",
        "                        </div>\n\n                      <div className=\"col-span-2 min-w-0 space-y-1 text-sm lg:col-span-1\">\n",
        'make target direct grid cell',
    )
    apply(
        "                      <div className=\"min-w-0 space-y-1 text-sm\">\n                        {order.assignmentScope === 'project_team' ? (",
        "                      <div className=\"col-span-2 min-w-0 space-y-1 text-sm lg:col-span-1\">\n                        {order.assignmentScope === 'project_team' ? (",
        'assignee direct grid cell',
    )
    apply(
        "                      <div className=\"min-w-0 space-y-1 text-sm\">\n                        <p className=\"break-words font-medium text-slate-800\">{formatDate(order.dueDate, 'Ei määräpäivää')}</p>",
        "                      <div className=\"col-span-2 min-w-0 space-y-1 text-sm lg:col-span-1\">\n                        <p className=\"break-words font-medium text-slate-800\">{formatDate(order.dueDate, 'Ei määräpäivää')}</p>",
        'schedule direct grid cell',
    )
    apply(
        "                      <div className=\"flex flex-wrap gap-2 lg:justify-end\">\n",
        "                      <div className=\"col-span-2 flex flex-wrap gap-2 lg:col-span-1 lg:justify-end\">\n",
        'actions direct grid cell',
    )
    apply(
        "                        <DropdownMenu>\n                          <DropdownMenuTrigger asChild>\n                            <Button variant=\"ghost\" size=\"sm\" className=\"h-9 w-9 p-0\" aria-label=\"Lisää toimintoja\">\n                              <MoreHorizontal size={16} />\n                            </Button>\n                          </DropdownMenuTrigger>\n                          <DropdownMenuContent align=\"end\">\n                            <DropdownMenuItem className=\"text-red-600 focus:text-red-600\" onClick={() => onDelete(order)}>\n                              <Trash2 size={14} className=\"mr-2\" /> Poista\n                            </DropdownMenuItem>\n                          </DropdownMenuContent>\n                        </DropdownMenu>",
        "                        {canDelete && (\n                          <DropdownMenu>\n                            <DropdownMenuTrigger asChild>\n                              <Button variant=\"ghost\" size=\"sm\" className=\"h-9 w-9 p-0\" aria-label=\"Lisää toimintoja\">\n                                <MoreHorizontal size={16} />\n                              </Button>\n                            </DropdownMenuTrigger>\n                            <DropdownMenuContent align=\"end\">\n                              <DropdownMenuItem className=\"text-red-600 focus:text-red-600\" onClick={() => onDelete(order)}>\n                                <Trash2 size={14} className=\"mr-2\" /> Poista\n                              </DropdownMenuItem>\n                            </DropdownMenuContent>\n                          </DropdownMenu>\n                        )}",
        'permission-protect row delete',
    )
    apply(
        "                <div className=\"flex flex-wrap gap-2\"><Button variant=\"outline\" onClick={() => onEdit(detailOrder)}><Pencil size={15} className=\"mr-2\" /> Muokkaa työmääräystä</Button><Button variant=\"outline\" className=\"text-red-600\" onClick={() => onDelete(detailOrder)}><Trash2 size={15} className=\"mr-2\" /> Poista</Button></div>",
        "                <div className=\"flex flex-wrap gap-2\"><Button variant=\"outline\" onClick={() => onEdit(detailOrder)}><Pencil size={15} className=\"mr-2\" /> Muokkaa työmääräystä</Button>{canDelete && <Button variant=\"outline\" className=\"text-red-600\" onClick={() => onDelete(detailOrder)}><Trash2 size={15} className=\"mr-2\" /> Poista</Button>}</div>",
        'permission-protect detail delete',
    )
    apply(
        "      <Dialog open={Boolean(bulkAction)} onOpenChange={(open) => { if (!open && !saving) { setBulkAction(null); setBulkValue(''); setBulkAssignees([]); } }}>",
        "      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !saving && setDeleteConfirmOpen(open)}>\n        <DialogContent className=\"max-h-[90vh] overflow-y-auto sm:max-w-lg\">\n          <DialogHeader>\n            <DialogTitle className=\"flex items-center gap-2\"><Trash2 size={18} /> Poista valitut työmääräykset</DialogTitle>\n          </DialogHeader>\n          <div className=\"space-y-4\">\n            <div className=\"rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950\">\n              <p className=\"font-semibold\">Poistetaanko {selectedOrders.length} työmääräystä?</p>\n              <p className=\"mt-1 leading-5\">Toimintoa ei voi perua. Kalenterivaraukset ja vastuuhenkilölinkit poistetaan. Historialliset tuntikirjaukset säilyvät ilman työmääräyslinkkiä.</p>\n            </div>\n\n            {deletionLimitExceeded && (\n              <div className=\"rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950\">\n                Yhdellä kertaa voidaan poistaa enintään 200 työmääräystä. Pienennä valintaa.\n              </div>\n            )}\n\n            {blockedDeletionOrders.length > 0 && (\n              <div className=\"rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950\">\n                <p className=\"font-semibold\">Poisto ei ole mahdollinen ennen seuraavien töiden päättämistä:</p>\n                <ul className=\"mt-2 space-y-1\">\n                  {blockedDeletionOrders.slice(0, 10).map(({ order, reason }) => (\n                    <li key={order.id}>• {order.title}: {reason}</li>\n                  ))}\n                </ul>\n                {blockedDeletionOrders.length > 10 && <p className=\"mt-2\">+ {blockedDeletionOrders.length - 10} muuta estettyä työmääräystä</p>}\n              </div>\n            )}\n\n            <div className=\"rounded-xl border border-slate-200\">\n              <div className=\"border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500\">Poistettava valinta</div>\n              <div className=\"divide-y\">\n                {selectedOrders.slice(0, 10).map((order) => (\n                  <div key={order.id} className=\"px-3 py-2.5\">\n                    <p className=\"font-medium text-slate-900\">{order.title}</p>\n                    <p className=\"mt-0.5 text-xs text-slate-500\">{order.project} · {order.location || order.projectLocation || 'Ei sijaintia'}</p>\n                  </div>\n                ))}\n              </div>\n              {selectedOrders.length > 10 && <p className=\"border-t px-3 py-2 text-xs text-slate-500\">+ {selectedOrders.length - 10} muuta työmääräystä</p>}\n            </div>\n          </div>\n          <DialogFooter>\n            <Button variant=\"outline\" onClick={() => setDeleteConfirmOpen(false)} disabled={saving}>Peruuta</Button>\n            <Button variant=\"destructive\" onClick={() => void removeSelected()} disabled={!canConfirmBulkDelete || saving}>\n              {saving ? <><Loader2 size={15} className=\"mr-2 animate-spin\" />Poistetaan…</> : `Poista ${selectedOrders.length} työmääräystä`}\n            </Button>\n          </DialogFooter>\n        </DialogContent>\n      </Dialog>\n\n      <Dialog open={Boolean(bulkAction)} onOpenChange={(open) => { if (!open && !saving) { setBulkAction(null); setBulkValue(''); setBulkAssignees([]); } }}>",
        'bulk delete confirmation dialog',
    )
    CONTROL.write_text(text, encoding='utf-8')


def update_page() -> None:
    text = TYOM.read_text(encoding='utf-8')

    def apply(old: str, new: str, label: str) -> None:
        nonlocal text
        text = replace_once(text, old, new, label)

    apply("import { useOrganization } from '@/contexts/OrganizationContext';\n", "import { useOrganization } from '@/contexts/OrganizationContext';\nimport { useViewAs } from '@/contexts/ViewAsContext';\n", 'view-as import')
    apply("import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';\n", "import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';\nimport { deleteManagedWorkOrders } from '@/lib/supabase/workOrderBulkDelete';\n", 'bulk delete import')
    apply("  const { currentOrg } = useOrganization();\n  const { projects, deleteWorkOrder, refresh: refreshDomain } = useAppDataContext();\n", "  const { currentOrg } = useOrganization();\n  const { effectiveRole, isPreviewing } = useViewAs();\n  const { projects, refresh: refreshDomain } = useAppDataContext();\n", 'role and data context')
    apply("  const [dialogOpen, setDialogOpen] = useState(false);\n", "  const canDeleteWorkOrders = !isPreviewing\n    && (effectiveRole === 'admin' || effectiveRole === 'supervisor');\n\n  const [dialogOpen, setDialogOpen] = useState(false);\n", 'delete permission')
    apply("  const remove = async () => {\n    if (!deleteTarget) return;\n", "  const remove = async () => {\n    if (!deleteTarget || !currentOrg || !canDeleteWorkOrders) return;\n", 'single delete guard')
    apply("      const removed = await deleteWorkOrder(deleteTarget.id);\n      if (!removed) throw new Error('Työmääräyksen poistaminen epäonnistui.');\n", "      await deleteManagedWorkOrders({\n        organizationId: currentOrg.id,\n        workOrderIds: [deleteTarget.id],\n      });\n", 'single delete RPC')
    apply("      <WorkOrderControlPanel\n        canCreate\n", "      <WorkOrderControlPanel\n        canDelete={canDeleteWorkOrders}\n", 'control permission prop')
    apply("        onCreate={openCreate}\n", "", 'remove duplicate create callback')
    TYOM.write_text(text, encoding='utf-8')


def update_dialog() -> None:
    DIALOG.write_text(
        "import type { ComponentProps } from 'react';\n\n"
        "import WorkOrderEditorDialog from './WorkOrderEditorDialog';\n\n"
        "type Props = ComponentProps<typeof WorkOrderEditorDialog>;\n\n"
        "export default function WorkOrderDialog(props: Props) {\n"
        "  return <WorkOrderEditorDialog {...props} />;\n"
        "}\n",
        encoding='utf-8',
    )


def update_docs() -> None:
    DOC.write_text(
        "# Työmääräysten massapoisto\n\n"
        "Työnjohtaja ja pääkäyttäjä valitsevat poistettavat työmääräykset suoraan Työmääräykset-taulukon valintaruuduilla. Valinnan jälkeen avautuvan massatoimintopalkin **Poista valitut** -toiminto käyttää samaa valintaa kuin muut massamuutokset. Erillistä kelluvaa massapoistopainiketta tai toista valintanäkymää ei ole.\n\n"
        "## Käyttöliittymä\n\n"
        "- Rivejä voi valita yksittäin tai valita kaikki nykyisen sivun rivit.\n"
        "- Osittainen sivuvalinta näkyy valintaruudun epämääräisenä tilana.\n"
        "- Vahvistusikkuna näyttää poistettavan määrän, ensimmäiset valitut työt sekä mahdolliset poiston estot.\n"
        "- Käynnissä oleva tai aktiivista työaikaa sisältävä työ estää koko valitun erän poistamisen.\n"
        "- Yhdellä kertaa voi poistaa enintään 200 työmääräystä.\n"
        "- Onnistuneen poiston jälkeen valinta tyhjennetään ja työmääräysnäkymä päivitetään.\n\n"
        "## Suojaukset\n\n"
        "- Toiminto näkyy vain `supervisor`- ja `admin`-rooleille eikä roolin esikatselutilassa.\n"
        "- Tietokannan `delete_work_orders_bulk`-toiminto poistaa 1–200 työmääräystä atomisesti.\n"
        "- Tietokanta tarkistaa organisaation, käyttäjäroolin, tunnisteet ja aktiiviset `work_order_time_sessions`-istunnot uudelleen ennen poistoa.\n"
        "- Jos yksikin valittu työ ei ole poistettavissa, mitään valituista töistä ei poisteta.\n"
        "- Jokaisesta poistetusta työmääräyksestä syntyy audit-loki.\n"
        "- Kalenterivaraukset ja vastuuhenkilölinkit poistuvat viite-ehtojen mukaisesti. Historialliset tuntikirjaukset säilyvät, mutta niiden työmääräyslinkki tyhjenee.\n",
        encoding='utf-8',
    )


update_control()
update_page()
update_dialog()
update_docs()
if BULK_COMPONENT.exists():
    BULK_COMPONENT.unlink()

print('Work order table alignment and integrated bulk deletion applied.')
