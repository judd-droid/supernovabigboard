import { formatPeso } from '@/lib/format';

export function Leaderboard({
  title,
  rows,
  valueLabel,
}: {
  title: string;
  rows: Array<{ name: string; value: number }>;
  valueLabel: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="p-3 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{valueLabel}</div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="p-4 text-slate-500">No data</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.name} className="border-t border-slate-100">
              <td className="p-3 text-slate-500 w-10">{i + 1}</td>
              <td className="p-3 font-medium text-slate-800">{r.name}</td>
              <td className="p-3 text-right tabular-nums text-slate-700">{formatPeso(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
