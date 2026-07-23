import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Tyomaaraykset() {
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
            <span className="text-gray-900 font-medium">Työmääräykset</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Työmääräykset</h1>
          <p className="text-sm text-gray-500 mt-1">Työmääräysten hallinta ja seuranta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <Plus size={16} /> Uusi työmääräys
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Avoimet määräykset', value: '15', icon: Wrench },
          { label: 'Tällä viikolla', value: '7', icon: Wrench },
          { label: 'Valmiit', value: '42', icon: Wrench },
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
            <Wrench size={18} className="text-orange-500" />
            Työmääräyslista
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Työmääräykset</h2>
          <p className="text-gray-500 max-w-md">
            Työmääräysten hallintaa kehitetään. Täällä näet pian avoimet ja valmistuneet työmääräykset.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
