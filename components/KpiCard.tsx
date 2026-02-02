import { ReactNode } from 'react';

export function KpiCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">{title}</div>
        {icon ? <div className="text-slate-400">{icon}</div> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}
