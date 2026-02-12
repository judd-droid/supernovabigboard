/* eslint-disable react/no-unescaped-entities */
'use client';

import { useMemo, useRef, useState } from 'react';
import { Badge } from './Badge';
import { formatNumber, formatPeso } from '@/lib/format';
import type { PpbTracker, PpbTrackerRow as PpbRow } from '@/lib/types';
import { Download, X, Zap } from 'lucide-react';

// Lazy import so html2canvas never touches the server bundle.
const loadHtml2Canvas = async () => (await import('html2canvas')).default;

const pct = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);

const safeFile = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9 _-]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);

export function PpbTrackerRow({ data }: { data: PpbTracker }) {
  const [m1, m2, m3] = data.months;

  type PpbAdvisorFilter = 'All' | 'Spartans' | 'Legacy';
  const [advisorFilter, setAdvisorFilter] = useState<PpbAdvisorFilter>('All');

  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

  const filteredRows = useMemo(() => {
    if (advisorFilter === 'All') return data.rows;
    const target = advisorFilter === 'Spartans' ? 'spartan' : 'legacy';
    return data.rows.filter(r => norm(r.spaLeg) === target);
  }, [advisorFilter, data.rows]);

  // Jolt (advisor-specific, shareable sticky note)
  const [joltRow, setJoltRow] = useState<PpbRow | null>(null);
  const noteRef = useRef<HTMLDivElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const closeJolt = () => setJoltRow(null);

  const saveJoltAsImage = async () => {
    if (!joltRow || !noteRef.current) return;
    setIsSaving(true);
    try {
      // Ensure web fonts are fully loaded before capture to avoid text metric glitches.
      // (This is a common cause of clipping in canvas renders.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fontsReady = (document as any).fonts?.ready;
      if (fontsReady) await fontsReady;

      const html2canvas = await loadHtml2Canvas();

      // Capture the note as-is.
      // We keep the DOM styling identical between popup and PNG so the image matches perfectly.
      // Use a higher capture scale to reduce html2canvas font-metric rounding artifacts
      // (a common cause of top-edge clipping for bold text in PNG exports on some machines).
      const canvas = await html2canvas(noteRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#FEF9C3', // tailwind yellow-100
      } as any);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `PPB-Jolt_${safeFile(joltRow.advisor)}_${safeFile(data.quarter)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Badge tone="slate">PPB Tracker</Badge>
            <div className="text-xs text-slate-500">{data.quarter} (QTD)</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-slate-100 p-1">
              {(['All', 'Spartans', 'Legacy'] as const).map((v) => (
                <button
                  key={`ppb-filter-${v}`}
                  onClick={() => setAdvisorFilter(v)}
                  className={`px-3 py-1.5 text-xs rounded-lg ${advisorFilter === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400">FYC · Cases</div>
          </div>
        </div>

        <div className="max-h-[360px] overflow-auto p-3">
          {filteredRows.length === 0 ? (
            <div className="text-sm text-slate-500">
              {data.rows.length === 0
                ? 'No approved sales in this quarter yet.'
                : 'No advisors match the selected filter yet.'}
            </div>
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
                {filteredRows.map((r) => (
                  <tr key={`ppb-${r.advisor}`}>
                    <td className="py-2 pr-3 font-medium text-slate-800 max-w-[260px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => setJoltRow(r)}
                          title="Open Jolt note"
                          aria-label={`Open Jolt note for ${r.advisor}`}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm shrink-0"
                        >
                          <Zap size={15} />
                        </button>
                        <span className="truncate" title={r.advisor}>
                          {r.advisor}
                        </span>
                      </div>
                    </td>
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

    {joltRow && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4"
        onMouseDown={closeJolt}
      >
        <div className="max-w-full" onMouseDown={(e) => e.stopPropagation()}>
          <div className="relative">
            <div
              ref={noteRef}
              data-jolt-note="1"
              className="relative w-[360px] max-w-[92vw] h-[360px] bg-yellow-100 border border-yellow-200 rounded-2xl shadow-xl p-5"
            >
              {/*
                NOTE (export stability):
                html2canvas can clip large, bold text when the element uses `truncate` (overflow-hidden).
                We clamp to 2 lines instead, add a tiny top padding, and keep overflow only for clamping.
              */}
              {/* Main note content (reserve space at bottom for footer + logo stamp) */}
              <div className="pb-14">
                <div
                  data-jolt-title="1"
                  // IMPORTANT (export fidelity):
                  // html2canvas can clip the top of bold text when the title is overflow-clamped.
                  // We avoid overflow clamping entirely and let it wrap naturally.
                  className="text-[12px] font-bold text-slate-900 leading-[1.35] pr-1 break-words"
                  title={joltRow.advisor}
                >
                  {joltRow.advisor}
                </div>
                <div className="text-[9px] text-slate-700 mt-0.5">
                  {data.quarter} • Quarter-to-date PPB
                </div>

                <div className="mt-3 h-px bg-slate-900/10" />

              <div className="mt-3 text-[11px] text-slate-900 leading-snug">
                {joltRow.totalBonusRate > 0 ? (
                  <>
                    Well done — you&apos;re at <span className="font-extrabold">{pct(joltRow.totalBonusRate)}</span> total bonus rate so far.
                  </>
                ) : (
                  <>No bonus yet — let&apos;s get you into your first tier.</>
                )}
              </div>

              <div className="mt-3 text-[11px] text-slate-900">
                <div className="font-semibold text-[11px]">How you got here</div>
                <ul className="mt-1 space-y-1">
                  <li>
                    • FYC: <span className="font-extrabold text-[12px]">{formatPeso(joltRow.fyc)}</span> →{' '}
                    <span className="font-extrabold text-[12px]">{pct(joltRow.ppbRate)}</span>
                  </li>
                  <li>
                    • Cases: <span className="font-extrabold text-[12px]">{formatNumber(joltRow.cases)}</span>{' '}
                    {joltRow.ccbRate == null ? (
                      <span className="text-slate-600">(CCB not applicable)</span>
                    ) : (
                      <>
                        → <span className="font-extrabold text-[12px]">+{pct(joltRow.ccbRate)}</span>
                      </>
                    )}
                  </li>
                </ul>
              </div>

              <div className="mt-3 text-[11px] text-slate-900">
                <div className="font-semibold text-[11px]">To reach the next level</div>

                {joltRow.fycToNextBonusTier == null && joltRow.casesToNextCcbTier == null ? (
                  <div className="mt-1 text-slate-700">You&apos;re already at the top tier for this bonus. Keep compounding.</div>
                ) : (
                  <div className="mt-1 space-y-1">
                    {joltRow.fycToNextBonusTier != null && (
                      <div>
                        • +<span className="font-extrabold text-[12px]">{formatPeso(joltRow.fycToNextBonusTier)}</span> FYC →{' '}
                        <span className="font-extrabold text-[12px]">{pct(joltRow.nextPpbRate)}</span>
                      </div>
                    )}
                    {joltRow.fycToNextBonusTier != null && joltRow.casesToNextCcbTier != null && (
                      <div className="text-slate-600 italic">{joltRow.totalBonusRate > 0 ? 'and/or' : 'then'}</div>
                    )}
                    {joltRow.casesToNextCcbTier != null && (
                      <div>
                        • +<span className="font-extrabold text-[12px]">{formatNumber(joltRow.casesToNextCcbTier)}</span> case(s) →{' '}
                        <span className="font-extrabold text-[12px]">+{pct(joltRow.nextCcbRate)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

                <div className="mt-4 text-[10px] text-slate-800 italic">Godspeed ⚡</div>
              </div>

              {/* Footer + stamp (captured in PNG export)
                  Slight upward nudge to visually align footer text with the stamp bottom. */}
              <div className="absolute bottom-4 left-5 right-16 -translate-y-1 text-[8px] leading-snug text-slate-700/90">
                Stats are based on Supernova records. For the most accurate, up-to-date stats, refer to official trackers and your Sales Indicator (Agency Portal).
              </div>
              <img
                src="/supernova-stamp.png"
                alt="Supernova"
                className="absolute bottom-4 right-4 w-10 h-auto opacity-80"
                loading="eager"
              />
            </div>

            <button
              type="button"
              onClick={closeJolt}
              aria-label="Close"
              className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={saveJoltAsImage}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              <Download size={14} />
              {isSaving ? 'Saving…' : 'Save as PNG'}
            </button>
            <div className="text-[11px] text-slate-100/90">Tip: click outside the note to close.</div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
