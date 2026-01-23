import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';

type HistoryRow = {
  date: string; // "YYYY-MM-DD"
  retailer: string;
  priceCents: number;
};

const COLOURS = ['#FF8709', '#F78EAA', '#FFB347', '#FFBBD5'] as const;

type RangeKey = 'ALL' | '30D' | '6M' | '1Y';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '30D', label: 'Last 30 days' },
  { key: '6M', label: 'Last 6 months' },
  { key: '1Y', label: 'Last year' },
  { key: 'ALL', label: 'All time' },
];

// Deterministic hash-based mapping from retailer name to a colour
function retailerColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % COLOURS.length;
  return COLOURS[idx];
}

// Converts date label to a shorter format, eg: 2025-11-11 -> 11 Nov
function formatDateLabel(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
  });
}

function parseISODate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(d: Date, months: number) {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(d: Date, years: number) {
  const next = new Date(d);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function getDateTicks(data: { date: string }[], latestDate: Date | null): string[] {
  if (!data.length) return [];

  // If we have 7 or fewer data points, show all dates
  if (data.length <= 7) {
    return data.map((d) => d.date);
  }

  // Otherwise, show every 7 days working backwards from the latest date
  const end = latestDate ?? new Date();
  const ticks: string[] = [];
  const dataDateSet = new Set(data.map((d) => d.date));

  // Find the earliest date in data
  const earliestDate = new Date(data[0].date);

  // Work backwards from end date in 7-day intervals
  let current = new Date(end);
  while (current >= earliestDate) {
    const dateStr = current.toISOString().split('T')[0];
    // Add if this date exists in our data, or find the nearest date
    if (dataDateSet.has(dateStr)) {
      ticks.unshift(dateStr);
    } else {
      // Find nearest date in data within 3 days
      for (let offset = 1; offset <= 3; offset++) {
        const before = new Date(current);
        before.setDate(before.getDate() - offset);
        const after = new Date(current);
        after.setDate(after.getDate() + offset);
        const beforeStr = before.toISOString().split('T')[0];
        const afterStr = after.toISOString().split('T')[0];
        if (dataDateSet.has(beforeStr)) {
          ticks.unshift(beforeStr);
          break;
        }
        if (dataDateSet.has(afterStr)) {
          ticks.unshift(afterStr);
          break;
        }
      }
    }
    current.setDate(current.getDate() - 7);
  }

  return [...new Set(ticks)]; // Remove duplicates
}

export default function ProteinHistoryChart({ rows }: { rows: HistoryRow[] }) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<RangeKey>('ALL'); // default: all time

  // Only render the chart after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Pick an anchor "end date" = latest date in the dataset
  const latestDate = useMemo(() => {
    let latest: Date | null = null;
    for (const r of rows || []) {
      const d = parseISODate(r.date);
      if (!d) continue;
      if (!latest || d > latest) latest = d;
    }
    return latest;
  }, [rows]);

  // Filter rows by selected range
  const filteredRows = useMemo(() => {
    if (!rows?.length) return [];

    if (range === 'ALL') return rows;

    const end = latestDate ?? new Date();
    let start: Date;

    if (range === '30D') start = addDays(end, -30);
    else if (range === '6M') start = addMonths(end, -6);
    else start = addYears(end, -1);

    return rows.filter((r) => {
      const d = parseISODate(r.date);
      return d ? d >= start && d <= end : false;
    });
  }, [rows, range, latestDate]);

  const { data, retailers, globalMinPrice, domainMin, domainMax, ticks, xTicks } = useMemo(() => {
    const byDate = new Map<string, any>(); // date -> { date, [retailer]: priceDollars }
    const names = new Set<string>();

    let globalMinPrice: number | null = null;
    let globalMaxPrice: number | null = null;

    for (const r of filteredRows || []) {
      const retailer = r.retailer;
      const date = r.date;
      const price = (r.priceCents ?? 0) / 100;

      names.add(retailer);

      const obj = byDate.get(date) ?? { date };
      const existing = obj[retailer];

      const nextPrice = existing == null ? price : Math.min(existing, price);
      obj[retailer] = nextPrice;
      byDate.set(date, obj);

      if (globalMinPrice == null || price < globalMinPrice) globalMinPrice = price;
      if (globalMaxPrice == null || price > globalMaxPrice) globalMaxPrice = price;
    }

    const sorted = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    const xTicks = getDateTicks(sorted, latestDate);

    const padding = 10;
    const baseMin = globalMinPrice ?? 0;
    const baseMax = globalMaxPrice ?? baseMin;

    const rawMin = baseMin - padding;
    const rawMax = baseMax + padding;

    const STEP = 5;
    const domainMin = Math.floor(rawMin / STEP) * STEP;
    const domainMax = Math.ceil(rawMax / STEP) * STEP;

    const ticks: number[] = [];
    for (let v = domainMin; v <= domainMax; v += STEP) ticks.push(v);

    return {
      data: sorted,
      retailers: Array.from(names).sort(),
      globalMinPrice,
      domainMin,
      domainMax,
      ticks,
      xTicks,
    };
  }, [filteredRows, latestDate]);

  if (!mounted || !data.length) return null;

  return (
    <section className='mx-auto w-full max-w-6xl lg:max-w-7xl xl:max-w-screen-2xl mt-10 mb-12 sm:mb-16'>
      <div className='relative'>
        <div className='relative z-10 bg-white rounded-2xl p-4 sm:p-6'>
          <div className='flex items-center justify-between gap-3 mb-3 sm:mb-4'>
            <h3 className='text-sm sm:text-base font-medium text-black/75'>Price over time</h3>

            {/* Range toggle */}
            <div className='ml-auto -mr-2 sm:-mr-3 flex items-center gap-1 rounded-xl bg-[#F3F5FA] p-1 ring-1 ring-black/6'>
              {RANGE_OPTIONS.map((opt) => {
                const active = opt.key === range;
                return (
                  <button
                    key={opt.key}
                    type='button'
                    onClick={() => setRange(opt.key)}
                    className={[
                      'px-2.5 py-1.5 text-[11px] sm:text-xs rounded-lg transition',
                      active
                        ? 'bg-white shadow-sm text-black/80'
                        : 'text-black/55 hover:text-black/70 hover:bg-white/60',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className='h-[260px] sm:h-[380px] min-w-0'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={data} margin={{ top: 16, right: 40, left: 4, bottom: 12 }}>
                <CartesianGrid stroke='rgba(0,0,0,0.06)' strokeDasharray='3 3' vertical={false} />

                <XAxis
                  dataKey='date'
                  tickFormatter={formatDateLabel}
                  tickMargin={8}
                  tick={{ fill: 'rgba(0,0,0,0.45)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  tickLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  ticks={xTicks}
                />

                <YAxis
                  tickFormatter={(v) => `$${Math.round(v)}`}
                  tick={{ fill: 'rgba(0,0,0,0.45)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  tickLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  domain={[domainMin, domainMax]}
                  ticks={ticks}
                />

                {/* Line and shading at global minimum */}
                {globalMinPrice != null && (
                  <>
                    <ReferenceArea
                      y1={domainMin}
                      y2={globalMinPrice}
                      ifOverflow='extendDomain'
                      fill='#F78EAA'
                      fillOpacity={0.08}
                    />
                    <ReferenceLine
                      y={globalMinPrice}
                      stroke='#F78EAA'
                      strokeDasharray='4 4'
                      strokeOpacity={0.95}
                      strokeWidth={1.4}
                      ifOverflow='extendDomain'
                    />
                  </>
                )}

                <Tooltip
                  formatter={(value, name) => [`$${Number(value).toFixed(2)}`, String(name)]}
                  labelClassName='text-black/60'
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 10,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
                  }}
                  cursor={{ stroke: 'rgba(0,0,0,0.15)', strokeDasharray: '4 4' }}
                />

                <Legend
                  verticalAlign='top'
                  align='right'
                  iconType='plainline'
                  wrapperStyle={{
                    fontSize: 11,
                    color: 'rgba(0,0,0,0.6)',
                    paddingBottom: 8,
                  }}
                />

                {retailers.map((r) => (
                  <Line
                    key={r}
                    type='monotone'
                    dataKey={r}
                    name={r}
                    dot={false}
                    connectNulls
                    stroke={retailerColour(r)}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
