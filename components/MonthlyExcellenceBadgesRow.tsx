/* eslint-disable react/no-unescaped-entities */
'use client';

import { useMemo, useState } from 'react';
import type { ApiResponse } from '@/lib/types';
import { CheckCircle2, Download, Info, Target, Zap } from 'lucide-react';

// Lazy import so html2canvas never touches the server bundle.
const loadHtml2Canvas = async () => (await import('html2canvas')).default;

type BadgeBlock = {
  achieved: Array<{ advisor: string; spaLeg?: string; tier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; value: number }>;
  close: Array<{ advisor: string; spaLeg?: string; targetTier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; remaining: number; value: number }>;
};

type BadgeFilter = 'All' | 'Spartans' | 'Legacy';

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

const filterBlock = (block: any, advisorFilter: BadgeFilter) => {
  if (advisorFilter === 'All') return block;
  const target = advisorFilter === 'Spartans' ? 'spartan' : 'legacy';
  return {
    achieved: (block.achieved ?? []).filter((r: any) => norm(r.spaLeg) === target),
    close: (block.close ?? []).filter((r: any) => norm(r.spaLeg) === target),
  };
};

const tierPill = (tier: string) => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border';
  // Master should be purple (not black)
  // Match the Silver/Gold/Diamond pill style (soft bg + colored text + subtle border)
  if (tier === 'Master') return `${base} bg-purple-50 text-purple-700 border-purple-200`;
  if (tier === 'Diamond') return `${base} bg-sky-50 text-sky-700 border-sky-200`;
  if (tier === 'Gold') return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
};

const GUIDE_THRESHOLDS = {
  premiums: { Silver: 100_000, Gold: 150_000, Diamond: 300_000, Master: 400_000 },
  savedLives: { Silver: 3, Gold: 4, Diamond: 6, Master: 8 },
  income: { Silver: 35_000, Gold: 50_000, Diamond: 100_000, Master: 140_000 },
} as const;

const formatCompact = (n: number) => {
  if (!Number.isFinite(n)) return '0';
  // Keep it simple and readable for managers
  return n >= 1000 ? n.toLocaleString('en-PH') : String(n);
};

function BadgeCard({
  title,
  unitLabel,
  block,
  valuePrefix,
  guide,
  onJolt,
  showJoltButton = true,
}: {
  title: string;
  unitLabel: string;
  block: BadgeBlock;
  valuePrefix?: string;
  guide: { Silver: number; Gold: number; Diamond: number; Master: number };
  onJolt?: () => void;
  showJoltButton?: boolean;
}) {
  const achieved = block.achieved.slice(0, 8);
  const close = block.close.slice(0, 8);

  return (
    // data-export-root lets the PNG exporter target the exact card node (no wrapper headroom)
    <div data-export-root="mea-badge-card" className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-slate-700">{title}</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">Counting: {unitLabel}</div>
          {showJoltButton ? (
            <button
              type="button"
              onClick={onJolt}
              className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
              title="Jolt"
              aria-label="Jolt"
            >
              <Zap className="h-4 w-4 text-slate-700" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            <Info className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Guide</span>
          </div>
          {/* 2 columns (2 rows each): left = Master/Diamond, right = Gold/Silver */}
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="flex items-center gap-1">
              <span className={tierPill('Master')}>Master</span>
              <span className="text-xs font-semibold text-slate-800">{valuePrefix ?? ''}{formatCompact(guide.Master)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={tierPill('Gold')}>Gold</span>
              <span className="text-xs font-semibold text-slate-800">{valuePrefix ?? ''}{formatCompact(guide.Gold)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={tierPill('Diamond')}>Diamond</span>
              <span className="text-xs font-semibold text-slate-800">{valuePrefix ?? ''}{formatCompact(guide.Diamond)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={tierPill('Silver')}>Silver</span>
              <span className="text-xs font-semibold text-slate-800">{valuePrefix ?? ''}{formatCompact(guide.Silver)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 pb-1 border-b border-slate-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            <span>Hit</span>
          </div>
          {achieved.length ? (
            <div className="mt-1 space-y-1">
              {achieved.map((a) => (
                // NOTE: html2canvas can clip ascenders when text is inside an overflow-hidden (truncate) box
                // and the capture scale introduces rounding. Give the text a tiny vertical padding so the
                // padding box has a bit more headroom and prevents clipping in exported PNGs.
                <div key={`hit-${a.advisor}-${a.tier}`} className="flex items-center justify-between gap-2">
                  <div className="truncate py-px text-sm text-slate-900">{a.advisor}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={tierPill(a.tier)}>{a.tier}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {valuePrefix ?? ''}{formatCompact(a.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1 text-xs text-slate-500">No one yet.</div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 pb-1 border-b border-slate-200">
            <Target className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            <span>Close</span>
          </div>
          {close.length ? (
            <div className="mt-1 space-y-1">
              {close.map((c) => (
                <div key={`close-${c.advisor}-${c.targetTier}`} className="flex items-center justify-between gap-2">
                  <div className="truncate py-px text-sm text-slate-900">{c.advisor}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={tierPill(c.targetTier)}>{c.targetTier}</span>
                    <span className="text-xs text-slate-500">+{valuePrefix ?? ''}{formatCompact(c.remaining)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1 text-xs text-slate-500">No one close yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MeabJoltModal({
  open,
  onClose,
  title,
  unitLabel,
  block,
  valuePrefix,
  guide,
  fileBase,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  unitLabel: string;
  block: BadgeBlock;
  valuePrefix?: string;
  guide: { Silver: number; Gold: number; Diamond: number; Master: number };
  fileBase: string;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [noteEl, setNoteEl] = useState<HTMLDivElement | null>(null);

  const trimTransparent = (canvas: HTMLCanvasElement, pad = 2) => {
    // Trim fully transparent outer rows/cols (html2canvas sometimes adds headroom).
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;

    const isRowEmpty = (y: number) => {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] !== 0) return false;
      }
      return true;
    };
    const isColEmpty = (x: number) => {
      for (let y = 0; y < height; y++) {
        if (data[(y * width + x) * 4 + 3] !== 0) return false;
      }
      return true;
    };

    let top = 0;
    while (top < height && isRowEmpty(top)) top++;
    let bottom = height - 1;
    while (bottom >= 0 && isRowEmpty(bottom)) bottom--;
    let left = 0;
    while (left < width && isColEmpty(left)) left++;
    let right = width - 1;
    while (right >= 0 && isColEmpty(right)) right--;

    if (top >= bottom || left >= right) return canvas;

    top = Math.max(0, top - pad);
    left = Math.max(0, left - pad);
    bottom = Math.min(height - 1, bottom + pad);
    right = Math.min(width - 1, right + pad);

    const w = right - left + 1;
    const h = bottom - top + 1;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    if (!octx) return canvas;
    octx.drawImage(canvas, left, top, w, h, 0, 0, w, h);
    return out;
  };

  const savePng = async () => {
    if (!noteEl) return;
    setSaving(true);
    setErr(null);

    // Exporting from within a modal/overlay can cause html2canvas to mis-measure text
    // (especially when transforms/backdrop effects are involved). To keep alignment
    // identical to what the user sees, we clone the card into an offscreen container
    // with no transforms/animations and capture that clone.
    let host: HTMLDivElement | null = null;
    try {
      const html2canvas = await loadHtml2Canvas();

      host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-10000px';
      host.style.top = '0';
      host.style.width = '420px';
      host.style.padding = '0';
      host.style.margin = '0';
      host.style.background = 'transparent';
      host.style.transform = 'none';
      host.style.filter = 'none';
      host.style.opacity = '1';
      host.style.pointerEvents = 'none';
      host.style.zIndex = '-1';

      const clone = noteEl.cloneNode(true) as HTMLDivElement;
      // Ensure the clone isn't affected by any inline transforms/animations.
      (clone.style as any).transform = 'none';
      clone.querySelectorAll('*').forEach((el) => {
        const h = el as HTMLElement;
        h.style.animation = 'none';
        h.style.transition = 'none';
        (h.style as any).transform = 'none';
      });

      host.appendChild(clone);
      document.body.appendChild(host);

      // Target the exact card element to avoid any wrapper headroom.
      const target = (clone.querySelector('[data-export-root="mea-badge-card"]') as HTMLElement) ?? clone;

      // html2canvas can clip text inside overflow-hidden (Tailwind `truncate`).
      // For export ONLY, make those boxes overflow-visible so ascenders never get cut.
      target.querySelectorAll('.truncate').forEach((el) => {
        const h = el as HTMLElement;
        h.style.overflow = 'visible';
        h.style.textOverflow = 'clip';
      });

      // Wait for fonts and layout to settle before capture.
      const fonts: any = (document as any).fonts;
      if (fonts?.ready) {
        await fonts.ready;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const canvas = await html2canvas(target, {
        backgroundColor: null,
        // A slightly lower scale reduces rounding issues that can cause clipping.
        scale: 2,
        useCORS: true,
      });
      const trimmed = trimTransparent(canvas, 2);
      const url = trimmed.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileBase}.png`;
      a.click();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to export image');
    } finally {
      host?.remove();
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-[420px] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>

          <div ref={setNoteEl}>
            <BadgeCard
              title={title}
              unitLabel={unitLabel}
              block={block}
              valuePrefix={valuePrefix}
              guide={guide}
              showJoltButton={false}
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={savePng}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save as PNG'}
            </button>
            {err ? <div className="text-xs text-red-600">{err}</div> : null}
            <div className="ml-auto text-xs text-slate-400">Tip: click outside to close.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MonthlyExcellenceBadgesRow({
  data,
  advisorFilter: externalFilter,
  onAdvisorFilterChange,
  showToggle = true,
}: {
  data: NonNullable<ApiResponse['monthlyExcellenceBadges']>;
  advisorFilter?: BadgeFilter;
  onAdvisorFilterChange?: (v: BadgeFilter) => void;
  showToggle?: boolean;
}) {
  const [internalFilter, setInternalFilter] = useState<BadgeFilter>('All');
  const advisorFilter = externalFilter ?? internalFilter;
  const setAdvisorFilter = (v: BadgeFilter) => {
    if (onAdvisorFilterChange) onAdvisorFilterChange(v);
    else setInternalFilter(v);
  };

const filtered = useMemo(() => {
    return {
      premiums: filterBlock(data.premiums, advisorFilter),
      savedLives: filterBlock(data.savedLives, advisorFilter),
      income: filterBlock(data.income, advisorFilter),
    };
  }, [advisorFilter, data.income, data.premiums, data.savedLives]);

  const [joltOpen, setJoltOpen] = useState<null | 'premiums' | 'savedLives' | 'income'>(null);

  return (
    <div className="grid gap-3">
  {showToggle ? (
      <div className="flex items-center justify-end">
        <div className="flex items-center rounded-xl bg-slate-100 p-1">
          {(['All', 'Spartans', 'Legacy'] as const).map((v) => (
            <button
              key={`meab-filter-${v}`}
              onClick={() => setAdvisorFilter(v)}
              className={`px-3 py-1.5 text-xs rounded-lg ${advisorFilter === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
  ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <BadgeCard
        title="Premiums (MDRT FYP)"
        unitLabel={data.asOfMonth}
        block={filtered.premiums}
        valuePrefix="₱"
        guide={GUIDE_THRESHOLDS.premiums}
        onJolt={() => setJoltOpen('premiums')}
        />
        <BadgeCard
        title="Saved lives (cases)"
        unitLabel={data.asOfMonth}
        block={filtered.savedLives}
        guide={GUIDE_THRESHOLDS.savedLives}
        onJolt={() => setJoltOpen('savedLives')}
        />
        <BadgeCard
        title="Income (FYC)"
        unitLabel={data.asOfMonth}
        block={filtered.income}
        valuePrefix="₱"
        guide={GUIDE_THRESHOLDS.income}
        onJolt={() => setJoltOpen('income')}
        />
      </div>

      <MeabJoltModal
        open={joltOpen === 'premiums'}
        onClose={() => setJoltOpen(null)}
        title="Premiums (MDRT FYP)"
        unitLabel={data.asOfMonth}
        block={filtered.premiums}
        valuePrefix="₱"
        guide={GUIDE_THRESHOLDS.premiums}
        fileBase={`MEA_Premiums_${data.asOfMonth.replace(/\s+/g, '_')}_${advisorFilter}`}
      />
      <MeabJoltModal
        open={joltOpen === 'savedLives'}
        onClose={() => setJoltOpen(null)}
        title="Saved lives (cases)"
        unitLabel={data.asOfMonth}
        block={filtered.savedLives}
        guide={GUIDE_THRESHOLDS.savedLives}
        fileBase={`MEA_SavedLives_${data.asOfMonth.replace(/\s+/g, '_')}_${advisorFilter}`}
      />
      <MeabJoltModal
        open={joltOpen === 'income'}
        onClose={() => setJoltOpen(null)}
        title="Income (FYC)"
        unitLabel={data.asOfMonth}
        block={filtered.income}
        valuePrefix="₱"
        guide={GUIDE_THRESHOLDS.income}
        fileBase={`MEA_Income_${data.asOfMonth.replace(/\s+/g, '_')}_${advisorFilter}`}
      />
    </div>
  );
}
