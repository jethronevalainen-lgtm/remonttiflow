import { motion } from 'framer-motion';
import { Trash2, Recycle, AlertTriangle, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const wasteData = [
  { type: 'Sekajäte', amount: 450, method: 'Kaatopaikka', cost: 890 },
  { type: 'Metalli', amount: 320, method: 'Kierrätys', cost: 0 },
  { type: 'Puujäte', amount: 280, method: 'Kierrätys', cost: 150 },
  { type: 'Vaarallinen', amount: 45, method: 'Erik. käsittely', cost: 1250 },
  { type: 'Maajäte', amount: 1200, method: 'Kaatopaikka', cost: 2100 },
  { type: 'Betoni', amount: 850, method: 'Kierrätys', cost: 300 },
  { type: 'Eristejäte', amount: 120, method: 'Kaatopaikka', cost: 480 },
  { type: 'Laatat', amount: 200, method: 'Kierrätys', cost: 100 },
];

const chartData = [
  { name: 'Sekajäte', amount: 450 },
  { name: 'Metalli', amount: 320 },
  { name: 'Puujäte', amount: 280 },
  { name: 'Vaarallinen', amount: 45 },
  { name: 'Maajäte', amount: 1200 },
  { name: 'Betoni', amount: 850 },
  { name: 'Eristejäte', amount: 120 },
  { name: 'Laatat', amount: 200 },
];

const totalWaste = wasteData.reduce((sum, w) => sum + w.amount, 0);
const recycled = wasteData.filter(w => w.method === 'Kierrätys').reduce((sum, w) => sum + w.amount, 0);
const recyclingRate = Math.round((recycled / totalWaste) * 100);

export default function Jatehuolto() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Jätehuolto</h1>
        <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white">
          <FileSpreadsheet size={16} /> Raportti
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center">
              <Trash2 size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Kokonaisjäte</p>
              <p className="text-xl font-bold text-text-primary">{totalWaste} kg</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center">
              <Recycle size={20} className="text-success" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Kierrätetty</p>
              <p className="text-xl font-bold text-text-primary">{recycled} kg</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center">
              <TrendingUp size={20} className="text-info" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Kierrätysaste</p>
              <p className="text-xl font-bold text-text-primary">{recyclingRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-danger-light flex items-center justify-center">
              <AlertTriangle size={20} className="text-danger" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Vaarallinen jäte</p>
              <p className="text-xl font-bold text-text-primary">45 kg</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Jätteet tyypin mukaan (kg)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="amount" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Jäteloki</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-[#E2E8F0]">
                <th className="pb-2 font-medium">Jätteen laji</th>
                <th className="pb-2 font-medium text-right">Määrä (kg)</th>
                <th className="pb-2 font-medium">Käsittely</th>
                <th className="pb-2 font-medium text-right">Kustannus</th>
              </tr>
            </thead>
            <tbody>
              {wasteData.map((w, i) => (
                <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-[#F1F5F9]">
                  <td className="py-2 text-text-primary">{w.type}</td>
                  <td className="py-2 text-right font-mono">{w.amount}</td>
                  <td className="py-2">
                    <Badge variant={w.method === 'Kierrätys' ? 'default' : 'secondary'} className={w.method === 'Kierrätys' ? 'bg-success-light text-success border-success' : ''}>
                      {w.method}
                    </Badge>
                  </td>
                  <td className="py-2 text-right font-mono">{w.cost} €</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
