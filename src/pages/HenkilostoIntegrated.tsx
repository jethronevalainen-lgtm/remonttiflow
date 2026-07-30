import { motion } from 'framer-motion';
import { Building2, UsersRound } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import EmployeeRegistryWithPay from './EmployeeRegistryWithPay';
import HrCenter from './hr/HrCenter';

export default function HenkilostoIntegrated() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Tabs defaultValue="hr" className="space-y-5">
        <TabsList className="h-auto w-full max-w-xl grid-cols-2 rounded-xl bg-slate-100 p-1 sm:grid">
          <TabsTrigger value="hr" className="gap-2"><Building2 size={16} />HR-keskus</TabsTrigger>
          <TabsTrigger value="registry" className="gap-2"><UsersRound size={16} />Henkilörekisteri</TabsTrigger>
        </TabsList>
        <TabsContent value="hr" className="mt-0">
          <HrCenter />
        </TabsContent>
        <TabsContent value="registry" className="mt-0">
          <EmployeeRegistryWithPay />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
