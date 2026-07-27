import ReportCenter from '@/components/reports/ReportCenter';

import Raportit from './Raportit';

export default function RaportitV2() {
  return (
    <div className="space-y-10">
      <ReportCenter />
      <div className="border-t border-slate-200 pt-8">
        <Raportit />
      </div>
    </div>
  );
}
