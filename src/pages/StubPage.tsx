import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from 'react-router-dom';

export default function StubPage() {
  const location = useLocation();
  const pageName = location.pathname.replace('/', '').replace(/-/g, ' ');
  const displayName = pageName.charAt(0).toUpperCase() + pageName.slice(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{displayName}</h1>
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-text-secondary">Sivun sisältö tulossa pian.</p>
        </CardContent>
      </Card>
    </div>
  );
}
