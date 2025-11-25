import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import PriceGlow from '@/assets/stocks/gradient_background.png';
import ProteinHistoryChart from './ProteinHistoryChart';

type OfferRow = {
  retailer: string;
  subtitle?: string | null; // optional flavour list e.g. "Chocolate, Vanilla, Strawberry"
  url?: string;
  priceCents: number;
  currencySymbol: string;
};

type PriceSummary = {
  priceCents: number;
  currencySymbol?: string;
  dateISO?: string; // 'YYYY-MM-DD'
  store?: string;
  retailer?: string;
};

type HistoryRow = {
  date: string; // 'YYYY-MM-DD'
  retailer: string;
  priceCents: number;
};

type DetailResponse = {
  product: {
    productId: number;
    brand: string | null;
    name: string | null;
    weightGrams: number | null;
    currency: string;
  };
  offers: OfferRow[];
  history: HistoryRow[];
  allTimeLow: PriceSummary | null;
  currentLow: PriceSummary | null;
};

/* Helpers */
function formatPrice(cents: number, symbol = '$'): string {
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatDateISO(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function extractFlavours(o: OfferRow): string[] {
  if (!o.subtitle) return [];
  return o.subtitle
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function openStoreInNewTab(row: { url?: string; retailer: string }) {
  if (!row.url) return;
  window.open(row.url, '_blank', 'noopener');
}

// Fallback
function guessFlavour(o: OfferRow): string {
  const src = (o.subtitle ?? '').toLowerCase();
  if (src.includes('chocolate') || src.includes('choc')) return 'Chocolate';
  if (src.includes('vanilla')) return 'Vanilla';
  if (src.includes('banana')) return 'Banana';
  if (src.includes('peanut')) return 'Choc Peanut';
  return o.subtitle || 'Unflavoured';
}

function FlavourPill({ flavour }: { flavour: string }) {
  return (
    <span className='inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black/70'>
      {flavour}
    </span>
  );
}

export default function ProductDetail() {
  const navigate = useNavigate();
  const { productSlug } = useParams<{ productSlug: string }>(); // reads productSlug from the URL
  const [detail, setDetail] = useState<DetailResponse | null>(null); // product details from our API
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On productSlug change, fetch new productSlug
  useEffect(() => {
    if (!productSlug) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/protein/${productSlug}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DetailResponse;
        if (!cancelled) {
          setDetail(data);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('Error loading product detail', e);
          setError('Failed to load product detail');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productSlug]);

  // Build a title with brand + name + weight
  const title =
    detail?.product?.brand && detail.product.name
      ? `${detail.product.brand} ${detail.product.name}${
          detail.product.weightGrams ? ` ${detail.product.weightGrams / 1000}kg` : ''
        }`
      : productSlug
      ? `Product ${productSlug}`
      : 'Product';

  // Group offers by retailer
  const grouped = useMemo<[string, OfferRow[]][]>(() => {
    if (!detail?.offers) return [];
    const map = new Map<string, OfferRow[]>();
    for (const o of detail.offers) {
      if (!map.has(o.retailer)) map.set(o.retailer, []);
      map.get(o.retailer)!.push(o);
    }
    return Array.from(map.entries());
  }, [detail]);

  // One row per retailer, merge all flavours + retailer cheapest price
  const retailerRows = useMemo(
    () =>
      grouped.map(([retailer, variants]) => {
        const flavourSet = new Set<string>();
        let best: OfferRow | null = variants[0] ?? null;

        // Loops over all offers for one retailer, finds all flavours
        for (const o of variants) {
          const flavours = extractFlavours(o);
          if (flavours.length) {
            flavours.forEach((f) => flavourSet.add(f));
          } else {
            flavourSet.add(guessFlavour(o));
          }

          if (!best || o.priceCents < best.priceCents) {
            best = o;
          }
        }

        return {
          retailer: retailer,
          flavours: Array.from(flavourSet),
          priceCents: best?.priceCents ?? null,
          currencySymbol: best?.currencySymbol ?? '$',
          url: best?.url,
        };
      }),
    [grouped]
  );

  const retailerCount = retailerRows.length;
  const allTime = detail?.allTimeLow ?? null;
  const currentMin = detail?.currentLow ?? null;
  const history = detail?.history ?? [];

  const allTimeStore = allTime?.store ?? allTime?.retailer ?? '';
  const currentStore = currentMin?.store ?? currentMin?.retailer ?? '';

  // Lowest current price retailer for row highlight
  const bestRetailer = currentStore || null;

  // Go to protein list on back button
  function handleBack() {
    navigate('/protein');
  }

  // Loading UI
  if (loading) {
    return (
      <div className='mx-auto px-2 sm:px-4 pt-4 pb-8 sm:pt-8 max-w-6xl lg:max-w-7xl xl:max-w-screen-7xl'>
        <p className='text-sm text-black/50'>Loading…</p>
      </div>
    );
  }

  // Error UI
  if (error || !detail) {
    return (
      <div className='mx-auto px-2 sm:px-4 pt-4 pb-8 sm:pt-8 max-w-6xl lg:max-w-7xl xl:max-w-screen-7xl'>
        <button
          onClick={handleBack}
          className='mb-4 text-sm text-black/60 hover:text-black transition cursor-pointer md:hidden'
        >
          Back
        </button>
        <p className='text-sm text-red-600'>{error || 'Product not found'}</p>
      </div>
    );
  }

  return (
    <div className='mx-auto px-2 sm:px-4 pb-8 sm:pt-8 max-w-6xl lg:max-w-7xl xl:max-w-screen-7xl'>
      {/* Back + title */}
      <div className='relative z-10 mb-4'>
        {/* Mobile layout */}
        <button
          onClick={handleBack}
          className='mb-2 text-sm text-black/60 hover:text-black transition cursor-pointer md:hidden'
        >
          Back
        </button>

        {/* Desktop layout */}
        <div className='flex items-center justify-between mt-8 md:mt-0'>
          <button
            onClick={handleBack}
            className='hidden md:inline-block text-sm text-black/60 hover:text-black transition cursor-pointer'
          >
            Back
          </button>
          <h1 className='text-2xl font-bold text-center'>{title}</h1>
          <span className='w-[68px]' />
        </div>
      </div>

      <p className='relative z-10 mb-6 text-center text-[15px] leading-[1.9] tracking-[0.01em] text-[#8288a8]'>
        Comparing prices from {retailerCount} retailer{retailerCount === 1 ? '' : 's'}
      </p>

      {/* Table */}
      <div className='relative'>
        <div className='relative z-10 bg-white'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left border-separate border-spacing-y-4 min-w-full md:min-w-[640px]'>
              <thead>
                <tr className='text-sm text-black/60'>
                  <th className='font-medium px-2 whitespace-nowrap'>Store</th>
                  <th className='font-medium px-2'>Flavours</th>
                  <th className='font-medium px-2'>Price</th>
                  <th className='font-medium px-2'>Visit</th>
                </tr>
              </thead>
              <tbody className='text-black text-sm'>
                {retailerRows.map((row, idx) => {
                  const isBest = bestRetailer && row.retailer === bestRetailer;
                  const rowBg = isBest
                    ? 'bg-gray-50 group-hover:bg-gray-100'
                    : 'group-hover:bg-gray-50';

                  return (
                    <tr
                      key={`${row.retailer}-${idx}`}
                      className='group cursor-pointer'
                      onClick={() => openStoreInNewTab(row)}
                      onAuxClick={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          openStoreInNewTab(row);
                        }
                      }}
                      title={`Open ${row.retailer} in new tab`}
                    >
                      {/* Retailer  */}
                      <td
                        className={`py-4 px-2 font-bold rounded-l-md transition-colors whitespace-nowrap ${rowBg}`}
                      >
                        {row.retailer}
                      </td>

                      {/* Flavours */}
                      <td className={`px-2 transition-colors ${rowBg}`}>
                        {row.flavours.length ? (
                          <div className='flex flex-wrap gap-1.5'>
                            {row.flavours.map((f, fIdx) => (
                              <FlavourPill key={`${row.retailer}-${f}-${fIdx}`} flavour={f} />
                            ))}
                          </div>
                        ) : (
                          <span className='text-black/30'>—</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className={`px-2 font-semibold text-pink-600 transition-colors ${rowBg}`}>
                        {row.priceCents != null
                          ? formatPrice(row.priceCents, row.currencySymbol)
                          : '—'}
                      </td>

                      {/* Visit */}
                      <td className={`px-2 rounded-r-md transition-colors ${rowBg}`}>
                        <a
                          href={row.url || '#'}
                          onClick={(e) => e.stopPropagation()}
                          className='inline-flex items-center justify-center rounded-full p-2 hover:bg-black/5 transition'
                          aria-label={`Visit ${row.retailer}`}
                          target='_blank'
                          rel='noopener'
                        >
                          <Globe size={16} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className='relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4'>
        {/* All-time low card */}
        <div className='rounded-3xl bg-white ring-1 ring-[#6D728E]/20 p-6 text-center'>
          <div className='text-[#6D728E]'>
            Lowest price <span className='font-semibold text-black/70'>all time</span>
          </div>
          <div className='mt-1 text-2xl font-bold text-black/70'>
            {allTime ? formatPrice(allTime.priceCents, allTime.currencySymbol ?? '$') : '—'}
          </div>
          <div className='mt-1 text-xs text-black/30'>
            {allTime?.dateISO ? formatDateISO(allTime.dateISO) : ''}
          </div>
          <div className='mt-3 text-sm text-black/60'>{allTimeStore}</div>
        </div>
        {/* Current low card */}
        <div
          className='relative rounded-3xl border-[3px] border-transparent p-6 text-center overflow-hidden'
          style={{
            background:
              'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #F78EAA 0%, #FFBBD5 55%, #FF8709 100%) border-box',
          }}
        >
          <img
            src={PriceGlow}
            alt=''
            aria-hidden='true'
            className='absolute inset-0 h-full w-full object-cover opacity-30 pointer-events-none select-none'
          />
          <div className='relative'>
            <div className='text-[#6D728E]'>
              Lowest price{' '}
              <span
                className='font-semibold text-transparent bg-clip-text'
                style={{
                  backgroundImage: 'linear-gradient(90deg, #F78EAA 0%, #F78EAA 47%, #FF8709 100%)',
                }}
              >
                now
              </span>
            </div>
            <div className='mt-1 text-2xl font-bold leading-[1.1]'>
              <span
                className='bg-clip-text text-transparent'
                style={{
                  backgroundImage: 'linear-gradient(90deg, #F78EAA 0%, #F78EAA 75%, #FF8709 100%)',
                }}
              >
                {currentMin
                  ? formatPrice(currentMin.priceCents, currentMin.currencySymbol ?? '$')
                  : '—'}
              </span>
            </div>
            <div className='mt-3 text-sm text-black/60'>{currentStore}</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ProteinHistoryChart rows={history} />
    </div>
  );
}
