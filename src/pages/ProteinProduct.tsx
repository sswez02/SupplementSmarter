import Navbar from '@/components/Navbar';
import ProteinHistoryTable from '@/components/protein/ProteinHistoryTable';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiFetch } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Product = {
  brand: string | null;
  name: string | null;
};

export default function ProteinHistory() {
  const { productSlug } = useParams<{ productSlug: string }>();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!productSlug) return;

    (async () => {
      try {
        const data = await apiFetch<{ product: Product }>(`/api/protein/${productSlug}`);
        setProduct(data.product);
      } catch (err) {
        console.error('Error fetching /api/protein/:slug', err);
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
      <ProteinHistoryTable />
    </main>
  );
}
