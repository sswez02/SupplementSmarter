import React, { useEffect, useMemo, useRef, useState } from 'react';
import Logos from '@/assets/stocks/logos.png';
import CTA from '@/components/home/CTA';

export default function HowItWorks() {
  return (
    <section className='pt-10 md:pt-14 pb-20 md:pb-28'>
      <div className='mx-auto max-w-6xl lg:max-w-7xl xl:max-w-screen-2xl px-5 sm:px-6 md:px-8'>
        {/* Heading */}
        <h2 className='font-king text-[40px] sm:text-[48px] md:text-[56px] leading-[110%] tracking-[-0.05em] text-stroke'>
          How it works
        </h2>
        <p className='mt-3 max-w-2xl font-[Arial] text-[16px] sm:text-[18px] leading-[110%] tracking-[0] text-primary'>
          Easily find the lowest supplement prices in just a few clicks. Instantly compare trusted
          retailers and shop smarter for your wallet.
        </p>

        {/* Two steps */}
        <div className='mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-18 items-start'>
          {/* Step 1 – choose type / filters demo */}
          <div className='relative'>
            <div className='relative w-full rounded-3xl sm:rounded-[28px] overflow-hidden sm:aspect-video'>
              <FilterDemoMini />
            </div>
          </div>

          {/* Step 2 – compare prices mini UI */}
          <div className='relative md:transform md:translate-y-12 lg:translate-y-24'>
            <div className='relative w-full rounded-3xl sm:rounded-[28px] overflow-hidden sm:aspect-video'>
              <ComparePricesMini />
            </div>

            <h3 className='mt-6 text-lg sm:text-xl md:text-2xl font-bold'>
              Compare prices instantly
            </h3>
            <p className='mt-2 mb-8 md:mb-12 font-[Arial] text-[16px] sm:text-[18px] leading-[110%] tracking-[0] text-primary'>
              We pull in prices from top NZ supplement stores so you can see who&apos;s cheapest at
              a glance and click straight through.
            </p>
          </div>
        </div>

        {/* Collage image + CTA */}
        <div className='mt-24 md:mt-32 text-center'>
          <img
            src={Logos}
            alt='Popular supplement brand logos collage'
            className='mx-auto w-full max-w-[70%] md:max-w-[52%] rounded-2xl'
            loading='lazy'
            decoding='async'
            draggable='false'
          />

          <p className='mt-8 text-base font-[Arial] text-[16px] sm:text-[18px] leading-[110%] tracking-[0] text-primary'>
            Discover your favourite supplement brands
          </p>

          <div className='mt-6 flex justify-center'>
            <CTA variant='black' />
          </div>
        </div>
      </div>
    </section>
  );
}

/* Step 1 */

type MiniRow = {
  id: number;
  brand: string;
  product: string;
  weightKg: number;
  flavours: string[];
  priceCents: number;
  valueScore: number;
};

const MINI_ROWS: MiniRow[] = [
  {
    id: 1,
    brand: 'Optimum Nutrition',
    product: 'Gold Standard 100% Whey',
    weightKg: 2.27,
    flavours: ['Chocolate', 'Vanilla'],
    priceCents: 7999,
    valueScore: 100,
  },
  {
    id: 2,
    brand: 'NZProtein',
    product: 'NZ Whey',
    weightKg: 1,
    flavours: ['Chocolate', 'Banana'],
    priceCents: 3995,
    valueScore: 93,
  },
  {
    id: 3,
    brand: 'Ghost',
    product: 'Whey Protein',
    weightKg: 0.9,
    flavours: ['Chocolate', 'Cereal Milk'],
    priceCents: 5999,
    valueScore: 82,
  },
];

const DEMO_WEIGHT_OPTIONS = [
  { id: '', label: 'All weights' },
  { id: '0-0.5', label: '0–0.5 kg' },
  { id: '0.5-1', label: '0.5–1 kg' },
  { id: '1-2', label: '1–2 kg' },
  { id: '2-3', label: '1–3 kg' },
] as const;

function demoWeightMatches(weightKg: number, bucketId: string) {
  if (!bucketId) return true;
  if (bucketId === '0-0.5') return weightKg >= 0 && weightKg < 0.5;
  if (bucketId === '0.5-1') return weightKg >= 0.5 && weightKg < 1;
  if (bucketId === '1-2') return weightKg >= 1 && weightKg < 2;
  if (bucketId === '2-3') return weightKg >= 1 && weightKg <= 3;
  return true;
}

function formatKgMini(kg: number) {
  return `${Number(kg).toString().replace(/\.0$/, '')} kg`;
}

function formatPriceMini(cents: number, symbol = '$') {
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

type DropdownOption = { value: string; label: string };

type MiniDropdownProps = {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder: string;
};

function MiniDropdown({ value, onChange, options, placeholder }: MiniDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const active = Boolean(value);
  const current = options.find((o) => o.value === value) || null;
  const display = current?.label ?? placeholder;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const visibleOptions = options;

  function openMenu() {
    setOpen(true);
    if (current) {
      const idx = visibleOptions.findIndex((o) => o.value === current.value);
      setHighlightIdx(idx >= 0 ? idx : 0);
    } else {
      setHighlightIdx(0);
    }
  }

  function handleSelect(option: DropdownOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      openMenu();
      return;
    }

    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => {
        const next = prev == null ? 0 : Math.min(prev + 1, visibleOptions.length - 1);
        return next;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => {
        const next = prev == null ? visibleOptions.length - 1 : Math.max(prev - 1, 0);
        return next;
      });
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightIdx != null && visibleOptions[highlightIdx]) {
        handleSelect(visibleOptions[highlightIdx]);
      }
    }
  }

  return (
    <div ref={ref} className='relative w-full' tabIndex={0} onKeyDown={handleKeyDown}>
      <div
        className={`w-full rounded-full bg-white px-3 pr-7 py-1.5 text-xs font-normal text-black/70 cursor-pointer
          transition border shadow-[0_0_0_0_rgba(120,116,255,0)]
          ${active ? 'border-[#D1D4E4]' : 'border-transparent hover:border-[#E1E4F0]'}
          focus:outline-none`}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {display}
        <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-black/40'>
          ▾
        </span>
      </div>

      {open && (
        <div className='absolute left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl bg-white text-xs text-black shadow-[0_4px_18px_rgba(15,23,42,0.10)] border border-[#E1E4F0] z-20'>
          {visibleOptions.map((opt, idx) => {
            const highlighted = idx === highlightIdx;
            return (
              <button
                key={opt.value || opt.label}
                type='button'
                className={`w-full text-left px-3 py-1.5 cursor-pointer
                  ${highlighted ? 'bg-[#F5F6FB]' : 'bg-white'}
                  font-normal`}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => handleSelect(opt)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SEARCH_TEXT = 'gold standard whey';

function FilterDemoMini() {
  const [step, setStep] = useState(0);
  const [brandFilter, setBrandFilter] = useState('');
  const [weightFilter, setWeightFilter] = useState('');
  const [flavourFilter, setFlavourFilter] = useState('');
  const [typedText, setTypedText] = useState('');
  const [clickPulseStep, setClickPulseStep] = useState<number | null>(null);

  const [hasEntered, setHasEntered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const brandWrapRef = useRef<HTMLDivElement | null>(null);
  const weightWrapRef = useRef<HTMLDivElement | null>(null);
  const flavourWrapRef = useRef<HTMLDivElement | null>(null);
  const rowPriceRef = useRef<HTMLTableCellElement | null>(null);

  const [cursorPos, setCursorPos] = useState<{ left: number; top: number } | null>(null);

  // Detect mobile once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const handleMouseEnter = () => {
    if (isMobile) return; // no hover animation on mobile
    setHasEntered(true);
    setStep(0); // restart sequence each hover
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setHasEntered(false);
  };

  // Desktop only
  useEffect(() => {
    if (!hasEntered || isMobile) return;

    let delay = 600;
    if (step === 0) delay = 2600; // typing
    // Filters
    else if (step === 1) delay = 1000;
    else if (step === 2) delay = 1000;
    else if (step === 3) delay = 1000;
    else if (step === 4) delay = 1600; // price

    const t = window.setTimeout(() => {
      setStep((prev) => (prev + 1) % 5);
    }, delay);

    setClickPulseStep(step);
    const clickTimeout = window.setTimeout(() => setClickPulseStep(null), 280);

    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clickTimeout);
    };
  }, [step, hasEntered, isMobile]);

  // Apply filters per step on desktop, mobile just shows final state
  useEffect(() => {
    if (isMobile) {
      setBrandFilter('Optimum Nutrition');
      setWeightFilter('2-3');
      setFlavourFilter('Chocolate');
      return;
    }
    if (!hasEntered) return;

    if (step === 0) {
      setBrandFilter('');
      setWeightFilter('');
      setFlavourFilter('');
    } else if (step === 1) {
      setBrandFilter('Optimum Nutrition');
      setWeightFilter('');
      setFlavourFilter('');
    } else if (step === 2) {
      setBrandFilter('Optimum Nutrition');
      setWeightFilter('2-3');
      setFlavourFilter('');
    } else {
      setBrandFilter('Optimum Nutrition');
      setWeightFilter('2-3');
      setFlavourFilter('Chocolate');
    }
  }, [step, hasEntered, isMobile]);

  // Typing effect: static text on mobile, animated on desktop
  useEffect(() => {
    if (isMobile) {
      setTypedText(SEARCH_TEXT);
      return;
    }

    if (!hasEntered) {
      setTypedText('');
      return;
    }

    if (step !== 0) {
      setTypedText(SEARCH_TEXT);
      return;
    }

    setTypedText('');
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setTypedText(SEARCH_TEXT.slice(0, i));
      if (i >= SEARCH_TEXT.length) {
        window.clearInterval(interval);
      }
    }, 80);

    return () => window.clearInterval(interval);
  }, [step, hasEntered, isMobile]);

  const brandOptions: DropdownOption[] = useMemo(() => {
    const set = new Set<string>();
    MINI_ROWS.forEach((r) => set.add(r.brand));
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All brands' }, ...sorted.map((b) => ({ value: b, label: b }))];
  }, []);

  const weightOptions: DropdownOption[] = DEMO_WEIGHT_OPTIONS.map((b) => ({
    value: b.id,
    label: b.label,
  }));

  const flavourOptions: DropdownOption[] = useMemo(() => {
    const set = new Set<string>();
    MINI_ROWS.forEach((r) => r.flavours.forEach((f) => set.add(f)));
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All flavours' }, ...sorted.map((f) => ({ value: f, label: f }))];
  }, []);

  const filteredRows = useMemo(() => {
    return MINI_ROWS.filter((row) => {
      const brandMatch = brandFilter ? row.brand === brandFilter : true;
      const weightMatch = weightFilter ? demoWeightMatches(row.weightKg, weightFilter) : true;
      const flavourMatch = flavourFilter ? row.flavours.some((f) => f === flavourFilter) : true;
      return brandMatch && weightMatch && flavourMatch;
    });
  }, [brandFilter, weightFilter, flavourFilter]);

  const highlightRowId = isMobile || step >= 3 ? 1 : null;

  // Cursor animation – desktop only
  useEffect(() => {
    if (!hasEntered || isMobile) return;

    function updateCursorPos() {
      if (!containerRef.current) return;

      let target: HTMLElement | null = null;

      if (step === 0) {
        target = searchRef.current || null;
      } else if (step === 1) {
        target = brandWrapRef.current || null;
      } else if (step === 2) {
        target = weightWrapRef.current || null;
      } else if (step === 3) {
        target = flavourWrapRef.current || null;
      } else if (step === 4) {
        target = rowPriceRef.current || null;
      }

      if (!target) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const left =
        targetRect.left - containerRect.left + targetRect.width * (step === 4 ? 0.82 : 0.8);
      const top = targetRect.top - containerRect.top + targetRect.height * 0.55;

      setCursorPos({ left, top });
    }

    updateCursorPos();
    window.addEventListener('resize', updateCursorPos);
    return () => window.removeEventListener('resize', updateCursorPos);
  }, [step, brandFilter, weightFilter, flavourFilter, filteredRows.length, hasEntered, isMobile]);

  const translateY =
    step === 0 ? 'translateY(0px)' : step === 4 ? 'translateY(-3px)' : 'translateY(-1px)';
  const scale = !hasEntered && !isMobile ? 0.98 : 1;

  return (
    <div
      ref={containerRef}
      className='relative h-full w-full'
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className='relative sm:absolute sm:inset-3 mx-2 my-2 sm:m-0 rounded-3xl bg-white border border-[#E5E6F0] px-2.5 sm:px-3.5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 flex flex-col'
        style={{
          transform: `${translateY} scale(${scale})`,
          transition: 'transform 900ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Heading line */}
        <div className='mb-3 flex justify-center'>
          <p className='text-[11px] sm:text-[12px] text-center'>
            <span
              style={{
                fontFamily: '"King and Queen", system-ui, sans-serif',
              }}
              className='text-[#80839A]'
            >
              Want a specific product{' '}
              <span
                style={{
                  fontFamily: '"Kings", system-ui, sans-serif',
                  display: 'inline-block',
                  fontSize: '1.35em',
                }}
              >
                ?
              </span>{' '}
              Apply{' '}
            </span>
            <span
              style={{
                fontFamily: '"King and Queen", system-ui, sans-serif',
              }}
              className='bg-linear-to-r from-[#B28CFF] via-[#FF4FA3] to-[#FFA24F] bg-clip-text text-transparent'
            >
              filters
            </span>
            <span
              style={{
                fontFamily: '"King and Queen", system-ui, sans-serif',
              }}
              className='text-[#80839A]'
            >
              {' '}
              to refine the list
            </span>
          </p>
        </div>

        {/* Search + tabs block */}
        <div className='rounded-2xl bg-white/90 px-2.5 sm:px-3 py-2'>
          {/* Search bar */}
          <div ref={searchRef} className='relative mb-2'>
            <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/45'>
              <svg width='18' height='18' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                <path
                  d='M21 21l-4.2-4.2'
                  stroke='currentColor'
                  strokeWidth='1.8'
                  strokeLinecap='round'
                />
                <circle cx='10.5' cy='10.5' r='6.5' stroke='currentColor' strokeWidth='1.8' />
              </svg>
            </span>
            <input
              type='search'
              readOnly
              value={typedText}
              className='w-full h-9 rounded-2xl bg-white pl-10 pr-4 text-[11px] text-black/80 placeholder-black/35 outline-none border border-[#E0E3ED] focus:bg-white focus:border-[#D0D3E4] transition'
              placeholder='Search protein products'
            />
          </div>

          {/* Protein / Creatine tabs */}
          <div className='relative mt-2 rounded-2xl bg-[#F3F5FA] flex items-center h-8 border border-[#E5E6F0] overflow-hidden'>
            <div className='relative flex h-7 mx-1 w-full rounded-2xl'>
              <span
                aria-hidden
                className={[
                  'absolute inset-y-0 left-0 w-1/2 rounded-xl bg-white',
                  'transform transition-transform duration-300 ease-out',
                  'translate-x-0',
                ].join(' ')}
              />
              <div className='relative z-10 flex w-full h-full gap-1 text-[11px] font-medium'>
                <span className='flex-1 flex items-center justify-center rounded-xl text-black'>
                  Protein
                </span>
                <span className='flex-1 flex items-center justify-center rounded-xl text-black/60'>
                  Creatine
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className='mt-3 flex flex-wrap gap-2 text-xs'>
            <div
              ref={brandWrapRef}
              className={`w-[150px] sm:w-[150px] transition-transform ${
                step === 1 ? 'scale-[1.03]' : 'scale-100'
              } pointer-events-none sm:pointer-events-auto`}
            >
              <MiniDropdown
                value={brandFilter}
                onChange={setBrandFilter}
                options={brandOptions}
                placeholder='All brands'
              />
            </div>
            <div
              ref={weightWrapRef}
              className={`w-[130px] transition-transform ${
                step === 2 ? 'scale-[1.03]' : 'scale-100'
              } pointer-events-none sm:pointer-events-auto`}
            >
              <MiniDropdown
                value={weightFilter}
                onChange={setWeightFilter}
                options={weightOptions}
                placeholder='All weights'
              />
            </div>
            <div
              ref={flavourWrapRef}
              className={`w-[150px] sm:w-[150px] transition-transform ${
                step === 3 ? 'scale-[1.03]' : 'scale-100'
              } pointer-events-none sm:pointer-events-auto`}
            >
              <MiniDropdown
                value={flavourFilter}
                onChange={setFlavourFilter}
                options={flavourOptions}
                placeholder='All flavours'
              />
            </div>
          </div>
        </div>

        {/* Mini table */}
        <div className='mt-3 flex-1 rounded-2xl bg-white px-2.5 sm:px-3 py-2 overflow-hidden'>
          <div>
            <table className='w-full text-left border-separate border-spacing-y-2 table-fixed'>
              <thead>
                <tr className='text-[11px] text-black/60'>
                  <th className='font-medium px-2 w-[24%]'>Brand</th>
                  <th className='font-medium px-2 w-[34%]'>Product</th>
                  <th className='font-medium px-2 w-[16%]'>Weight</th>
                  <th className='font-medium px-2 w-[26%]'>Flavours</th>
                  {/* Price column: only visible from sm+ to accomodate for mobile screen*/}
                  <th className='font-medium px-2 w-[14%] text-right hidden sm:table-cell'>
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className='text-black text-[11px]'>
                {filteredRows.map((row) => {
                  const isHighlight = row.id === highlightRowId;
                  const rowBg = isHighlight ? 'bg-[#F5F6FB]' : '';
                  return (
                    <tr key={row.id} className='group cursor-default'>
                      <td className={`py-2 px-2 rounded-l-md transition-colors ${rowBg}`}>
                        {row.brand}
                      </td>
                      <td className={`px-2 font-semibold truncate transition-colors ${rowBg}`}>
                        {row.product}
                      </td>
                      <td className={`px-2 transition-colors ${rowBg}`}>
                        {formatKgMini(row.weightKg)}
                      </td>
                      <td
                        className={`px-2 transition-colors rounded-r-md sm:rounded-none ${rowBg}`}
                      >
                        {row.flavours.slice(0, 2).join(', ')}
                      </td>
                      <td
                        ref={row.id === 1 ? rowPriceRef : null}
                        className={`px-2 rounded-r-md text-right font-semibold text-pink-600 transition-colors hidden sm:table-cell ${rowBg}`}
                      >
                        {formatPriceMini(row.priceCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cursor: desktop only */}
      {hasEntered && cursorPos && !isMobile && (
        <div
          className='pointer-events-none absolute z-30 h-4 w-4 rounded-full bg-white border-2 border-[#F78EAA]'
          style={{
            transform: `translate(${cursorPos.left}px, ${cursorPos.top}px)`,
            boxShadow: '0 14px 34px rgba(15,23,42,0.40)',
            transition: 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className='absolute inset-0.5 rounded-full border border-white/70' />
          <div
            className='absolute inset-0 rounded-full border border-[#F78EAA]'
            style={{
              opacity: clickPulseStep != null ? 0.5 : 0,
              transform: clickPulseStep != null ? 'scale(1.6)' : 'scale(0.9)',
              transition: 'opacity 300ms ease-out, transform 300ms ease-out',
            }}
          />
        </div>
      )}
    </div>
  );
}

/* STEP 2 */

type MiniCompareRowProps = {
  store: string;
  flavour: string;
  price: string;
};

function CompareRow({ store, flavour, price }: MiniCompareRowProps) {
  return (
    <tr className='group cursor-default'>
      <td className='py-2 px-2 font-bold rounded-l-md text-[11px] whitespace-nowrap transition-colors'>
        {store}
      </td>
      <td className='px-2 text-[11px] transition-colors'>{flavour}</td>
      <td className='px-2 font-semibold text-pink-600 text-[11px] text-right rounded-r-md transition-colors'>
        {price}
      </td>
    </tr>
  );
}

const CHART_POINTS = {
  chemist: '4,60 40,45 78,42 116,36 154,32',
  nzp: '4,70 40,65 78,62 116,59 154,57',
  xplosiv: '4,82 40,80 78,78 116,76 154,75',
};

function ComparePricesMini() {
  const [graphReady, setGraphReady] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphTimeoutRef = useRef<number | null>(null);

  // Detect mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const handleMouseEnter = () => {
    if (isMobile) return;
    setHasEntered(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setHasEntered(false);
    setGraphReady(false);
  };

  // Initial play when card is hovered
  useEffect(() => {
    if (!hasEntered) return;
    const t = window.setTimeout(() => setGraphReady(true), 200);
    return () => window.clearTimeout(t);
  }, [hasEntered]);

  // Re-trigger animation whenever you hover just the graph card
  const handleGraphEnter = () => {
    if (isMobile) return;
    if (graphTimeoutRef.current != null) {
      window.clearTimeout(graphTimeoutRef.current);
    }
    setGraphReady(false);
    graphTimeoutRef.current = window.setTimeout(() => setGraphReady(true), 20) as unknown as number;
  };

  useEffect(
    () => () => {
      if (graphTimeoutRef.current != null) {
        window.clearTimeout(graphTimeoutRef.current);
      }
    },
    []
  );

  const baseDash = 200;
  const translateY = graphReady ? 'translateY(-3px)' : 'translateY(0px)';
  const scale = !hasEntered && !isMobile ? 0.98 : 1;

  return (
    <div
      ref={containerRef}
      className='relative h-full w-full'
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className='relative sm:absolute sm:inset-3 mx-2 my-2 sm:m-0 rounded-3xl bg-white border border-[#E5E6F0] px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 flex flex-col'
        style={{
          transform: `${translateY} scale(${scale})`,
          transition: 'transform 900ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Main layout */}
        <div className='flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4'>
          <div className='flex-[1.6] flex flex-col gap-3'>
            {/* Graph card */}
            <div
              className='rounded-2xl bg-white px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3'
              onMouseEnter={handleGraphEnter}
            >
              <svg viewBox='0 0 160 90' className='w-full h-20 sm:h-[88px]'>
                {/* Grid */}
                <line x1='0' x2='160' y1='70' y2='70' stroke='rgba(0,0,0,0.04)' strokeWidth='1' />
                <line x1='0' x2='160' y1='50' y2='50' stroke='rgba(0,0,0,0.04)' strokeWidth='1' />
                <line x1='0' x2='160' y1='30' y2='30' stroke='rgba(0,0,0,0.04)' strokeWidth='1' />

                {/* Chemist Warehouse */}
                <polyline
                  points={CHART_POINTS.chemist}
                  fill='none'
                  stroke='#F78EAA'
                  strokeWidth='2'
                  strokeLinecap='round'
                  style={
                    isMobile
                      ? undefined // mobile: static line, no animation
                      : {
                          strokeDasharray: baseDash,
                          strokeDashoffset: graphReady ? 0 : baseDash,
                          transition: 'stroke-dashoffset 0.9s ease-out',
                        }
                  }
                />
                {/* NZProtein */}
                <polyline
                  points={CHART_POINTS.nzp}
                  fill='none'
                  stroke='#FFB347'
                  strokeWidth='2'
                  strokeLinecap='round'
                  style={
                    isMobile
                      ? undefined // mobile: static
                      : {
                          strokeDasharray: baseDash,
                          strokeDashoffset: graphReady ? 0 : baseDash,
                          transition: 'stroke-dashoffset 0.9s ease-out',
                          transitionDelay: '0.08s',
                        }
                  }
                />
                {/* Xplosiv */}
                <polyline
                  points={CHART_POINTS.xplosiv}
                  fill='none'
                  stroke='#B28CFF'
                  strokeWidth='2'
                  strokeLinecap='round'
                  style={
                    isMobile
                      ? undefined // mobile: static
                      : {
                          strokeDasharray: baseDash,
                          strokeDashoffset: graphReady ? 0 : baseDash,
                          transition: 'stroke-dashoffset 0.9s ease-out',
                          transitionDelay: '0.16s',
                        }
                  }
                />
              </svg>

              {/* Legend */}
              <div className='mt-2 flex flex-wrap justify-end gap-2 sm:gap-3 text-[9px] sm:text-[10px] text-[#6D728E]'>
                <span className='inline-flex items-center gap-1'>
                  <span className='h-2 w-2 rounded-full bg-[#F78EAA]' />
                  Chemist Warehouse
                </span>
                <span className='inline-flex items-center gap-1'>
                  <span className='h-2 w-2 rounded-full bg-[#FFB347]' />
                  NZProtein
                </span>
                <span className='inline-flex items-center gap-1'>
                  <span className='h-2 w-2 rounded-full bg-[#B28CFF]' />
                  Xplosiv
                </span>
              </div>
            </div>

            {/* Table */}
            <div className='rounded-2xl bg-white'>
              <table className='w-full text-left border-separate border-spacing-y-2'>
                <thead>
                  <tr className='text-[11px] text-black/60'>
                    <th className='font-medium px-2 whitespace-nowrap'>Store</th>
                    <th className='font-medium px-2'>Flavour</th>
                    <th className='font-medium px-2 text-right'>Price</th>
                  </tr>
                </thead>
                <tbody className='text-black text-[11px]'>
                  <CompareRow store='Chemist Warehouse' flavour='Chocolate' price='$79.99' />
                  <CompareRow store='NZProtein' flavour='Vanilla' price='$82.50' />
                  <CompareRow store='Xplosiv' flavour='Choc Peanut' price='$84.90' />
                </tbody>
              </table>
            </div>
          </div>

          {/* All-time vs current lowest */}
          <div className='flex-[1.1] flex flex-col gap-2'>
            {/* All-time low card */}
            <div className='rounded-3xl bg-white border border-[#E5E6F0] px-3 sm:px-4 py-3 sm:py-4 text-center'>
              <div className='text-[10px] sm:text-[11px] text-[#6D728E]'>
                Lowest price <span className='font-semibold text-black/70'>all time</span>
              </div>
              <div className='mt-1 text-base sm:text-lg font-bold text-black/70'>$74.99</div>
              <div className='mt-1 text-[9px] sm:text-[10px] text-black/30'>12 Aug 2024</div>
              <div className='mt-2 text-[10px] sm:text-[11px] text-black/60'>NZProtein</div>
            </div>

            {/* Current low card */}
            <div
              className='relative rounded-3xl border-2 border-transparent px-3 sm:px-4 py-3 sm:py-4 text-center overflow-hidden'
              style={{
                background:
                  'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #F78EAA 0%, #FFBBD5 55%, #FF8709 100%) border-box',
              }}
            >
              <div className='relative'>
                <div className='text-[10px] sm:text-[11px] text-[#6D728E]'>
                  Lowest price{' '}
                  <span
                    className='font-semibold text-transparent bg-clip-text'
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, #F78EAA 0%, #F78EAA 47%, #FF8709 100%)',
                    }}
                  >
                    now
                  </span>
                </div>
                <div className='mt-1 text-base sm:text-lg font-bold leading-[1.1]'>
                  <span
                    className='bg-clip-text text-transparent'
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, #F78EAA 0%, #F78EAA 75%, #FF8709 100%)',
                    }}
                  >
                    $79.99
                  </span>
                </div>
                <div className='mt-2 text-[10px] sm:text-[11px] text-black/60'>
                  Chemist Warehouse
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
