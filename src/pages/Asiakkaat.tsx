import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  ChevronRight,
  Plus,
  Search,
  Pencil,
  Trash2,
  UserCheck,
  FolderKanban,
  Building2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/states';
import { cn } from '@/lib/utils';
import { useAppDataContext } from '@/contexts/AppDataContext';
import type { Customer, CustomerType, CustomerStatus } from '@/types';

/* ─── Lomakkeen tyyppi ─── */
interface CustomerForm {
  name: string;
  type: CustomerType;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  status: CustomerStatus;
}

type FormErrors = Partial<Record<keyof CustomerForm, string>>;

const emptyForm: CustomerForm = {
  name: '',
  type: 'Yritys',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  status: 'Aktiivinen',
};

const CUSTOMER_TYPES: CustomerType[] = ['Yritys', 'Yksityinen', 'Taloyhtiö'];
const CUSTOMER_STATUSES: CustomerStatus[] = ['Aktiivinen', 'Epäaktiivinen'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─── Merkit ─── */
const getStatusBadge = (status: CustomerStatus) =>
  status === 'Aktiivinen' ? (
    <Badge className="bg-success-light text-success border-0 font-medium">Aktiivinen</Badge>
  ) : (
    <Badge className="bg-bg-light text-text-secondary border border-[#E2E8F0] font-medium">
      Epäaktiivinen
    </Badge>
  );

const getTypeBadge = (type: CustomerType) => {
  switch (type) {
    case 'Yritys':
      return <Badge className="bg-primary-light text-primary border-0 font-medium">Yritys</Badge>;
    case 'Taloyhtiö':
      return <Badge className="bg-info-light text-info border-0 font-medium">Taloyhtiö</Badge>;
    case 'Yksityinen':
      return (
        <Badge className="bg-warning-light text-warning border-0 font-medium">Yksityinen</Badge>
      );
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
};

/* ─── Komponentti ─── */
export default function Asiakkaat() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useAppDataContext();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const activeCount = customers.filter(c => c.status === 'Aktiivinen').length;
  const totalProjects = customers.reduce((sum, c) => sum + (c.projectCount || 0), 0);

  const openCreateDialog = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      type: customer.type,
      contactPerson: customer.contactPerson,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      status: customer.status,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const setField = <K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'Nimi on pakollinen';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      next.email = 'Tarkista sähköpostiosoitteen muoto';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      type: form.type,
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      status: form.status,
    };
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, payload);
    } else {
      addCustomer({
        ...payload,
        projectCount: 0,
        lastContact: new Date().toLocaleDateString('fi-FI'),
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-6"
    >
      {/* ── Sivun otsikko ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-body-sm text-text-secondary mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">Asiakkaat</span>
          </div>
          <h1 className="text-hero text-text-primary">Asiakkaat</h1>
          <p className="text-body-sm text-text-secondary mt-1">
            Asiakasrekisteri ja yhteystiedot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-primary hover:bg-primary-hover text-white gap-2"
            onClick={openCreateDialog}
          >
            <Plus size={16} /> Uusi asiakas
          </Button>
        </div>
      </div>

      {/* ── Tilastot ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          {
            label: 'Asiakkaita yhteensä',
            value: customers.length,
            unit: 'asiakasta',
            icon: Users,
            color: 'text-primary',
            bg: 'bg-primary-light',
          },
          {
            label: 'Aktiiviset',
            value: activeCount,
            unit: 'asiakasta',
            icon: UserCheck,
            color: 'text-success',
            bg: 'bg-success-light',
          },
          {
            label: 'Projektit yhteensä',
            value: totalProjects,
            unit: 'projektia',
            icon: FolderKanban,
            color: 'text-warning',
            bg: 'bg-warning-light',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Card className="border border-[#E2E8F0] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-caption text-text-secondary uppercase tracking-wider">
                    {stat.label}
                  </span>
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      stat.bg,
                    )}
                  >
                    <stat.icon size={20} className={stat.color} />
                  </div>
                </div>
                <p className="text-[28px] font-bold text-text-primary font-mono leading-none">
                  {stat.value}
                </p>
                <p className="text-body-sm text-text-secondary mt-1">{stat.unit}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Haku ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            placeholder="Hae asiakkaita..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 border-[#E2E8F0] focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      {/* ── Asiakaslista ── */}
      {customers.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Ei asiakkaita"
          description="Asiakasrekisteri on tyhjä. Lisää ensimmäinen asiakas aloittaaksesi."
          action={
            <Button
              className="bg-primary hover:bg-primary-hover text-white gap-2"
              onClick={openCreateDialog}
            >
              <Plus size={16} /> Uusi asiakas
            </Button>
          }
        />
      ) : (
        <Card className="border border-[#E2E8F0] shadow-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-bg-light hover:bg-bg-light">
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                    Nimi
                  </TableHead>
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                    Tyyppi
                  </TableHead>
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold hidden lg:table-cell">
                    Yhteyshenkilö
                  </TableHead>
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold hidden md:table-cell">
                    Puhelin
                  </TableHead>
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold hidden xl:table-cell">
                    Sähköposti
                  </TableHead>
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold text-center">
                    Projektit
                  </TableHead>
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold">
                    Tila
                  </TableHead>
                  <TableHead className="text-caption text-text-muted uppercase tracking-wider font-semibold text-right">
                    Toiminnot
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map(customer => (
                  <TableRow key={customer.id} className="hover:bg-bg-light">
                    <TableCell>
                      <p className="text-sm font-semibold text-text-primary">{customer.name}</p>
                      <p className="text-body-sm text-text-secondary mt-0.5">
                        {customer.address}
                      </p>
                    </TableCell>
                    <TableCell>{getTypeBadge(customer.type)}</TableCell>
                    <TableCell className="text-body-sm text-text-secondary hidden lg:table-cell">
                      {customer.contactPerson || '—'}
                    </TableCell>
                    <TableCell className="text-body-sm text-text-secondary hidden md:table-cell">
                      {customer.phone || '—'}
                    </TableCell>
                    <TableCell className="text-body-sm text-text-secondary hidden xl:table-cell">
                      {customer.email || '—'}
                    </TableCell>
                    <TableCell className="text-mono text-body-sm text-text-primary text-center">
                      {customer.projectCount}
                    </TableCell>
                    <TableCell>{getStatusBadge(customer.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-text-secondary hover:text-primary"
                          onClick={() => openEditDialog(customer)}
                          aria-label={`Muokkaa asiakasta ${customer.name}`}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-text-secondary hover:text-danger"
                          onClick={() => setDeleteTarget(customer)}
                          aria-label={`Poista asiakas ${customer.name}`}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredCustomers.length === 0 && (
              <div className="p-12 text-center">
                <Building2 size={48} className="mx-auto text-text-muted mb-4" />
                <p className="text-h3 text-text-primary mb-1">Ei hakutuloksia</p>
                <p className="text-body-sm text-text-secondary">
                  Hakuehdoilla ei löytynyt asiakkaita
                </p>
              </div>
            )}

            <div className="flex items-center justify-between px-6 py-3 border-t border-[#E2E8F0] bg-bg-light">
              <span className="text-body-sm text-text-secondary">
                Näytetään {filteredCustomers.length} / {customers.length}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Luonti-/muokkausdialogi ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-h2">
              {editingCustomer ? 'Muokkaa asiakasta' : 'Uusi asiakas'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nimi *</Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="esim. As Oy Tampereen Keskusta"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-sm text-danger">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tyyppi</Label>
                <Select
                  value={form.type}
                  onValueChange={v => setField('type', v as CustomerType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse tyyppi" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tila</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setField('status', v as CustomerStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Valitse tila" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-contact">Yhteyshenkilö</Label>
              <Input
                id="customer-contact"
                value={form.contactPerson}
                onChange={e => setField('contactPerson', e.target.value)}
                placeholder="esim. Matti Mäkinen"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Puhelin</Label>
                <Input
                  id="customer-phone"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  placeholder="040-1234567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Sähköposti</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  placeholder="nimi@yritys.fi"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-sm text-danger">{errors.email}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-address">Osoite</Label>
              <Input
                id="customer-address"
                value={form.address}
                onChange={e => setField('address', e.target.value)}
                placeholder="Katuosoite, postinumero ja kaupunki"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Peruuta
            </Button>
            <Button
              className="bg-primary hover:bg-primary-hover text-white"
              onClick={handleSave}
            >
              {editingCustomer ? 'Tallenna muutokset' : 'Lisää asiakas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Poiston vahvistus ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista asiakas</AlertDialogTitle>
            <AlertDialogDescription>
              Haluatko varmasti poistaa asiakkaan{' '}
              <span className="font-semibold">{deleteTarget?.name}</span>? Toimintoa ei voi
              peruuttaa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Peruuta</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={handleDelete}
            >
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
