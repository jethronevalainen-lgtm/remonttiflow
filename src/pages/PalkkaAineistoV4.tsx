import PayrollCorrectionsPanel from './payrollCorrections/PayrollCorrectionsPanel';
import PalkkaAineistoV3 from './PalkkaAineistoV3';

export default function PalkkaAineistoV4() {
  return (
    <div className="space-y-10">
      <PalkkaAineistoV3 />
      <PayrollCorrectionsPanel />
    </div>
  );
}
