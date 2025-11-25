import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

// Helper to get the product title
function titleFromSlug(s = '') {
  return decodeURIComponent(s)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

type ApiSuggestion = {
  product_id: number;
  brand: string | null;
  name: string;
  weight_grams?: number | null;
};

type SearchSuggestion = {
  id: string;
  label: string;
  subtitle?: string; // weight subtitle
};

export default function Nav() {
  const { pathname } = useLocation(); // URL path name eg: /protein
  const [params, setParams] = useSearchParams(); // URL query

  // Page tracker
  const isProtein = pathname.startsWith('/protein');
  const isCreatine = pathname.startsWith('/creatine');
  const isHome = pathname === '/';
  const isProteinDetail = pathname.startsWith('/protein/') && pathname !== '/protein';
  const isCreatineDetail = pathname.startsWith('/creatine/') && pathname !== '/creatine';
  const isDetail = isProteinDetail || isCreatineDetail;

  const currentSlug = isDetail ? pathname.split('/').pop() : ''; // slug from URL

  const qs = params.toString(); // URL query eg: q=gold+whey&brand=ON
  const withQS = (path: string) => (qs ? `${path}?${qs}` : path); // eg: /protein?q=gold+whey&brand=ON

  const searchValue = params.get('q') ?? ''; // eg: 'gold+whey'

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]); // search suggestions
  const [showSuggestions, setShowSuggestions] = useState(false); // open search suggestions
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    // initial value
    update(mq);
    // listen for changes
    const handler = (e: MediaQueryListEvent) => update(e);
    mq.addEventListener('change', handler);
    return () => {
      mq.removeEventListener('change', handler);
    };
  }, []);

  /* Search bar helpers */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleSuggestionClick = (s: SearchSuggestion) => {
    const next = new URLSearchParams(params);
    next.set('q', s.label);
    setParams(next);
    setShowSuggestions(false);
  };

  const searchPlaceholder = isProtein
    ? 'Search protein products e.g. "Gold Standard Whey"'
    : isCreatine
    ? 'Search creatine e.g. "Gold Series Creatine X8"'
    : 'Search supplements e.g. "Optimum Nutrition"';

  // Fetch autocomplete suggestions when searchValue changes
  useEffect(() => {
    const query = searchValue.trim();
    if (!query) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const endpointBase = isProtein
      ? '/api/protein/suggest'
      : isCreatine
      ? '/api/creatine/suggest'
      : '/api/supplements/suggest'; // API endpoint

    let cancelled = false; // new search started
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${endpointBase}?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data: ApiSuggestion[] = await res.json();

        if (cancelled) return;

        const mapped: SearchSuggestion[] = data.map((row) => {
          const label = [row.brand, row.name].filter(Boolean).join(' '); // eg: Optimum Nutrition Gold Standard Whey
          const subtitle =
            row.weight_grams && row.weight_grams > 0 ? `${row.weight_grams} g` : undefined; // eg: 2000 g
          return {
            id: String(row.product_id ?? `${label}-${subtitle ?? ''}`),
            label: label || row.name,
            subtitle,
          };
        });

        setSuggestions(mapped); // sugggestions list
        setShowSuggestions(mapped.length > 0);
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    }, 200); // wait 0.2s after user has stopped typing

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchValue, isProtein, isCreatine]);

  const fullTitle = currentSlug ? titleFromSlug(currentSlug) : '';
  const displayTitle =
    isDetail && isMobile && fullTitle.length > 10 ? `${fullTitle.slice(0, 10)}...` : fullTitle;

  return (
    <div
      className={[
        'fixed inset-x-0 top-0 z-40 backdrop-blur transition-all duration-200',
        isHome
          ? 'opacity-0 pointer-events-none -translate-y-4 bg-transparent'
          : 'opacity-100 translate-y-0 bg-[#F3F5FA]/90',
      ].join(' ')}
    >
      <div className='mx-auto max-w-[1000px] px-2 md:px-4 h-14 md:h-16 flex items-center'>
        <div className='flex w-full items-center gap-2 md:gap-10'>
          {/* Home */}
          <Link
            to='/'
            aria-current={isHome ? 'page' : undefined}
            className={[
              'shrink-0 text-sm font-medium transition',
              isHome ? 'text-black' : 'text-black/70 hover:text-black',
            ].join(' ')}
          >
            Home
          </Link>

          {/* Product detail breadcrumb (protein + creatine, same on mobile & desktop) */}
          {isDetail && (
            <div className='flex flex-1 items-center justify-center gap-2 text-sm text-black/60'>
              <Link
                to={withQS(isProteinDetail ? '/protein' : '/creatine')}
                className='hover:text-black'
              >
                {isProteinDetail ? 'Protein' : 'Creatine'}
              </Link>
              <span>/</span>
              <span className='font-medium text-black/70 truncate max-w-[260px] text-center'>
                {displayTitle}
              </span>
            </div>
          )}

          {/* Search */}
          {!isDetail && (
            <form className='flex-1' role='search' onSubmit={handleSearchSubmit}>
              <div className='relative'>
                <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2'>
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
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    // Delay so click on suggestion still registers
                    setTimeout(() => setShowSuggestions(false), 120);
                  }}
                  className='w-full h-12 rounded-2xl bg-white/70 pl-10 pr-4 text-sm text-black/80 placeholder-black/40 outline-none ring-1 ring-black/6 focus:bg-white focus:ring-black/12 transition'
                />

                {searchValue && (
                  <button
                    type='button'
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete('q');
                      setParams(next);
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition'
                    aria-label='Clear search'
                  >
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                      <path
                        d='M18 6L6 18M6 6l12 12'
                        stroke='currentColor'
                        strokeWidth='1.8'
                        strokeLinecap='round'
                      />
                    </svg>
                  </button>
                )}

                {/* Autocomplete suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul
                    className={[
                      'fixed z-50 max-h-72 overflow-auto rounded-2xl bg-white py-1 text-sm shadow-lg',
                      'left-1/2 -translate-x-1/2 w-[min(480px,calc(100vw-16px))] top-56px',
                      'md:absolute md:mt-1 md:left-0 md:translate-x-0 md:w-full',
                    ].join(' ')}
                  >
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type='button'
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSuggestionClick(s);
                          }}
                          className='flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-[#F3F5FA]'
                        >
                          <span className='font-medium text-black/80'>{s.label}</span>
                          {s.subtitle && (
                            <span className='text-[11px] text-black/45'>{s.subtitle}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          )}

          {/* Tabs + glider for protein / creatine */}
          {!isDetail && (
            <nav
              aria-label='Category tabs'
              className='relative shrink-0 h-12 rounded-2xl bg-[#F3F5FA] flex items-center ring-1 ring-black/6 focus:bg-white focus:ring-black/12'
              style={{ width: 'fit-content' }}
            >
              {/* Wrapper*/}
              <div className='relative flex h-10 mx-1 min-w-[220px] rounded-2xl'>
                {/* Glider*/}
                <span
                  aria-hidden
                  className={[
                    'absolute inset-y-0 left-0 w-1/2 rounded-xl bg-white shadow-sm',
                    'transform transition-transform duration-300 ease-out',
                    isCreatine ? 'translate-x-full' : 'translate-x-0',
                  ].join(' ')}
                />
                <div className='relative z-10 flex w-full h-full gap-1'>
                  <Link
                    to={withQS('/protein')}
                    aria-current={isProtein ? 'page' : undefined}
                    className={[
                      'flex-1 flex items-center justify-center rounded-xl text-sm font-medium transition',
                      isProtein ? 'text-black' : 'text-black/70 hover:text-black',
                    ].join(' ')}
                  >
                    Protein
                  </Link>
                  <Link
                    to={withQS('/creatine')}
                    aria-current={isCreatine ? 'page' : undefined}
                    className={[
                      'flex-1 flex items-center justify-center rounded-2xl text-sm font-medium transition',
                      isCreatine ? 'text-black' : 'text-black/70 hover:text-black',
                    ].join(' ')}
                  >
                    Creatine
                  </Link>
                </div>
              </div>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
