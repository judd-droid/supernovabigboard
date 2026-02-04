import { Badge } from './Badge';
import { formatNumber, formatPeso } from '@/lib/format';
import type { PpbTracker } from '@/lib/types';

export function PpbTrackerRow({ data }: { data: PpbTracker }) {
  const [m1, m2, m3] = data.months;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="slate">PPB Tracker</Badge>
            <div className="text-xs text-slate-500">{data.quarter} (QTD)</div>
          </div>
          <div className="text-xs text-slate-400">FYC · Cases</div>
        </div>

        <div className="max-h-[320px] overflow-auto p-3">
          {data.rows.length === 0 ? (
            <div className="text-sm text-slate-500">No approved sales in this quarter yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-slate-500">
                  <th className="text-left font-semibold py-2 pr-3">Advisor</th>
                  <th className="text-right font-semibold py-2 pr-3">FYC</th>
                  <th className="text-right font-semibold py-2 pr-3">Cases</th>
                  <th className="text-right font-semibold py-2 pr-3">{m1}</th>
                  <th className="text-right font-semibold py-2 pr-3">{m2}</th>
                  <th className="text-right font-semibold py-2 pr-3">{m3}</th>
                  <th className="text-right font-semibold py-2 pr-3">Projected Bonus</th>
                  <th className="text-right font-semibold py-2">Next FYC Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={`ppb-${r.advisor}`}>
                    <td className="py-2 pr-3 font-medium text-slate-800 max-w-[220px] truncate">{r.advisor}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatPeso(r.fyc)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(r.cases)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(r.m1Cases)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(r.m2Cases)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(r.m3Cases)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{r.projectedBonus == null ? '—' : formatPeso(r.projectedBonus)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-700">{r.balanceToNextTier == null ? '—' : formatPeso(r.balanceToNextTier)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-3 border-t border-slate-200 text-xs text-slate-500">
          Case counts exclude Guardian variants. Guardian FYC is still included in total FYC. Projected Bonus assumes 82.5%+ persistency (100% multiplier) and ignores net adjustments.
        </div>
      </div>

      {/* Placeholder panel */}
      <div className="rounded-2xl bg-white border border-dashed border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="slate">(Reserved)</Badge>
            <div className="text-xs text-slate-500">Coming soon</div>
          </div>
        </div>
        <div className="p-3 text-sm text-slate-500">
          Leave blank for now.
        </div>
      </div>
    </div>
  );
}
