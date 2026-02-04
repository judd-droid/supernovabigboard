import { Badge } from './Badge';
import { formatNumber, formatPeso } from '@/lib/format';
import type { PpbTracker } from '@/lib/types';

export function PpbTrackerRow({ data }: { data: PpbTracker }) {
  const [m1, m2, m3] = data.months;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="slate">PPB Tracker</Badge>
            <div className="text-xs text-slate-500">{data.quarter} (QTD)</div>
          </div>
          <div className="text-xs text-slate-400">FYC · Cases</div>
        </div>

        <div className="max-h-[360px] overflow-auto p-3">
          {data.rows.length === 0 ? (
            <div className="text-sm text-slate-500">No approved sales in this quarter yet.</div>
          ) : (
            <table className="w-full text-sm min-w-[1180px]">
              <thead>
                <tr className="text-[11px] text-slate-500">
                  <th className="text-left font-semibold py-2 pr-3">Advisor</th>
                  <th className="text-right font-semibold py-2 pr-3">FYC</th>
                  <th className="text-right font-semibold py-2 pr-3">Cases</th>
                  <th className="text-right font-semibold py-2 pr-3">{m1}</th>
                  <th className="text-right font-semibold py-2 pr-3">{m2}</th>
                  <th className="text-right font-semibold py-2 pr-3">{m3}</th>
                  <th className="text-right font-semibold py-2 pr-3">Total Bonus Rate</th>
                  <th className="text-right font-semibold py-2 pr-3">PPB Rate</th>
                  <th className="text-right font-semibold py-2 pr-3">Projected Bonus</th>
                  <th className="text-right font-semibold py-2 pr-3">FYC to Next Bonus Tier</th>
                  <th className="text-right font-semibold py-2 pr-3">CCB Rate</th>
                  <th className="text-right font-semibold py-2">Cases to Next CCB Tier</th>
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
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.totalBonusRate > 0 ? (
                        <span className="inline-flex items-center justify-end rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold">
                          {Math.round(r.totalBonusRate * 100)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {r.ppbRate > 0 ? `${Math.round(r.ppbRate * 100)}%` : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.projectedBonus == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className="inline-flex items-center justify-end rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold">
                          {formatPeso(r.projectedBonus)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {r.fycToNextBonusTier == null ? (
                        '—'
                      ) : (
                        <>
                          {formatPeso(r.fycToNextBonusTier)}
                          {r.nextPpbRate != null ? ` (${Math.round(r.nextPpbRate * 100)}%)` : ''}
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {r.ccbRate == null ? '—' : `${Math.round(r.ccbRate * 100)}%`}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-700">
                      {r.casesToNextCcbTier == null ? (
                        '—'
                      ) : (
                        <>
                          +{formatNumber(r.casesToNextCcbTier)}
                          {r.nextCcbRate != null ? ` (${Math.round(r.nextCcbRate * 100)}%)` : ''}
                        </>
                      )}
                    </td>
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
  );
}
