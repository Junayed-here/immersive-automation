'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DEFAULT_COLORS = ['#3E6E63', '#B9713D', '#5C8E82', '#A6432F', '#2C5049'];

/**
 * @param {{label: string, value: number}[]} data
 */
export function BreakdownBarChart({ data, height = 220, color }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex items-center justify-center text-sm text-slate" style={{ height }}>
        No activity yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D8DCD6" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#556059' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 11, fill: '#556059' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #D8DCD6' }} cursor={{ fill: '#16211C', fillOpacity: 0.04 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry, i) => (
            <Cell key={entry.label} fill={color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
