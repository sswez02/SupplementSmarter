// src/layouts/RootLayout.tsx
import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Nav from '@/components/Navbar';
import Footer from './Footer';

export default function RootLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [showFooter, setShowFooter] = useState(false);

  useEffect(() => {
    setShowFooter(false);
    const t = setTimeout(() => setShowFooter(true), 2000);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className='min-h-screen flex flex-col bg-white'>
      <Nav />

      <main className={`${isHome ? '' : 'pt-16'} flex-1 bg-white`}>
        <Outlet />
      </main>

      <div
        className={`relative z-20 transition-opacity duration-500 ${
          showFooter ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Footer />
      </div>
    </div>
  );
}
