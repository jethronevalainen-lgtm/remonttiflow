import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface StubPageProps {
  title: string;
}

export default function StubPage({ title }: StubPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{title}</h2>
          <p className="text-gray-500 max-w-md">
            Tämä sivu on saatavilla. Sisältöä kehitetään jatkuvasti.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
