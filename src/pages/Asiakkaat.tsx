import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Building2, UserCircle, Home, Plus, Search, Phone, Mail, MapPin, FolderKanban, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface Customer {
  id: string;
  name: string;
  type: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  projectCount: number;
  lastContact: string;
  status: string;
}

const CUSTOMERS: Customer[] = [
  { id: 'AS-001', name: 'As Oy Tampereen Keskusta', type: 'Taloyhtiö', contactPerson: 'Matti Mäkinen', phone: '03-1234567', email: 'hallitus@aytampere.fi', address: 'Hämeenkatu 12, 33100 Tampere', projectCount: 3, lastContact: '22.7.2026', status: 'Aktiivinen' },
  { id: 'AS-002', name: 'Rakennus Oy Helsinki', type: 'Yritys', contactPerson: 'Anna Lindqvist', phone: '09-2345678', email: 'anna@rakennusoy.fi', address: 'Mannerheimintie 25, 00100 Helsinki', projectCount: 4, lastContact: '21.7.2026', status: 'Aktiivinen' },
  { id: 'AS-003', name: 'Kiinteistöhuolto Keskus Oy', type: 'Yritys', contactPerson: 'Pekka Korhonen', phone: '09-3456789', email: 'pekka@khkeskus.fi', address: 'Fredrikinkatu 8, 00120 Helsinki', projectCount: 2, lastContact: '20.7.2026', status: 'Aktiivinen' },
  { id: 'AS-004', name: 'Perhe Korhonen', type: 'Yksityinen', contactPerson: 'Maria Korhonen', phone: '040-4567890', email: 'maria.korhonen@email.fi', address: 'Mäkitie 5, 90100 Oulu', projectCount: 2, lastContact: '18.7.2026', status: 'Aktiivinen' },
  { id: 'AS-005', name: 'Liisa Virtanen', type: 'Yksityinen', contactPerson: 'Liisa Virtanen', phone: '040-5678901', email: 'liisa.virtanen@email.fi', address: 'Koulutie 12, 01200 Vantaa', projectCount: 2, lastContact: '15.7.2026', status: 'Aktiivinen' },
  { id: 'AS-006', name: 'As Oy Hervanta', type: 'Taloyhtiö', contactPerson: 'Jukka Järvinen', phone: '03-6789012', email: 'hallitus@ayhervanta.fi', address: 'Insinöörinkatu 38, 33720 Tampere', projectCount: 2, lastContact: '19.7.2026', status: 'Aktiivinen' },
  { id: 'AS-007', name: 'Taloyhtiö Tähtipolku', type: 'Taloyhtiö', contactPerson: 'Sari Nieminen', phone: '08-7890123', email: 'hallitus@tahtipolku.fi', address: 'Tähtipolku 3, 90120 Oulu', projectCount: 1, lastContact: '10.7.2026', status: 'Aktiivinen' },
  { id: 'AS-008', name: 'Matti Meikäläinen', type: 'Yksityinen', contactPerson: 'Matti Meikäläinen', phone: '040-8901234', email: 'matti.meikalainen@email.fi', address: 'Espoonlahdenkatu 7, 02320 Espoo', projectCount: 2, lastContact: '17.7.2026', status: 'Aktiivinen' },
];

const typeIcon = (type: string) => {
  if (type === 'Yritys') return <Building2 size={16} className="text-info" />;
  if (type === 'Yksityinen') return <UserCircle size={16} className="text-success" />;
  return <Home size={16} className="text-warning" />;
};

export default function Asiakkaat() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Kaikki');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filtered = CUSTOMERS.filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'Kaikki' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Asiakkaat</h1>
        <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white"><Plus size={16} /> Lisää asiakas</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['Kaikki', 'Yritys', 'Yksityinen', 'Taloyhtiö'].map(type => (
          <Button key={type} variant={typeFilter === type ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(type)} className={typeFilter === type ? 'bg-primary' : ''}>
            {type}
          </Button>
        ))}
        <div className="flex-1" />
        <div className="relative w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input placeholder="Hae asiakkaita..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center"><Users size={20} className="text-primary" /></div><div><p className="text-sm text-text-muted">Yhteensä</p><p className="text-xl font-bold text-text-primary">{CUSTOMERS.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center"><Building2 size={20} className="text-info" /></div><div><p className="text-sm text-text-muted">Yritykset</p><p className="text-xl font-bold text-text-primary">{CUSTOMERS.filter(c => c.type === 'Yritys').length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center"><UserCircle size={20} className="text-success" /></div><div><p className="text-sm text-text-muted">Yksityiset</p><p className="text-xl font-bold text-text-primary">{CUSTOMERS.filter(c => c.type === 'Yksityinen').length}</p></div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nimi</TableHead>
                <TableHead>Tyyppi</TableHead>
                <TableHead>Yhteystieto</TableHead>
                <TableHead className="text-right">Projektit</TableHead>
                <TableHead>Viimeisin kontakti</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Toiminnot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><div className="flex items-center gap-1.5">{typeIcon(c.type)}<span>{c.type}</span></div></TableCell>
                  <TableCell>
                    <div className="text-sm"><div className="flex items-center gap-1"><Phone size={12} />{c.phone}</div><div className="flex items-center gap-1 text-text-muted"><Mail size={12} />{c.email}</div></div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{c.projectCount}</TableCell>
                  <TableCell>{c.lastContact}</TableCell>
                  <TableCell><Badge className={c.status === 'Aktiivinen' ? 'bg-success-light text-success' : 'bg-text-muted/20 text-text-muted'}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm"><Pencil size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedCustomer?.name}</DialogTitle></DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">{typeIcon(selectedCustomer.type)}<Badge>{selectedCustomer.type}</Badge></div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><UserCircle size={14} className="text-text-muted" />{selectedCustomer.contactPerson}</div>
                <div className="flex items-center gap-2"><Phone size={14} className="text-text-muted" />{selectedCustomer.phone}</div>
                <div className="flex items-center gap-2"><Mail size={14} className="text-text-muted" />{selectedCustomer.email}</div>
                <div className="flex items-center gap-2"><MapPin size={14} className="text-text-muted" />{selectedCustomer.address}</div>
                <div className="flex items-center gap-2"><FolderKanban size={14} className="text-text-muted" />{selectedCustomer.projectCount} projektia</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
