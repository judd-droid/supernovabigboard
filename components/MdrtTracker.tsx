/* eslint-disable react/no-unescaped-entities */
'use client';

import { useMemo, useState } from 'react';
import { formatPeso } from '@/lib/format';
import { CopySummaryButton } from './CopySummaryButton';

export function MdrtTracker({
  data,
}: {
  data: {
    asOf: string;
    targetPremium: number;
    rows: Array<{
      advisor: string;
      spaLeg?: string;
      mdrtFyp: number;
      balanceToMdrt: number;
      balanceToCot?: number | null;
      balanceToTot?: number | null;
    }>;
  };
}) {
  const target = data.targetPremium;

  type AdvisorFilter = 'All' | 'Spartans' | 'Legacy';
  const [advisorFilter, setAdvisorFilter] = useState<AdvisorFilter>('All');

  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (advisorFilter === 'All') return data.rows;
    const targetKey = advisorFilter === 'Spartans' ? 'spartan' : 'legacy';
    return data.rows.filter((r) => norm(r.spaLeg) === targetKey);
  }, [advisorFilter, data.rows]);

  const summaryText = useMemo(() => {
    const header = `## MDRT Tracker (YTD · as of ${data.asOf}) (${advisorFilter})`;
    const meta = `- Target (Premium): ${formatPeso(target)}`;
    const cols = ['Advisor', 'YTD MDRT FYP', 'Balance to MDRT', 'Status'];

    const lines = filteredRows.map((r) => {
      const achievedMdrt = r.mdrtFyp >= target;
      const status = achievedMdrt
        ? `Qualified (COT bal ${formatPeso(r.balanceToCot ?? 0)}; TOT bal ${formatPeso(r.balanceToTot ?? 0)})`
        : `Not yet`;
      return [
        r.advisor,
        formatPeso(r.mdrtFyp),
        formatPeso(r.balanceToMdrt),
        status,
      ].join(' | ');
    });

    return [header, '', meta, '', cols.join(' | '), ...lines].join('\n');
  }, [advisorFilter, data.asOf, filteredRows, target]);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-semibold text-slate-700">YTD MDRT FYP</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-slate-100 p-1">
              {(['All', 'Spartans', 'Legacy'] as const).map((v) => (
                <button
                  key={`mdrt-filter-${v}`}
                  onClick={() => setAdvisorFilter(v)}
                  className={`px-3 py-1.5 text-xs rounded-lg ${advisorFilter === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <CopySummaryButton
              getText={() => summaryText}
              title="Copy MDRT Tracker summary"
              ariaLabel="Copy MDRT Tracker text summary to clipboard"
            />
            <div className="text-xs text-slate-400">As of {data.asOf}</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 mt-0.5">Target (Premium): {formatPeso(target)}</div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th className="text-left font-medium px-3 py-2 w-10">#</th>
            <th className="text-left font-medium px-3 py-2">Advisor</th>
            <th className="text-right font-medium px-3 py-2">YTD</th>
            <th className="text-right font-medium px-3 py-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr><td className="p-4 text-slate-500" colSpan={4}>No data</td></tr>
          ) : filteredRows.map((r, i) => {
            const achievedMdrt = r.mdrtFyp >= target;
            const achievedCot = achievedMdrt && (r.balanceToCot ?? null) === 0;
            const achievedTot = achievedMdrt && (r.balanceToTot ?? null) === 0;
            return (
              <tr key={`${r.advisor}-${i}`} className="border-t border-slate-100">
                <td className="p-3 text-slate-500 w-10">{i + 1}</td>
                <td className="p-3 font-medium text-slate-800">
                  <div className="flex items-center gap-2">
                    <span>{r.advisor}</span>
                    {achievedMdrt ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">MDRT</span>
                    ) : null}
                    {achievedCot ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700">COT</span>
                    ) : null}
                    {achievedTot ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700">TOT</span>
                    ) : null}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums text-slate-700">{formatPeso(r.mdrtFyp)}</td>
                <td className="p-3 text-right tabular-nums">
                  {achievedMdrt ? (
                    <div className="text-xs text-slate-500 leading-tight">
                      <div className="text-emerald-700 font-medium">Qualified</div>
                      <div>
                        COT: {formatPeso(r.balanceToCot ?? 0)}
                      </div>
                      <div>
                        TOT: {formatPeso(r.balanceToTot ?? 0)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-700">{formatPeso(r.balanceToMdrt)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
