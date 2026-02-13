import type { ApiResponse } from '@/lib/types';

type BadgeBlock = {
  achieved: Array<{ advisor: string; tier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; value: number }>;
  close: Array<{ advisor: string; targetTier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; remaining: number; value: number }>;
};

const tierPill = (tier: string) => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border';
  if (tier === 'Master') return `${base} bg-slate-900 text-white border-slate-900`;
  if (tier === 'Diamond') return `${base} bg-sky-50 text-sky-700 border-sky-200`;
  if (tier === 'Gold') return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
};

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
}: {
  title: string;
  unitLabel: string;
  block: BadgeBlock;
  valuePrefix?: string;
}) {
  const achieved = block.achieved.slice(0, 8);
  const close = block.close.slice(0, 8);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-slate-700">{title}</div>
        <div className="text-xs text-slate-500">Counting: {unitLabel}</div>
      </div>

      <div className="mt-3 grid gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-600">Hit</div>
          {achieved.length ? (
            <div className="mt-1 space-y-1">
              {achieved.map((a) => (
                <div key={`hit-${a.advisor}-${a.tier}`} className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm text-slate-900">{a.advisor}</div>
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
          <div className="text-xs font-semibold text-slate-600">Close</div>
          {close.length ? (
            <div className="mt-1 space-y-1">
              {close.map((c) => (
                <div key={`close-${c.advisor}-${c.targetTier}`} className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm text-slate-900">{c.advisor}</div>
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

export function MonthlyExcellenceBadgesRow({
  data,
}: {
  data: NonNullable<ApiResponse['monthlyExcellenceBadges']>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <BadgeCard
        title="Premiums (MDRT FYP)"
        unitLabel={data.asOfMonth}
        block={data.premiums}
        valuePrefix="₱"
      />
      <BadgeCard
        title="Saved lives (cases)"
        unitLabel={data.asOfMonth}
        block={data.savedLives}
      />
      <BadgeCard
        title="Income (FYC)"
        unitLabel={data.asOfMonth}
        block={data.income}
        valuePrefix="₱"
      />
    </div>
  );
}
