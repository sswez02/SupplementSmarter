import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import CreatineHistoryTable from '@/components/creatine/CreatineHistoryTable';
import { usePageTitle } from '@/hooks/usePageTitle';

type Product = {
  brand: string | null;
  name: string | null;
};

export default function CreatineHistory() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!productSlug) return;

    (async () => {
      try {
        const res = await fetch(`/api/creatine/${productSlug}`);
        if (!res.ok) {
          console.error('Failed to fetch creatine product', res.status);
          return;
        }
        const data = await res.json();
        setProduct(data.product);
      } catch (err) {
        console.error('Error fetching /api/creatine/:slug', err);
      }
    })();
  }, [productSlug]);

  const baseTitle = 'SupplementSmarter';
  const productTitle =
    product && (product.brand || product.name)
      ? `${product.brand ?? ''} ${product.name ?? ''} – Price comparison | ${baseTitle}`
      : `Loading product… | ${baseTitle}`;

  usePageTitle(productTitle);

  return (
    <main className='min-h-screen bg-white text-black pt-14 md:pt-16'>
      <Navbar />
      <CreatineHistoryTable />
    </main>
  );
}
