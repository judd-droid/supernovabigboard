import { Badge } from './Badge';
import { formatNumber, formatPeso } from '@/lib/format';
import type { ProductSaleItem } from '@/lib/types';

function sumFyc(items: ProductSaleItem[]) {
  return items.reduce((acc, r) => acc + (r.fyc ?? 0), 0);
}

function SaleList({
  label,
  items,
}: {
  label: string;
  items: ProductSaleItem[];
}) {
  const total = sumFyc(items);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">
          {formatNumber(items.length)} · {formatPeso(total)}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="mt-1 text-xs text-slate-400">None</div>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {items.map((s, idx) => (
            <li key={`${s.policyNumber ?? idx}-${idx}`} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{s.advisor}</div>
                <div className="text-xs text-slate-500 truncate">{s.product}</div>
              </div>
              <div className="text-sm tabular-nums text-slate-700 whitespace-nowrap">{formatPeso(s.fyc)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SpecialLookoutsRow({
  productSellers,
  consistentMonthlyProducers,
}: {
  productSellers: {
    aPlusSignature: ProductSaleItem[];
    ascend: ProductSaleItem[];
    futureSafeUsd5Pay: ProductSaleItem[];
  };
  consistentMonthlyProducers: {
    asOfMonth: string;
    threePlus: Array<{ advisor: string; streakMonths: number }>;
    watch2: Array<{ advisor: string; streakMonths: number }>;
    watch1: Array<{ advisor: string; streakMonths: number }>;
  };
}) {
  const { threePlus, watch2, watch1 } = consistentMonthlyProducers;

  const AnyList = ({ title, items, tone }: { title: string; items: Array<{ advisor: string; streakMonths: number }>; tone: 'green' | 'amber' | 'slate' }) => (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <div className="text-xs text-slate-500">{formatNumber(items.length)}</div>
      </div>
      {items.length === 0 ? (
        <div className="mt-1 text-xs text-slate-400">None</div>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {items.map((c) => (
            <li key={`${title}-${c.advisor}`} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{c.advisor}</div>
                <div className="text-xs text-slate-500">{formatNumber(c.streakMonths)} mo</div>
              </div>
              <Badge tone={tone}>{formatNumber(c.streakMonths)} mo</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="slate">Product lookouts</Badge>
            <div className="text-xs text-slate-500">Approved only (in range)</div>
          </div>
          <div className="text-xs text-slate-400">FYC</div>
        </div>
        <div className="max-h-[320px] overflow-auto p-3">
          <SaleList label="A+ Signature (all variants)" items={productSellers.aPlusSignature} />
          <SaleList label="Ascend (all variants)" items={productSellers.ascend} />
          <SaleList label="FutureSafe USD (5-Pay)" items={productSellers.futureSafeUsd5Pay} />
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="green">Consistent Monthly Producers</Badge>
            <div className="text-xs text-slate-500">As of {consistentMonthlyProducers.asOfMonth}</div>
          </div>
          <div className="text-xs text-slate-400">Streak</div>
        </div>
        <div className="max-h-[320px] overflow-auto p-3">
          <AnyList title="3+ Months CMP" items={threePlus} tone="green" />
          <AnyList title="Watchlist: 2 Months" items={watch2} tone="amber" />
          <AnyList title="Watchlist: 1 Month" items={watch1} tone="slate" />
        </div>
        <div className="p-3 border-t border-slate-200 text-xs text-slate-500">
          Rule: 3+ consecutive months with ≥1 approved case. Window ends on the selected range end month. Carries over from "Months CMP 2025" when streak reaches Jan 2026.
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <Badge tone="slate">Reserved</Badge>
          <div className="text-xs text-slate-400">—</div>
        </div>
        <div className="p-4 text-sm text-slate-500">Placeholder for the next lookout panel.</div>
      </div>
    </div>
  );
}
