import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CRM() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">CRM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
          <p className="text-sm text-gray-500 mt-1">Asiakassuhteiden hallinta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <Plus size={16} /> Uusi kontakti
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Myyntimahdollisuudet', value: '8', icon: Briefcase },
          { label: 'Arvo yhteensä', value: '€245 000', icon: Briefcase },
          { label: 'Onnistumisprosentti', value: '64%', icon: Briefcase },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                    <stat.icon size={20} className="text-orange-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 font-mono">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Placeholder Content */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <Briefcase size={18} className="text-orange-500" />
            Myyntiputki
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">CRM</h2>
          <p className="text-gray-500 max-w-md">
            Asiakassuhteiden hallintaa kehitetään. Täällä näet pian myyntimahdollisuudet ja kontaktit.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
