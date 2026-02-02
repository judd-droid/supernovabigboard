'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatPeso } from '@/lib/format';

export function TrendChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ date: string; fyc: number; fyp: number; cases: number }>;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="p-3 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">Approved FYC over time</div>
      </div>
      <div className="h-[240px] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v/1000)}k`} />
            <Tooltip formatter={(v: any) => formatPeso(Number(v))} />
            <Line type="monotone" dataKey="fyc" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
