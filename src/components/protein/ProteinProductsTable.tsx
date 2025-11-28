import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LogosMobile from '@/assets/stocks/logos_mobile.png';

// Brand replacements for capitalisation
const BRAND_DISPLAY_OVERRIDES: Record<string, string> = {
  Bsn: 'BSN',
  Pvl: 'PVL',
  Nzprotein: 'NZProtein',
  Nowhey: 'NoWhey',
  'Bsc Body Science': 'BSc Body Science',
};

/* Format Helpers */
function formatBrandName(brand: string | null | undefined) {
  if (!brand) return brand;
  return BRAND_DISPLAY_OVERRIDES[brand] ?? brand;
}

// Capitalise standalone "NZ" inside product names
function formatProductName(name: string | null | undefined) {
  if (!name) return name;
  return name.replace(/\bnz\b/gi, 'NZ');
}

function formatKg(kg: number | null | undefined) {
  if (kg == null) return '-';
  return `${Number(kg).toString().replace(/\.0$/, '')} kg`;
}

function formatPrice(cents: number | null | undefined, symbol = '$') {
  if (cents == null) return '-';
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

// Turns string[] flavours into UI chips
function renderFlavours(flavours: string[] = []) {
  if (!flavours.length) return <span className='text-black/30'>—</span>;
  const first = flavours.slice(0, 3);
  const extra = flavours.length - first.length;
  return (
    <div className='flex flex-wrap gap-1.5'>
      {first.map((f) => (
        <span
          key={f}
          className='px-2 py-0.5 text-xs rounded-full bg-black/5 text-black/70'
          title={f}
        >
          {f}
        </span>
      ))}
      {extra > 0 && (
        <span className='px-2 py-0.5 text-xs rounded-full bg-black/5 text-black/50'>
          +{extra} more
        </span>
      )}
    </div>
  );
}

// Sorting for table ascending or descending order
type SortKey = 'brand' | 'value' | 'weight' | 'price' | null;
type SortDir = 'asc' | 'desc';

type DropdownOption = {
  value: string;
  label: string;
};

type CustomDropdownProps = {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder: string;
};

// Drop down for filtering table
function CustomDropdown({ value, onChange, options, placeholder }: CustomDropdownProps) {
  const [open, setOpen] = useState(false); // opened or closed menu
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null); // highlighted option
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
          transition border
          ${active ? 'border-black/40' : 'border-transparent hover:border-black/15'}
          focus:outline-none`}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {display}
        <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-black/50'>
          ▾
        </span>
      </div>

      {open && (
        <div className='absolute left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl bg-white text-xs text-black shadow-lg border border-black/10 z-20'>
          {visibleOptions.map((opt, idx) => {
            const highlighted = idx === highlightIdx;
            return (
              <button
                key={opt.value || opt.label}
                type='button'
                className={`w-full text-left px-3 py-1.5 cursor-pointer
                  ${highlighted ? 'bg-black/0.08' : 'bg-white'}
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

// Weight filtering
const WEIGHT_OPTIONS = [
  { id: '', label: 'All weights' },
  { id: '0-0.5', label: '0–0.5 kg' },
  { id: '0.5-1', label: '0.5–1 kg' },
  { id: '1-2', label: '1–2 kg' },
  { id: '2-3', label: '2–3 kg' },
  { id: '3+', label: '3+ kg' },
] as const;

function weightOptionMatches(weightKg: number | null | undefined, bucketId: string) {
  if (!bucketId || weightKg == null) return true;

  if (bucketId === '0-0.5') return weightKg >= 0 && weightKg < 0.5;
  if (bucketId === '0.5-1') return weightKg >= 0.5 && weightKg < 1;
  if (bucketId === '1-2') return weightKg >= 1 && weightKg < 2;
  if (bucketId === '2-3') return weightKg >= 2 && weightKg < 3;
  if (bucketId === '3+') return weightKg >= 3;

  return true;
}

export default function ProteinTable() {
  const navigate = useNavigate(); // URL navigation
  const [params, setParams] = useSearchParams(); // URL query
  const [rows, setRows] = useState<any[]>([]); // table data
  const [sortKey, setSortKey] = useState<SortKey>(null); // col sorting
  const [sortDir, setSortDir] = useState<SortDir>('desc'); // sorting order
  const [brandFilter, setBrandFilter] = useState('');
  const [weightFilter, setWeightFilter] = useState('');
  const [flavourFilter, setFlavourFilter] = useState('');
  const [showValueInfo, setShowValueInfo] = useState(false); // extra info for value

  const searchQuery = (params.get('q') || '').trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;

    // Load table with api/protein
    (async () => {
      try {
        const res = await fetch('/api/protein');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!cancelled && Array.isArray(data)) {
          setRows(data);
        }
      } catch (err) {
        console.error('Error fetching /api/protein:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Dropdown options - brand
  const brandOptions: DropdownOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const display = formatBrandName(row.brand);
      if (display) set.add(display);
    }
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All brands' }, ...sorted.map((b) => ({ value: b, label: b }))];
  }, [rows]);

  // Dropdown options - flavour
  const flavourOptions: DropdownOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      (row.flavours || []).forEach((f: string) => {
        if (f) set.add(f);
      });
    }
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All flavours' }, ...sorted.map((f) => ({ value: f, label: f }))];
  }, [rows]);

  // Dropdown options - weight
  const weightOptions: DropdownOption[] = WEIGHT_OPTIONS.map((b) => ({
    value: b.id,
    label: b.label,
  }));

  // Filtering
  const filteredRows = rows.filter((row) => {
    // Format the row
    const brandName = formatBrandName(row.brand) || '';
    const productName = formatProductName(row.product) ?? '';
    const brandMatch = brandFilter ? brandName === brandFilter : true;

    // If flavour filter is set
    const flavourMatch = flavourFilter
      ? (row.flavours || []).some((f: string) => f === flavourFilter)
      : true;
    // If weight filter is set
    const weightMatch = weightOptionMatches(row.weightKg, weightFilter);
    // If using search bar filter
    const haystack = `${brandName} ${productName} ${(row.flavours || []).join(' ')}`.toLowerCase(); // build one string for search result
    const searchMatch = searchQuery ? haystack.includes(searchQuery) : true;

    return brandMatch && flavourMatch && weightMatch && searchMatch;
  });

  // Sort click handler: 1st click default dir, 2nd reverse, 3rd clear
  function handleSortClick(key: SortKey) {
    if (!key) return;
    const defaultDir: SortDir = key === 'value' ? 'desc' : 'asc';

    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(defaultDir);
    } else {
      if (sortDir === defaultDir) {
        setSortDir(defaultDir === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(null);
      }
    }
  }

  // Sorting each column
  const displayRows = useMemo(() => {
    const base = [...filteredRows];

    if (!sortKey) return base;

    base.sort((a, b) => {
      if (sortKey === 'brand') {
        const av = (formatBrandName(a.brand) || '').toLowerCase();
        const bv = (formatBrandName(b.brand) || '').toLowerCase();
        if (av === bv) return 0;
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }

      if (sortKey === 'value') {
        const av = a.valueScore ?? 0;
        const bv = b.valueScore ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }

      if (sortKey === 'weight') {
        const av = a.weightKg ?? 0;
        const bv = b.weightKg ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }

      if (sortKey === 'price') {
        const av = a.priceCents ?? 0;
        const bv = b.priceCents ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }

      return 0;
    });

    return base;
  }, [filteredRows, sortKey, sortDir]);

  // Filtering query URL
  useEffect(() => {
    const urlBrand = params.get('brand') || '';
    const urlWeight = params.get('weight') || '';
    const urlFlavour = params.get('flavour') || '';

    setBrandFilter(urlBrand);
    setWeightFilter(urlWeight);
    setFlavourFilter(urlFlavour);
  }, [params]);

  function updateFilterParam(key: 'brand' | 'weight' | 'flavour', value: string) {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setParams(next, { replace: true });
  }

  // UI states for sorting
  const sortableBase = 'font-medium px-2 cursor-pointer select-none transition-colors';
  const brandSortActive = sortKey === 'brand';
  const weightSortActive = sortKey === 'weight';
  const priceSortActive = sortKey === 'price';
  const valueSortActive = sortKey === 'value';

  const hasRows = displayRows.length > 0;

  /* Helpers for clicking navigation */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, id: string) => {
    if (!id) return;

    const target = e.target as HTMLElement | null;

    // If the click started on a link or button, let that handle it
    if (target && target.closest('a, button')) return;

    navigate(`/protein/${id}`);
  };

  const handleProductLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!id) return;

    // allow Ctrl/Cmd/middle-click to open new tab normally
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      return;
    }

    e.preventDefault();
    navigate(`/protein/${id}`);
  };

  return (
    <div className='mx-auto px-2 sm:px-4 py-8 max-w-6xl lg:max-w-7xl xl:max-w-screen-7xl'>
      <div className='relative pb-[150px] sm:pb-[220px] md:pb-[260px]'>
        <div className='relative z-10 bg-white rounded-2xl'>
          {/* Heading */}
          <div className='pt-6 pb-4 px-4 flex justify-center'>
            <p className='text-sm text-center'>
              <span
                style={{
                  fontFamily: '"King and Queen", system-ui, sans-serif',
                }}
                className='text-black/70'
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
                className='text-black/70'
              >
                {' '}
                to refine the list
              </span>
            </p>
          </div>

          {/* Filters */}
          <div className='px-3 pb-3'>
            <div className='hidden md:flex flex-wrap gap-2 text-xs'>
              <div className='w-[180px]'>
                <CustomDropdown
                  value={brandFilter}
                  onChange={(v) => {
                    setBrandFilter(v);
                    updateFilterParam('brand', v);
                  }}
                  options={brandOptions}
                  placeholder='All brands'
                />
              </div>
              <div className='w-[140px] ml-78'>
                <CustomDropdown
                  value={weightFilter}
                  onChange={setWeightFilter}
                  options={weightOptions}
                  placeholder='All weights'
                />
              </div>
              <div className='w-[180px] ml-4'>
                <CustomDropdown
                  value={flavourFilter}
                  onChange={setFlavourFilter}
                  options={flavourOptions}
                  placeholder='All flavours'
                />
              </div>
            </div>

            {/* Mobile filters */}
            <div className='grid md:hidden grid-cols-1 sm:grid-cols-2 gap-2 text-xs'>
              <CustomDropdown
                value={brandFilter}
                onChange={setBrandFilter}
                options={brandOptions}
                placeholder='All brands'
              />
              <CustomDropdown
                value={weightFilter}
                onChange={setWeightFilter}
                options={weightOptions}
                placeholder='All weights'
              />
              <CustomDropdown
                value={flavourFilter}
                onChange={setFlavourFilter}
                options={flavourOptions}
                placeholder='All flavours'
              />
            </div>
          </div>

          {/* Desktop */}
          <div className='hidden md:block px-3'>
            <table className='w-full text-left border-separate border-spacing-y-4 table-fixed'>
              <thead>
                <tr className='text-sm'>
                  <th
                    className={`${sortableBase} text-black/60 w-[18%] ${
                      brandSortActive
                        ? 'text-black font-semibold'
                        : 'text-black/60 hover:text-black hover:font-semibold'
                    }`}
                    onClick={() => handleSortClick('brand')}
                    title='Click to sort by brand'
                  >
                    Brand
                  </th>
                  <th className='font-medium px-2 text-black/60 w-[26%]'>Product Name</th>
                  <th
                    className={`${sortableBase} w-[14%] ${
                      weightSortActive
                        ? 'text-black font-semibold'
                        : 'text-black/60 hover:text-black hover:font-semibold'
                    }`}
                    onClick={() => handleSortClick('weight')}
                    title='Click to sort by weight'
                  >
                    Weight
                  </th>
                  <th className='font-medium px-2 text-black/60 w-[22%]'>Flavours</th>
                  <th
                    className={`${sortableBase} w-[10%] text-right ${
                      priceSortActive
                        ? 'text-black font-semibold'
                        : 'text-black/60 hover:text-black hover:font-semibold'
                    }`}
                    onClick={() => handleSortClick('price')}
                    title='Click to sort by price'
                  >
                    Price
                  </th>
                  <th
                    className={`${sortableBase} w-[10%] text-center relative ${
                      valueSortActive
                        ? 'text-black font-semibold'
                        : 'text-black/60 hover:text-black hover:font-semibold'
                    }`}
                    onClick={() => handleSortClick('value')}
                    onMouseEnter={() => setShowValueInfo(true)}
                    onMouseLeave={() => setShowValueInfo(false)}
                    title='Click to sort by value score'
                  >
                    <span>Value Score*</span>
                    {showValueInfo && (
                      <div className='absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-2 text-xs bg-black text-white rounded shadow-lg z-20 whitespace-nowrap'>
                        Value Score compares grams per dollar, scaled so the best product = 100.
                      </div>
                    )}
                  </th>
                  <th className='font-medium px-2 w-[8%] text-center whitespace-nowrap text-black/60'>
                    Visit Page
                  </th>
                </tr>
              </thead>

              <tbody className='text-black text-sm'>
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    className='group cursor-pointer'
                    onClick={(e) => handleRowClick(e, row.id)}
                    title={`Open details for ${formatProductName(row.product)}`}
                  >
                    <td className='py-4 px-2 group-hover:bg-gray-50 transition-colors rounded-l-md'>
                      {formatBrandName(row.brand)}
                    </td>

                    <td className='px-2 font-bold group-hover:bg-gray-50 transition-colors'>
                      <a
                        href={`/protein/${row.id}`}
                        onClick={(e) => handleProductLinkClick(e, row.id)}
                        className='block'
                      >
                        {formatProductName(row.product)}
                      </a>
                    </td>

                    <td className='px-2 group-hover:bg-gray-50 transition-colors'>
                      {formatKg(row.weightKg)}
                    </td>

                    <td className='px-2 group-hover:bg-gray-50 transition-colors'>
                      {renderFlavours(row.flavours)}
                    </td>

                    <td className='px-2 font-semibold text-pink-600 group-hover:bg-gray-50 transition-colors text-right'>
                      {formatPrice(row.priceCents)}
                    </td>

                    <td className='px-2 group-hover:bg-gray-50 transition-colors w-24 text-center'>
                      {row.valueScore ?? 0}
                    </td>

                    <td className='px-2 group-hover:bg-gray-50 transition-colors rounded-r-md text-center'>
                      <a
                        href={row.visitUrl || '#'}
                        onClick={(e) => e.stopPropagation()}
                        className='inline-flex items-center justify-center rounded-full p-2 hover:bg-black/5 transition'
                        aria-label={`Visit ${formatProductName(row.product)}`}
                        target='_blank'
                        rel='noopener'
                      >
                        <Globe size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile*/}
          <div className='md:hidden px-3 pb-4 space-y-3'>
            {displayRows.map((row) => (
              <button
                key={row.id}
                type='button'
                onClick={() => row.id && navigate(`/protein/${row.id}`)}
                className='w-full text-left rounded-2xl bg-white px-3 py-3 active:scale-[0.99] transition'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex-1 min-w-0'>
                    <div className='text-[11px] text-black/50'>{formatBrandName(row.brand)}</div>
                    <div className='mt-0.5 text-sm font-semibold text-black truncate'>
                      <a
                        href={`/protein/${row.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.button === 1) {
                            // let browser handle open-in-new-tab
                            return;
                          }
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/protein/${row.id}`);
                        }}
                        className='block'
                      >
                        {formatProductName(row.product)}
                      </a>
                    </div>
                    <div className='mt-1 text-[11px] text-black/50'>{formatKg(row.weightKg)}</div>
                  </div>
                  <div className='text-right'>
                    <div className='text-[11px] text-black/50'>Price</div>
                    <div className='text-sm font-semibold text-pink-600'>
                      {formatPrice(row.priceCents)}
                    </div>
                    <div className='mt-1 text-[11px] text-black/50'>
                      Value {row.valueScore ?? 0}
                    </div>
                  </div>
                </div>

                <div className='mt-2 flex items-center gap-2'>
                  <div className='flex-1 min-w-0'>{renderFlavours(row.flavours)}</div>
                  <a
                    href={row.visitUrl || '#'}
                    onClick={(e) => e.stopPropagation()}
                    className='shrink-0 inline-flex items-center justify-center rounded-full p-2 hover:bg-black/5 transition'
                    aria-label={`Visit ${formatProductName(row.product)}`}
                    target='_blank'
                    rel='noopener'
                  >
                    <Globe size={16} />
                  </a>
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* Background */}
        {hasRows && (
          <img
            src={LogosMobile}
            alt=''
            aria-hidden='true'
            className='pointer-events-none select-none
               absolute left-1/2 -translate-x-1/2
               top-full -translate-y-[85%] 
               w-[1800px] max-w-none opacity-100
               z-20'
          />
        )}
      </div>
    </div>
  );
}
