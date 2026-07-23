import { Search, Bell, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tyonjohto': 'Työnjohto',
  '/projektit': 'Projektit',
  '/aikataulutus': 'Aikataulutus',
  '/paivakirjat': 'Päiväkirjat',
  '/laskenta': 'Laskenta',
  '/maaralaskenta': 'Määrälaskenta',
  '/jatehuolto': 'Jätehuolto',
  '/tyomaaraykset': 'Työmääräykset',
  '/tyovuorokalenteri': 'Työvuorokalenteri',
  '/tuntikirjaukset': 'Tuntikirjaukset',
  '/matkakulut': 'Matkakulut & Ajo',
  '/tyoturvallisuus': 'Työturvallisuus',
  '/crm': 'CRM',
  '/asiakkaat': 'Asiakkaat',
  '/ai': 'AI',
  '/viestinta': 'Viestintä',
  '/kalusto': 'Kalusto',
  '/henkilosto': 'Henkilöstö',
  '/lomakkeet': 'Lomakkeet',
  '/raportit': 'Raportit',
};

export default function Header() {
  const location = useLocation();
  const pageLabel = routeLabels[location.pathname] || 'Dashboard';

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-14 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 md:px-6 flex-shrink-0"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-muted font-medium hidden sm:inline">VaKantti</span>
        <ChevronRight size={14} className="text-text-muted hidden sm:inline" />
        <span className="text-text-primary font-semibold">{pageLabel}</span>
      </div>

      <div className="relative w-[200px] md:w-[280px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Hae..."
          className="w-full h-9 pl-9 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-all"
        />
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] text-text-secondary transition-colors">
          <Bell size={18} />
          <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[10px] bg-danger text-white border-0 flex items-center justify-center">3</Badge>
        </button>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
          <span className="text-sm font-medium text-text-primary">FI</span>
        </div>
        <button className="w-9 h-9 rounded-full bg-primary-light border border-primary/20 flex items-center justify-center hover:bg-primary/10 transition-colors">
          <span className="text-sm font-semibold text-primary">MM</span>
        </button>
      </div>
    </motion.header>
  );
}
