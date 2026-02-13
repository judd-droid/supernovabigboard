import { Badge } from './Badge';
import { formatNumber, formatPeso } from '@/lib/format';
import type { ProductSaleItem, SalesRoundupItem } from '@/lib/types';
import { useMemo, useState } from 'react';

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
  salesRoundup,
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
  salesRoundup: SalesRoundupItem[];
}) {
  const { threePlus, watch2, watch1 } = consistentMonthlyProducers;
  const asOfDisplay = (consistentMonthlyProducers.asOfMonth ?? '').replace('-', '/');

  type SalesAdvisorFilter = 'All' | 'Spartans' | 'Legacy';
  const [salesAdvisorFilter, setSalesAdvisorFilter] = useState<SalesAdvisorFilter>('All');

  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

  const filteredSalesRoundup = useMemo(() => {
    if (!salesRoundup) return [];
    if (salesAdvisorFilter === 'All') return salesRoundup;
    const want = salesAdvisorFilter === 'Spartans' ? 'spa' : 'leg';
    return salesRoundup.filter((s) => {
      const n = norm(s.spaLeg);
      if (!n) return false;
      return n.startsWith(want);
    });
  }, [salesAdvisorFilter, salesRoundup]);

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const salesRoundupText = useMemo(() => {
    if (!filteredSalesRoundup || filteredSalesRoundup.length === 0) return '';
    return filteredSalesRoundup
      .map((s) => {
        const showAmt = (s.afyc ?? 0) >= 1000;
        const left = `${s.advisor ?? ''} — ${s.product ?? ''}`.trim();
        return showAmt ? `${left} — ${formatPeso(s.afyc)}` : left;
      })
      .join('\n');
  }, [filteredSalesRoundup]);

  const copySalesRoundup = async () => {
    if (!salesRoundupText) return;
    try {
      // Prefer async clipboard API (works on https / localhost)
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(salesRoundupText);
      } else {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = salesRoundupText;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      setCopyError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setCopied(false);
      setCopyError('Copy failed. Try again.');
      window.setTimeout(() => setCopyError(null), 2500);
    }
  };

  const AnyList = ({ title, items, tone }: { title: string; items: Array<{ advisor: string; streakMonths: number }>; tone: 'green' | 'amber' | 'slate' }) => (
    <div className="mt-3">
      {/* Section header */}
      <div className="-mx-3 px-3 py-2 bg-slate-50 border-y border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
          <span className="text-[11px] font-semibold text-slate-500">{formatNumber(items.length)}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="mt-2 text-xs text-slate-400">None</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <li key={`${title}-${c.advisor}`} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{c.advisor}</div>
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
            <Badge tone="green">CMP as of {asOfDisplay}</Badge>
          </div>
          <div className="text-xs text-slate-400">Streak</div>
        </div>
        <div className="max-h-[320px] overflow-auto p-3">
          <AnyList title="3+ Months CMP" items={threePlus} tone="green" />
          <AnyList title="2 Months CMP" items={watch2} tone="amber" />
          <AnyList title="1 Month CMP" items={watch1} tone="slate" />
        </div>
        <div className="p-3 border-t border-slate-200 text-xs text-slate-500">
          Rule: consecutive months with ≥1 approved case. Computed through the month shown. Carries over from "Months CMP 2025" when streak reaches Jan 2026.
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="slate">Sales Round-up</Badge>
            <div className="text-xs text-slate-500">Approved only (in range)</div>
          </div>
          <div className="text-xs text-slate-400">AFYC</div>
        </div>
        <div className="max-h-[320px] overflow-auto p-3">
          {filteredSalesRoundup.length === 0 ? (
            <div className="text-sm text-slate-500">No approved sales in range.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredSalesRoundup.map((s, idx) => {
                const show = (s.afyc ?? 0) >= 1000;
                const key = `${s.policyNumber ?? ''}-${idx}`;
                return (
                  <li key={key} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0 text-sm text-slate-800 truncate">
                      <span className="font-medium">{s.advisor}</span>
                      <span className="text-slate-400"> — </span>
                      <span className="text-slate-600 font-normal">{s.product}</span>
                    </div>
                    <div className="text-sm tabular-nums text-slate-700 whitespace-nowrap">
                      {show ? formatPeso(s.afyc) : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={copySalesRoundup}
            disabled={!salesRoundupText}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
            aria-label="Copy sales list to clipboard"
            title="Copy the sales list to clipboard"
          >
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-slate-100 p-1">
              {(['All', 'Spartans', 'Legacy'] as const).map((v) => (
                <button
                  key={`sales-roundup-filter-${v}`}
                  onClick={() => setSalesAdvisorFilter(v)}
                  className={`px-3 py-1.5 text-xs rounded-lg ${salesAdvisorFilter === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                  aria-label={`Show ${v} advisors in Sales Round-up`}
                  title={`Show ${v} advisors`}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* Screen-reader only status for copy errors */}
            <div className="sr-only" aria-live="polite">{copyError ?? (copied ? 'Copied' : '')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
