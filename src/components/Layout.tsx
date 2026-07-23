import { useState } from 'react';
import Header from './Header';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMenuToggle={() => setIsNavOpen(!isNavOpen)} />
      <div className="flex">
        <Navbar isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
