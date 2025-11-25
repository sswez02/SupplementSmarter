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
  date: string;
  retailer: string;
  priceCents: number;
};

const COLOURS = ['#FF8709', '#F78EAA', '#FFB347', '#FFBBD5'] as const;

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

export default function CreatineHistoryChart({ rows }: { rows: HistoryRow[] }) {
  const [mounted, setMounted] = useState(false);

  // Only render the chart after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, retailers, globalMinPrice, domainMin, domainMax, ticks } = useMemo(() => {
    const byDate = new Map<string, any>();
    const names = new Set<string>();

    let globalMinPrice: number | null = null;
    let globalMaxPrice: number | null = null;

    for (const r of rows || []) {
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

    const padding = 10;
    const baseMin = globalMinPrice ?? 0;
    const baseMax = globalMaxPrice ?? baseMin;
    const rawMin = baseMin - padding;
    const rawMax = baseMax + padding;
    const STEP = 5;
    const domainMin = Math.floor(rawMin / STEP) * STEP;
    const domainMax = Math.ceil(rawMax / STEP) * STEP;

    const ticks: number[] = [];
    for (let v = domainMin; v <= domainMax; v += STEP) {
      ticks.push(v);
    }

    return {
      data: sorted,
      retailers: Array.from(names).sort(),
      globalMinPrice,
      domainMin,
      domainMax,
      ticks,
    };
  }, [rows]);

  if (!mounted || !data.length) return null;

  return (
    <section className='mx-auto w-full max-w-6xl lg:max-w-7xl xl:max-w-screen-2xl mt-10 mb-12 sm:mb-16'>
      <div className='relative'>
        <div className='relative z-10 bg-white rounded-2xl p-4 sm:p-6'>
          <div className='flex items-center justify-between mb-3 sm:mb-4'>
            <h3 className='text-sm sm:text-base font-medium text-black/75'>Price over time</h3>
          </div>

          {/* Ensure the container has real height & width */}
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
                />

                <YAxis
                  tickFormatter={(v) => `$${Math.round(v)}`}
                  tick={{ fill: 'rgba(0,0,0,0.45)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  tickLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  domain={[domainMin, domainMax]}
                  ticks={ticks}
                />

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
