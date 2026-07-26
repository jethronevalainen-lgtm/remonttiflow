import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Edit3,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCustomerRelations } from '@/hooks/useCustomerRelations';
import {
  createCustomerContact,
  deleteCustomerContact,
  updateCustomerContact,
  type CustomerContact,
} from '@/lib/supabase/customerRelations';
import type { Customer, CustomerStatus, CustomerType } from '@/types';

const CUSTOMER_TYPES: CustomerType[] = ['Yritys', 'Yksityinen', 'Taloyhtiö'];
const CUSTOMER_STATUSES: CustomerStatus[] = ['Aktiivinen', 'Epäaktiivinen'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CustomerForm {
  name: string;
  type: CustomerType;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  businessId: string;
  notes: string;
  status: CustomerStatus;
}

const emptyCustomer: CustomerForm = {
  name: '', type: 'Yritys', contactPerson: '', phone: '', email: '', address: '',
  businessId: '', notes: '', status: 'Aktiivinen',
};

interface ContactForm {
  customerId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  notes: string;
}

const emptyContact: ContactForm = {
  customerId: '', name: '', title: '', email: '', phone: '', isPrimary: false, notes: '',
};

function statusBadge(status: CustomerStatus) {
  return <Badge className={status === 'Aktiivinen' ? 'border-0 bg-emerald-50 text-emerald-700' : 'border-0 bg-slate-100 text-slate-600'}>{status}</Badge>;
}

export default function Asiakkaat() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { customers, projects, addCustomer, updateCustomer, deleteCustomer, operationError: domainError } = useAppDataContext();
  const relations = useCustomerRelations();
  const [search, setSearch] = useState('');
  const [customerDialog, setCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomer);
  const [contactDialog, setContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [deleteContactTarget, setDeleteContactTarget] = useState<CustomerContact | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const [errors, setErrors] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    return customers.filter((customer) => !query || [
      customer.name,
      customer.contactPerson,
      customer.email,
      customer.address,
      customer.businessId ?? '',
    ].some((value) => value.toLocaleLowerCase('fi').includes(query)));
  }, [customers, search]);
  const customerById = useMemo(() => new Map(customers.map((item) => [item.id, item])), [customers]);
  const projectsByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((project) => {
      if (project.customerId) map.set(project.customerId, (map.get(project.customerId) ?? 0) + 1);
      else {
        const customer = customers.find((item) => item.name === project.customer);
        if (customer) map.set(customer.id, (map.get(customer.id) ?? 0) + 1);
      }
    });
    return map;
  }, [customers, projects]);
  const visibleError = operationError ?? domainError ?? relations.error;

  const openCustomerCreate = () => {
    setEditingCustomer(null); setCustomerForm(emptyCustomer); setErrors([]); setOperationError(null); setCustomerDialog(true);
  };

  const openCustomerEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({ name: customer.name, type: customer.type, contactPerson: customer.contactPerson, phone: customer.phone, email: customer.email, address: customer.address, businessId: customer.businessId ?? '', notes: customer.notes ?? '', status: customer.status });
    setErrors([]); setOperationError(null); setCustomerDialog(true);
  };

  const saveCustomer = () => {
    const nextErrors: string[] = [];
    if (!customerForm.name.trim()) nextErrors.push('Asiakkaan nimi on pakollinen.');
    if (customerForm.email.trim() && !EMAIL_RE.test(customerForm.email.trim())) nextErrors.push('Tarkista sähköpostiosoitteen muoto.');
    setErrors(nextErrors);
    if (nextErrors.length) return;
    const payload = {
      name: customerForm.name.trim(), type: customerForm.type, contactPerson: customerForm.contactPerson.trim(),
      phone: customerForm.phone.trim(), email: customerForm.email.trim(), address: customerForm.address.trim(),
      businessId: customerForm.businessId.trim() || undefined, notes: customerForm.notes.trim() || undefined,
      status: customerForm.status,
    };
    if (editingCustomer) updateCustomer(editingCustomer.id, payload);
    else addCustomer({ ...payload, projectCount: 0, lastContact: new Date().toLocaleDateString('fi-FI') });
    setCustomerDialog(false);
  };

  const openContactCreate = (customerId = '') => {
    setEditingContact(null); setContactForm({ ...emptyContact, customerId }); setErrors([]); setOperationError(null); setContactDialog(true);
  };

  const openContactEdit = (contact: CustomerContact) => {
    setEditingContact(contact);
    setContactForm({ customerId: contact.customerId, name: contact.name, title: contact.title ?? '', email: contact.email ?? '', phone: contact.phone ?? '', isPrimary: contact.isPrimary, notes: contact.notes ?? '' });
    setErrors([]); setOperationError(null); setContactDialog(true);
  };

  const saveContact = async () => {
    const nextErrors: string[] = [];
    if (!contactForm.customerId) nextErrors.push('Valitse asiakas.');
    if (!contactForm.name.trim()) nextErrors.push('Yhteyshenkilön nimi on pakollinen.');
    if (contactForm.email.trim() && !EMAIL_RE.test(contactForm.email.trim())) nextErrors.push('Tarkista sähköpostiosoitteen muoto.');
    setErrors(nextErrors);
    if (nextErrors.length || !currentOrg) return;
    setSaving(true); setOperationError(null);
    try {
      const input = { organizationId: currentOrg.id, name: contactForm.name, title: contactForm.title, email: contactForm.email, phone: contactForm.phone, isPrimary: contactForm.isPrimary, notes: contactForm.notes };
      if (editingContact) await updateCustomerContact({ ...input, id: editingContact.id });
      else await createCustomerContact({ ...input, customerId: contactForm.customerId, userId: user?.id });
      await relations.refresh(); setContactDialog(false);
    } catch (caught) { setOperationError(caught instanceof Error ? caught.message : 'Yhteyshenkilön tallennus epäonnistui.'); }
    finally { setSaving(false); }
  };

  const removeContact = async () => {
    if (!currentOrg || !deleteContactTarget) return;
    setSaving(true); try { await deleteCustomerContact(currentOrg.id, deleteContactTarget.id); await relations.refresh(); setDeleteContactTarget(null); }
    catch (caught) { setOperationError(caught instanceof Error ? caught.message : 'Poistaminen epäonnistui.'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-hero text-text-primary">Asiakkaat ja yhteyshenkilöt</h1><p className="mt-1 text-body-sm text-text-secondary">Asiakasrekisteri, useat yhteyshenkilöt ja projektihistoria</p></div><div className="flex flex-wrap gap-2"><Button onClick={openCustomerCreate}><Plus size={16} className="mr-2" /> Uusi asiakas</Button><Button variant="outline" onClick={() => openContactCreate()}><UserCheck size={16} className="mr-2" /> Uusi yhteyshenkilö</Button></div></div>
      {visibleError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={16} />{visibleError}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Asiakkaita', value: customers.length, icon: Building2 },
        { label: 'Aktiivisia', value: customers.filter((item) => item.status === 'Aktiivinen').length, icon: UserCheck },
        { label: 'Yhteyshenkilöitä', value: relations.contacts.length, icon: Users },
        { label: 'Projekteja', value: projects.length, icon: Building2 },
      ].map((item) => <Card key={item.label}><CardContent className="p-5"><div className="flex justify-between text-sm text-text-secondary"><span>{item.label}</span><item.icon size={18} className="text-primary" /></div><p className="mt-2 font-mono text-3xl font-bold">{item.value}</p></CardContent></Card>)}</div>

      <Tabs defaultValue="customers" className="space-y-4"><TabsList><TabsTrigger value="customers">Asiakkaat</TabsTrigger><TabsTrigger value="contacts">Yhteyshenkilöt ({relations.contacts.length})</TabsTrigger></TabsList>
        <TabsContent value="customers" className="space-y-4"><div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hae asiakasta…" className="pl-9" /></div><div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{filteredCustomers.map((customer) => { const contacts = relations.contacts.filter((item) => item.customerId === customer.id); const primary = contacts.find((item) => item.isPrimary) ?? contacts[0]; return <Card key={customer.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light"><Building2 size={18} className="text-primary" /></div>{statusBadge(customer.status)}</div><h2 className="mt-4 font-bold">{customer.name}</h2><p className="mt-1 text-sm text-text-secondary">{customer.type}{customer.businessId ? ` · ${customer.businessId}` : ''}</p><p className="mt-2 text-sm">{customer.address || 'Ei osoitetta'}</p><div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">{primary?.name || customer.contactPerson || 'Ei yhteyshenkilöä'}</p>{primary?.email || customer.email ? <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary"><Mail size={12} />{primary?.email || customer.email}</p> : null}{primary?.phone || customer.phone ? <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary"><Phone size={12} />{primary?.phone || customer.phone}</p> : null}</div><div className="mt-4 flex items-center justify-between text-xs text-text-muted"><span>{contacts.length} yhteyshenkilöä</span><span>{projectsByCustomer.get(customer.id) ?? 0} projektia</span></div><div className="mt-4 flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openContactCreate(customer.id)}><UserCheck size={14} /></Button><Button variant="ghost" size="sm" onClick={() => openCustomerEdit(customer)}><Edit3 size={14} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteCustomerTarget(customer)}><Trash2 size={14} /></Button></div></CardContent></Card>; })}{!filteredCustomers.length && <Card className="lg:col-span-2 xl:col-span-3"><CardContent className="p-12 text-center"><Users size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei asiakkaita</p></CardContent></Card>}</div></TabsContent>
        <TabsContent value="contacts" className="space-y-4"><div className="flex justify-end"><Button onClick={() => openContactCreate()}><Plus size={16} className="mr-2" /> Lisää yhteyshenkilö</Button></div><Card><CardContent className="p-0">{relations.contacts.map((contact) => <div key={contact.id} className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_120px_100px] lg:items-center"><div><p className="font-semibold">{contact.name}</p><p className="text-xs text-text-secondary">{contact.title || 'Ei tehtävänimikettä'}</p></div><span className="text-sm">{customerById.get(contact.customerId)?.name ?? 'Tuntematon asiakas'}</span><div className="text-xs text-text-secondary">{contact.email && <p className="flex items-center gap-1"><Mail size={12} />{contact.email}</p>}{contact.phone && <p className="flex items-center gap-1"><Phone size={12} />{contact.phone}</p>}</div><div>{contact.isPrimary && <Badge className="border-0 bg-emerald-50 text-emerald-700">Ensisijainen</Badge>}</div><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openContactEdit(contact)}><Edit3 size={14} /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteContactTarget(contact)}><Trash2 size={14} /></Button></div></div>)}{!relations.contacts.length && <div className="p-12 text-center"><UserCheck size={44} className="mx-auto mb-3 text-text-muted" /><p className="font-semibold">Ei yhteyshenkilöitä</p></div>}</CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingCustomer ? 'Muokkaa asiakasta' : 'Uusi asiakas'}</DialogTitle></DialogHeader>{errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={customerForm.name} onChange={(event) => setCustomerForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-2"><Label>Tyyppi</Label><Select value={customerForm.type} onValueChange={(type: CustomerType) => setCustomerForm((previous) => ({ ...previous, type }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tila</Label><Select value={customerForm.status} onValueChange={(status: CustomerStatus) => setCustomerForm((previous) => ({ ...previous, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOMER_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Y-tunnus</Label><Input value={customerForm.businessId} onChange={(event) => setCustomerForm((previous) => ({ ...previous, businessId: event.target.value }))} /></div><div className="space-y-2"><Label>Vanha pääyhteyshenkilö</Label><Input value={customerForm.contactPerson} onChange={(event) => setCustomerForm((previous) => ({ ...previous, contactPerson: event.target.value }))} /></div><div className="space-y-2"><Label>Puhelin</Label><Input value={customerForm.phone} onChange={(event) => setCustomerForm((previous) => ({ ...previous, phone: event.target.value }))} /></div><div className="space-y-2"><Label>Sähköposti</Label><Input value={customerForm.email} onChange={(event) => setCustomerForm((previous) => ({ ...previous, email: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Osoite</Label><Input value={customerForm.address} onChange={(event) => setCustomerForm((previous) => ({ ...previous, address: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Huomiot</Label><Textarea value={customerForm.notes} onChange={(event) => setCustomerForm((previous) => ({ ...previous, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCustomerDialog(false)}>Peruuta</Button><Button onClick={saveCustomer}>Tallenna</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={contactDialog} onOpenChange={setContactDialog}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingContact ? 'Muokkaa yhteyshenkilöä' : 'Uusi yhteyshenkilö'}</DialogTitle></DialogHeader>{errors.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.map((item) => <p key={item}>{item}</p>)}</div>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Asiakas *</Label><Select value={contactForm.customerId} onValueChange={(customerId) => setContactForm((previous) => ({ ...previous, customerId }))} disabled={Boolean(editingContact)}><SelectTrigger><SelectValue placeholder="Valitse asiakas" /></SelectTrigger><SelectContent>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label>Nimi *</Label><Input value={contactForm.name} onChange={(event) => setContactForm((previous) => ({ ...previous, name: event.target.value }))} /></div><div className="space-y-2"><Label>Tehtävänimike</Label><Input value={contactForm.title} onChange={(event) => setContactForm((previous) => ({ ...previous, title: event.target.value }))} /></div><div className="space-y-2"><Label>Puhelin</Label><Input value={contactForm.phone} onChange={(event) => setContactForm((previous) => ({ ...previous, phone: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Sähköposti</Label><Input value={contactForm.email} onChange={(event) => setContactForm((previous) => ({ ...previous, email: event.target.value }))} /></div><label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={contactForm.isPrimary} onCheckedChange={(value) => setContactForm((previous) => ({ ...previous, isPrimary: value === true }))} /><span className="text-sm font-medium">Ensisijainen yhteyshenkilö</span></label><div className="space-y-2 sm:col-span-2"><Label>Huomiot</Label><Textarea value={contactForm.notes} onChange={(event) => setContactForm((previous) => ({ ...previous, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setContactDialog(false)}>Peruuta</Button><Button onClick={() => void saveContact()} disabled={saving}>{saving ? 'Tallennetaan…' : 'Tallenna'}</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteCustomerTarget || deleteContactTarget)} onOpenChange={(open) => { if (!open) { setDeleteCustomerTarget(null); setDeleteContactTarget(null); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Poistetaanko tieto?</AlertDialogTitle><AlertDialogDescription>Poistoa ei voi perua. Asiakasta ei voi poistaa, jos siihen liittyy suojattuja tietoja.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Peruuta</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteCustomerTarget ? (deleteCustomer(deleteCustomerTarget.id), setDeleteCustomerTarget(null)) : void removeContact()}>Poista</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </motion.div>
  );
}
