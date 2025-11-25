import { useEffect, useState } from 'react';
import ProteinProductsTable from '@/components/protein/ProteinProductsTable';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Protein() {
  usePageTitle('Protein | SupplementSmarter');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className='bg-white text-black'>
      {loading ? (
        <div className='flex min-h-[60vh] items-center justify-center'>
          <div className='flex gap-1.5'>
            <span className='h-2 w-2 rounded-full bg-black/50 animate-bounce [animation-delay:-0.15s]' />
            <span className='h-2 w-2 rounded-full bg-black/50 animate-bounce' />
            <span className='h-2 w-2 rounded-full bg-black/50 animate-bounce [animation-delay:0.15s]' />
          </div>
        </div>
      ) : (
        <ProteinProductsTable />
      )}
    </div>
  );
}
