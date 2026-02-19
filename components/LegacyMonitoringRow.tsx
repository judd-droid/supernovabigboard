import { KpiCard } from './KpiCard';
import { Badge } from './Badge';
import { formatNumber, formatPeso } from '@/lib/format';
import type { SpartanAnimalsItem } from '@/lib/types';

export function LegacyMonitoringRow({
  data,
}: {
  data: {
    totalLegacies: number;
    producingLegacies: number;
    activityRatio: number;
    achievers: SpartanAnimalsItem[];
    totals: { approvedFyc: number; approvedCases: number; avgFycPerCase: number };
  };
}) {
  const pct = data.totalLegacies > 0 ? Math.round(data.activityRatio * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <KpiCard
        title="Legacy Activity Ratio"
        value={`${formatNumber(data.producingLegacies)} / ${formatNumber(data.totalLegacies)}`}
        sub={`${pct}% producing (Approved in range)`}
      />

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="slate">Legacy Achievers</Badge>
            <div className="text-xs text-slate-500">2+ approved cases</div>
          </div>
          <div className="text-xs text-slate-400">Cases</div>
        </div>
        <div className="max-h-[320px] overflow-auto">
          {data.achievers.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">None</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.achievers.map((a) => (
                <li key={a.advisor} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-slate-800">{a.advisor}</div>
                    {a.isAnimal ? <Badge tone="amber">6+</Badge> : null}
                  </div>
                  <div className="text-sm tabular-nums text-slate-700">{formatNumber(a.cases)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <KpiCard
        title="Legacy FYC & Cases"
        value={formatPeso(data.totals.approvedFyc)}
        sub={`Cases: ${formatNumber(data.totals.approvedCases)} · Avg FYC/case: ${formatPeso(data.totals.avgFycPerCase)}`}
      />
    </div>
  );
}
