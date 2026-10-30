import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../i18n';

interface Datum {
  label: string;
  value: number;
}

const PALETTE = ['#4C7DFF', '#3DDC97', '#F5A524', '#FF6B6B', '#9B8CFF', '#4EC9E8', '#F78CD4'];

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function ChartBlock({
  kind,
  data,
  unit,
}: {
  kind: 'bar' | 'line' | 'pie';
  data: Datum[];
  unit?: string;
}) {
  const { lang } = useI18n();
  const accent = cssVar('--accent', '#4C7DFF');
  const grid = cssVar('--border', 'rgba(128,128,128,.2)');
  const text = cssVar('--text-2', '#666');
  const surface = cssVar('--panel-solid', '#fff');

  const axis = useMemo(
    () => ({
      stroke: grid,
      tick: { fill: text, fontSize: 11 },
      tickLine: false,
    }),
    [grid, text],
  );

  if (!data.length)
    return <p className="text-[0.85rem] text-[var(--text-3)]">—</p>;

  const tooltip = {
    contentStyle: {
      background: surface,
      border: `1px solid ${grid}`,
      borderRadius: 10,
      fontSize: 12,
      color: cssVar('--text', '#111'),
      direction: lang === 'ar' ? 'rtl' : 'ltr',
    } as React.CSSProperties,
    labelStyle: { color: text, fontSize: 11 },
    cursor: { fill: 'rgba(128,128,128,.12)' },
  };

  if (kind === 'pie')
    return (
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-56 w-full max-w-xs shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <RTooltip {...tooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2 text-[0.82rem] text-[var(--text-2)]">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="flex-1 truncate">{d.label}</span>
              <span className="font-mono font-semibold text-[var(--text)]">
                {d.value}
                {unit ?? ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
      <XAxis dataKey="label" {...axis} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 60 : 34} />
      <YAxis {...axis} width={44} />
      <RTooltip {...tooltip} />
    </>
  );

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            {common}
            <Line
              type="monotone"
              dataKey="value"
              stroke={accent}
              strokeWidth={2.5}
              dot={{ r: 3, fill: accent, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barSize={26}>
            {common}
            <Bar dataKey="value" fill={accent} radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
