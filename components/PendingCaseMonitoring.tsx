'use client';

import type { PendingCaseRow } from '@/lib/types';
import { formatPeso } from '@/lib/format';

const urgencyColor = (days: number) => {
  if (days >= 30) return 'text-red-600 font-semibold';
  if (days >= 14) return 'text-amber-600 font-medium';
  return 'text-slate-600';
};

const urgencyBadge = (days: number) => {
  if (days >= 30) return 'bg-red-100 text-red-700';
  if (days >= 14) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

export function PendingCaseMonitoring({ rows }: { rows: PendingCaseRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center text-slate-500">
        No pending cases
      </div>
    );
  }

  const totalANP = rows.reduce((s, r) => s + r.anp, 0);
  const totalFYC = rows.reduce((s, r) => s + r.fyc, 0);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50 text-sm">
        <span className="text-slate-500">
          <span className="font-semibold text-slate-800">{rows.length}</span> pending case{rows.length !== 1 ? 's' : ''}
        </span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-500">
          Total ANP: <span className="font-semibold text-slate-800">{formatPeso(totalANP)}</span>
        </span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-500">
          Total FYC: <span className="font-semibold text-slate-800">{formatPeso(totalFYC)}</span>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-2.5">Advisor</th>
              <th className="px-4 py-2.5">Policy #</th>
              <th className="px-4 py-2.5">Policy Owner</th>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5 text-right">ANP</th>
              <th className="px-4 py-2.5 text-right">FYC</th>
              <th className="px-4 py-2.5">Date Paid</th>
              <th className="px-4 py-2.5 text-center">Time Pending</th>
              <th className="px-4 py-2.5">Remarks / Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.policyNumber}-${i}`}
                className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{r.advisor}</td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{r.policyNumber || '—'}</td>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{r.policyOwnerInitials}</td>
                <td className="px-4 py-2.5 text-slate-700">{r.product}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatPeso(r.anp)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatPeso(r.fyc)}</td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">{r.datePaid}</td>
                <td className="px-4 py-2.5 text-center whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${urgencyBadge(r.daysPending)}`}>
                    {r.daysPending}d
                  </span>
                </td>
                <td className={`px-4 py-2.5 max-w-[240px] truncate ${r.remarks ? 'text-slate-700' : 'text-slate-400'}`}>
                  {r.remarks || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
