import Hero from '@/components/home/Hero';
import HowItWorks from '@/components/home/HowItWorks';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Home() {
  usePageTitle('SupplementSmarter');

  return (
    <>
      <Hero />
      <HowItWorks />
    </>
  );
}
