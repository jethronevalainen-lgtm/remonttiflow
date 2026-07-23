import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface StubPageProps {
  title: string;
}

export default function StubPage({ title }: StubPageProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <Construction className="w-16 h-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {title} - Tulossa pian
          </h2>
          <p className="text-gray-500 max-w-md">
            Tämä toiminnallisuus on kehityksessä. Palaamme asiaan pian!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
