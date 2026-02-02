import { formatPeso, formatNumber } from '@/lib/format';

export function ProductMix({
  rows,
}: {
  rows: Array<{ product: string; fyc: number; cases: number }>;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="p-3 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-700">Product mix</div>
        <div className="text-xs text-slate-400 mt-0.5">Approved (top 10)</div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="p-4 text-slate-500">No data</td></tr>
          ) : rows.map((r) => (
            <tr key={r.product} className="border-t border-slate-100">
              <td className="p-3 text-slate-800">{r.product}</td>
              <td className="p-3 text-right tabular-nums text-slate-600">{formatNumber(r.cases)}</td>
              <td className="p-3 text-right tabular-nums text-slate-700">{formatPeso(r.fyc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
