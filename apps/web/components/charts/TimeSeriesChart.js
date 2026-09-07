'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatTick(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * @param {{date: string}[]} data - one point per day, other keys matching `series[].key`
 * @param {{key: string, label: string, color: string}[]} series
 */
export function TimeSeriesChart({ data, series, height = 220 }) {
  const hasActivity = data.some((point) => series.some((s) => point[s.key] > 0));

  if (!hasActivity) {
    return (
      <div className="flex items-center justify-center text-sm text-slate" style={{ height }}>
        No activity yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D8DCD6" vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#556059' }} axisLine={{ stroke: '#D8DCD6' }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#556059' }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          labelFormatter={formatTick}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #D8DCD6' }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
