import { MoneyKpis, SalesRow, AdvisorStatus, RangePreset, RosterEntry, DprRow } from './types';
import { formatISODate, normalizeName, monthApprovedToDate } from './parse';

export const buildRosterIndex = (entries: RosterEntry[]) => {
  const idx = new Map<string, RosterEntry>();
  for (const e of entries) {
    const key = normalizeName(e.advisor);
    if (!key) continue;
    if (!idx.has(key)) idx.set(key, e);
  }
  return idx;
};

export const emptyKpis = (): MoneyKpis => ({
  anp: 0,
  fyp: 0,
  fyc: 0,
  afyc: 0,
  mdrtFyp: 0,
  caseCount: 0,
  faceAmount: 0,
});

export const addRowToKpis = (k: MoneyKpis, r: SalesRow): MoneyKpis => {
  k.anp += r.anp ?? 0;
  k.fyp += r.fyp ?? 0;
  k.fyc += r.fyc ?? 0;
  k.afyc += r.afyc ?? 0;
  k.mdrtFyp += r.mdrtFyp ?? 0;
  k.caseCount += r.caseCount ?? 0;
  k.faceAmount += r.faceAmount ?? 0;
  return k;
};

export const getPresetRange = (preset: RangePreset, now: Date): { start: Date; end: Date } => {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  const end = new Date(Date.UTC(y, m, d));

  if (preset === 'MTD') {
    return { start: new Date(Date.UTC(y, m, 1)), end };
  }
  if (preset === 'QTD') {
    const q = Math.floor(m / 3);
    const qm = q * 3;
    return { start: new Date(Date.UTC(y, qm, 1)), end };
  }
  if (preset === 'PREV_MONTH') {
    // Previous calendar month (Manila-aligned date is already baked into `now` upstream)
    // Start: first day of previous month
    // End: last day of previous month
    return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 0)) };
  }
  // YTD
  return { start: new Date(Date.UTC(y, 0, 1)), end };
};

export const inRange = (date: Date | null | undefined, start: Date, end: Date): boolean => {
  if (!date) return false;
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
};

export const isApprovedInRange = (r: SalesRow, start: Date, end: Date): boolean => {
  if (inRange(r.dateApproved, start, end)) return true;
  // Fallback to Month Approved if Date Approved is missing
  if (!r.dateApproved && r.monthApproved) {
    const md = monthApprovedToDate(r.monthApproved);
    if (!md) return false;
    // Consider in range if month start is within same month window
    return md.getTime() >= new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)).getTime() &&
      md.getTime() <= new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)).getTime();
  }
  return false;
};

export const buildAdvisorStatuses = (
  rows: SalesRow[],
  rosterEntries: RosterEntry[],
  start: Date,
  end: Date,
  unitFilter: string | null
): {
  advisors: AdvisorStatus[];
  producing: AdvisorStatus[];
  pending: AdvisorStatus[];
  nonProducing: AdvisorStatus[];
} => {
  const rosterIndex = buildRosterIndex(rosterEntries);
  const rosterUnique = Array.from(new Map(rosterEntries.map(e => [normalizeName(e.advisor), e.advisor])).values());

  // Initialize map for all roster advisors.
  const map = new Map<string, AdvisorStatus>();
  for (const name of rosterUnique) {
    const key = normalizeName(name);
    const unit = rosterIndex.get(key)?.unit;

    if (unitFilter && unitFilter !== 'All') {
      const u = (unit || 'Unassigned').trim() || 'Unassigned';
      if (u !== unitFilter) continue;
    }

    map.set(normalizeName(name), {
      advisor: name,
      unit,
      approved: emptyKpis(),
      submitted: emptyKpis(),
      paid: emptyKpis(),
      open: emptyKpis(),
    });
  }

  for (const r of rows) {
    const advisor = (r.advisor || '').trim();
    if (!advisor) continue;
    const key = normalizeName(advisor);

    // Apply unit filter at row-level using roster mapping.
    if (unitFilter && unitFilter !== 'All') {
      const u = (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
      if (u !== unitFilter) continue;
    }

    if (!map.has(key)) {
      const unit = rosterIndex.get(key)?.unit;
      map.set(key, {
        advisor,
        unit,
        approved: emptyKpis(),
        submitted: emptyKpis(),
        paid: emptyKpis(),
        open: emptyKpis(),
      });
    }

    const st = map.get(key)!;
    if (!st.unit) st.unit = rosterIndex.get(key)?.unit;

    if (isApprovedInRange(r, start, end)) addRowToKpis(st.approved, r);
    if (inRange(r.dateSubmitted, start, end)) addRowToKpis(st.submitted, r);
    if (inRange(r.datePaid, start, end)) addRowToKpis(st.paid, r);

    // "Open" pipeline: Paid activity (case is with underwriting) that has no approval proof yet.
    // Business rule: a submitted case is not considered pending until it's paid by the client.
    // This avoids counting already-approved rows as pending.
    const hasApprovalProof = Boolean(r.dateApproved) || Boolean((r.monthApproved ?? '').trim());
    if (!hasApprovalProof) {
      const openInRange = inRange(r.datePaid, start, end);
      if (openInRange) addRowToKpis(st.open, r);
    }
  }

  let advisors = Array.from(map.values());

  const producing: AdvisorStatus[] = [];
  const pending: AdvisorStatus[] = [];
  const nonProducing: AdvisorStatus[] = [];

  for (const a of advisors) {
    const approvedCases = a.approved.caseCount;
    const hasApproved = approvedCases > 0 || a.approved.fyc > 0 || a.approved.fyp > 0;

    // Pending = has "open" (unapproved) cases in the selected range.
    const hasOpen = (a.open.caseCount > 0 || a.open.fyc > 0 || a.open.fyp > 0);

    if (hasApproved) producing.push(a);
    if (hasOpen) {
      // If the advisor is already producing, show them in Pending as well but in parentheses.
      pending.push(hasApproved ? { ...a, advisor: `(${a.advisor})` } : a);
    }
    if (!hasApproved && !hasOpen) nonProducing.push(a);
  }

  // Sort for readability
  const sortBy = (arr: AdvisorStatus[], key: keyof MoneyKpis) =>
    arr.sort((a, b) => (b.approved[key] as number) - (a.approved[key] as number));

  sortBy(producing, 'fyc');
  pending.sort((a, b) => (b.open.fyc) - (a.open.fyc));
  nonProducing.sort((a, b) => a.advisor.localeCompare(b.advisor));

  return { advisors, producing, pending, nonProducing };
};

export const aggregateTeam = (
  statuses: AdvisorStatus[]
): { approved: MoneyKpis; submitted: MoneyKpis; paid: MoneyKpis } => {
  const approved = emptyKpis();
  const submitted = emptyKpis();
  const paid = emptyKpis();

  for (const s of statuses) {
    for (const k of Object.keys(approved) as (keyof MoneyKpis)[]) {
      approved[k] += s.approved[k];
      submitted[k] += s.submitted[k];
      paid[k] += s.paid[k];
    }
  }

  return { approved, submitted, paid };
};

export const buildLeaderboards = (statuses: AdvisorStatus[]) => {
  const advisorsByFYC = statuses
    .map(s => ({ advisor: s.advisor, value: s.approved.fyc }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const advisorsByFYP = statuses
    .map(s => ({ advisor: s.advisor, value: s.approved.fyp }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const unitMap = new Map<string, number>();
  const unitMapFYP = new Map<string, number>();

  for (const s of statuses) {
    const u = (s.unit || 'Unassigned').trim() || 'Unassigned';
    unitMap.set(u, (unitMap.get(u) ?? 0) + s.approved.fyc);
    unitMapFYP.set(u, (unitMapFYP.get(u) ?? 0) + s.approved.fyp);
  }

  const unitsByFYC = Array.from(unitMap.entries())
    .map(([unit, value]) => ({ unit, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const unitsByFYP = Array.from(unitMapFYP.entries())
    .map(([unit, value]) => ({ unit, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return { advisorsByFYC, advisorsByFYP, unitsByFYC, unitsByFYP };
};

export const buildApprovedTrendsByDay = (
  rows: SalesRow[],
  start: Date,
  end: Date,
  unit: string | null,
  advisor: string | null,
  rosterIndex: Map<string, RosterEntry>
) => {
  const map = new Map<string, { fyc: number; fyp: number; cases: number }>();

  const getUnit = (advisorName: string) => {
    const key = normalizeName(advisorName);
    return (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
  };

  for (const r of rows) {
    if (unit && unit !== 'All' && getUnit((r.advisor || '').trim()) !== unit) continue;
    if (advisor && advisor !== 'All' && (r.advisor || '').trim() !== advisor) continue;
    if (!isApprovedInRange(r, start, end)) continue;

    const dt = r.dateApproved ?? monthApprovedToDate(r.monthApproved) ?? null;
    if (!dt) continue;
    const key = formatISODate(dt);
    const cur = map.get(key) ?? { fyc: 0, fyp: 0, cases: 0 };
    cur.fyc += r.fyc ?? 0;
    cur.fyp += r.fyp ?? 0;
    cur.cases += r.caseCount ?? 0;
    map.set(key, cur);
  }

  const out = Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return out;
};

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export const buildSpartanMonitoring = (
  statuses: AdvisorStatus[],
  rosterEntries: RosterEntry[],
  unitFilter: string | null
) => {
  const rosterIndex = buildRosterIndex(rosterEntries);
  const isSpartan = (advisorName: string) => {
    const key = normalizeName(advisorName);
    const entry = rosterIndex.get(key);
    return norm(entry?.spaLeg) === 'spartan';
  };
  const matchesUnit = (advisorName: string) => {
    if (!unitFilter || unitFilter === 'All') return true;
    const key = normalizeName(advisorName);
    const u = (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
    return u === unitFilter;
  };

  const spartanRoster = rosterEntries
    .filter(r => norm(r.spaLeg) === 'spartan')
    .filter(r => matchesUnit(r.advisor));

  const totalSpartans = spartanRoster.length;
  const producingSpartans = statuses
    .filter(s => matchesUnit(s.advisor))
    .filter(s => isSpartan(s.advisor))
    .filter(s => (s.approved.caseCount > 0 || s.approved.fyc > 0 || s.approved.fyp > 0))
    .length;

  const activityRatio = totalSpartans > 0 ? producingSpartans / totalSpartans : 0;

  const spartanStatuses = statuses
    .filter(s => matchesUnit(s.advisor))
    .filter(s => isSpartan(s.advisor));

  const animals = spartanStatuses
    .filter(s => s.approved.caseCount >= 2)
    .sort((a, b) => b.approved.caseCount - a.approved.caseCount)
    .map(s => ({
      advisor: s.advisor,
      cases: s.approved.caseCount,
      isAnimal: s.approved.caseCount >= 6,
    }));

  const totals = spartanStatuses.reduce(
    (acc, s) => {
      acc.approvedFyc += s.approved.fyc;
      acc.approvedCases += s.approved.caseCount;
      return acc;
    },
    { approvedFyc: 0, approvedCases: 0 }
  );
  const avgFycPerCase = totals.approvedCases > 0 ? totals.approvedFyc / totals.approvedCases : 0;

  return {
    totalSpartans,
    producingSpartans,
    activityRatio,
    animals,
    totals: { ...totals, avgFycPerCase },
  };
};

export const buildProductSellers = (
  rows: SalesRow[],
  start: Date,
  end: Date,
  unitFilter: string | null,
  rosterIndex: Map<string, RosterEntry>
) => {
  const getUnit = (advisorName: string) => {
    const key = normalizeName(advisorName);
    return (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
  };

  const out = {
    aPlusSignature: [] as Array<{ advisor: string; product: string; fyc: number; policyNumber?: string; monthApproved?: string }>,
    ascend: [] as Array<{ advisor: string; product: string; fyc: number; policyNumber?: string; monthApproved?: string }>,
    futureSafeUsd5Pay: [] as Array<{ advisor: string; product: string; fyc: number; policyNumber?: string; monthApproved?: string }>,
  };

  const isAPlus = (p: string) => /a\+\s*signature/i.test(p);
  const isAscend = (p: string) => /\bascend\b/i.test(p);
  const isFsUsd5 = (p: string) => {
    const collapsed = p.replace(/\s+/g, '').toLowerCase();
    return collapsed.includes('futuresafe') && collapsed.includes('usd') && /\b5\b/.test(p) && /pay/i.test(p);
  };

  for (const r of rows) {
    const advisor = (r.advisor || '').trim();
    if (!advisor) continue;
    if (unitFilter && unitFilter !== 'All' && getUnit(advisor) !== unitFilter) continue;
    if (!isApprovedInRange(r, start, end)) continue;
    const product = String(r.product ?? '').trim();
    if (!product) continue;

    const item = {
      advisor,
      product,
      fyc: r.fyc ?? 0,
      policyNumber: r.policyNumber,
      monthApproved: r.monthApproved,
    };

    if (isAPlus(product)) out.aPlusSignature.push(item);
    if (isAscend(product)) out.ascend.push(item);
    if (isFsUsd5(product)) out.futureSafeUsd5Pay.push(item);
  }

  const sortByFyc = (a: any, b: any) => (b.fyc ?? 0) - (a.fyc ?? 0);
  out.aPlusSignature.sort(sortByFyc);
  out.ascend.sort(sortByFyc);
  out.futureSafeUsd5Pay.sort(sortByFyc);

  return out;
};

export const buildSalesRoundup = (
  rows: SalesRow[],
  start: Date,
  end: Date,
  unitFilter: string | null,
  advisorFilter: string | null,
  rosterIndex: Map<string, RosterEntry>
) => {
  const getUnit = (advisorName: string) => {
    const key = normalizeName(advisorName);
    return (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
  };

  const out: Array<{ advisor: string; product: string; afyc: number; policyNumber?: string; monthApproved?: string }> = [];

  for (const r of rows) {
    const advisor = (r.advisor || '').trim();
    if (!advisor) continue;
    if (advisorFilter && advisorFilter !== 'All' && advisor !== advisorFilter) continue;
    if (unitFilter && unitFilter !== 'All' && getUnit(advisor) !== unitFilter) continue;
    if (!isApprovedInRange(r, start, end)) continue;

    const product = String(r.product ?? '').trim();
    if (!product) continue;

    out.push({
      advisor,
      product,
      afyc: r.afyc ?? 0,
      policyNumber: r.policyNumber,
      monthApproved: r.monthApproved,
    });
  }

  out.sort((a, b) => (b.afyc ?? 0) - (a.afyc ?? 0) || a.advisor.localeCompare(b.advisor));
  return out;
};

const MONTH3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const safeCaseCount = (r: SalesRow) => {
  const c = Number(r.caseCount ?? 0);
  if (!Number.isFinite(c) || c <= 0) return 1;
  return c;
};

const isGuardianProduct = (p: string) => /guardian/i.test(p);

const getApprovedDateForPpb = (r: SalesRow): Date | null => {
  if (r.dateApproved) return r.dateApproved;
  if (r.monthApproved) {
    const md = monthApprovedToDate(r.monthApproved);
    return md ?? null;
  }
  return null;
};

export const buildPpbTracker = (
  rows: SalesRow[],
  rosterEntries: RosterEntry[],
  rangeEnd: Date,
  unitFilter: string | null,
  rosterIndex: Map<string, RosterEntry>,
  dprRows: DprRow[] = []
) => {
  const endY = rangeEnd.getUTCFullYear();
  const endM = rangeEnd.getUTCMonth();
  const q = Math.floor(endM / 3); // 0..3
  const qm = q * 3; // quarter start month
  const quarterStart = new Date(Date.UTC(endY, qm, 1));
  const quarterEnd = new Date(Date.UTC(endY, qm + 3, 0));

  // Treat rangeEnd as inclusive end-of-day for safety.
  const rangeEndEod = new Date(rangeEnd.getTime());
  rangeEndEod.setUTCHours(23, 59, 59, 999);

  const months: [string, string, string] = [
    MONTH3[qm] ?? 'M1',
    MONTH3[qm + 1] ?? 'M2',
    MONTH3[qm + 2] ?? 'M3',
  ];

  const quarter = `Q${q + 1} ${endY}`;

  const getUnit = (advisorName: string) => {
    const key = normalizeName(advisorName);
    return (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
  };

  const getRoster = (advisorName: string) => rosterIndex.get(normalizeName(advisorName));

  const monthKeyLocal = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const paMonthKey = (pa: Date | null | undefined) => {
    if (!pa) return null;
    return monthKeyLocal(new Date(Date.UTC(pa.getUTCFullYear(), pa.getUTCMonth(), 1)));
  };

  const quarterMonthKeys: [string, string, string] = [
    monthKeyLocal(new Date(Date.UTC(endY, qm, 1))),
    monthKeyLocal(new Date(Date.UTC(endY, qm + 1, 1))),
    monthKeyLocal(new Date(Date.UTC(endY, qm + 2, 1))),
  ];

  const isFirstTwoYears = (advisorName: string) => {
    const entry = getRoster(advisorName);

    // Prefer explicit roster tenure when available. This avoids misclassifying
    // advisors when PA Date is missing or formatted unexpectedly.
    const tenure = String(entry?.tenure ?? '').trim().toLowerCase();
    if (tenure === 'tenured') return false;
    if (tenure === 'rookie') return true;

    const pa = entry?.paDate ?? null;
    if (!pa) return true; // default leniently

    // Tenure is based on the first month of the quarter.
    const qStartYM = endY * 12 + qm;
    const paYM = pa.getUTCFullYear() * 12 + pa.getUTCMonth();
    const months = qStartYM - paYM;
    return months < 24;
  };

  const fycRateFor = (fyc: number) => {
    if (fyc >= 350_000) return 0.40;
    if (fyc >= 200_000) return 0.35;
    if (fyc >= 120_000) return 0.30;
    if (fyc >= 80_000) return 0.20;
    if (fyc >= 50_000) return 0.15;
    if (fyc >= 30_000) return 0.10;
    if (fyc >= 20_000) return 0.10;
    return 0;
  };

  const minFycFor = (firstTwoYears: boolean) => (firstTwoYears ? 20_000 : 30_000);

  const nextPpbTierInfo = (fyc: number, firstTwoYears: boolean): { balance: number | null; nextRate: number | null } => {
    // "Next tier" should mean the next threshold that INCREASES the PPB rate.
    // Example: for rookies, 20k and 30k are both 10%, so after hitting 20k the
    // next meaningful tier is 50k (15%). For tenured advisors, the minimum is
    // 30k (10%), then 50k (15%), etc.
    const tiers = firstTwoYears
      ? [20_000, 30_000, 50_000, 80_000, 120_000, 200_000, 350_000]
      : [30_000, 50_000, 80_000, 120_000, 200_000, 350_000];

    const minFyc = minFycFor(firstTwoYears);
    const currentRate = fyc >= minFyc ? fycRateFor(fyc) : 0;

    for (const t of tiers) {
      if (fyc >= t) continue;
      const tierRate = t >= minFyc ? fycRateFor(t) : 0;
      if (tierRate > currentRate) return { balance: t - fyc, nextRate: tierRate };
    }

    return { balance: null, nextRate: null }; // already at top tier
  };

  const nextCcbTierInfo = (cases: number): { balance: number | null; nextRate: number | null } => {
    if (cases < 3) return { balance: 3 - cases, nextRate: 0.05 };
    if (cases < 5) return { balance: 5 - cases, nextRate: 0.10 };
    if (cases < 7) return { balance: 7 - cases, nextRate: 0.15 };
    if (cases < 9) return { balance: 9 - cases, nextRate: 0.20 };
    return { balance: null, nextRate: null };
  };

  const caseBonusRateFor = (cases: number) => {
    if (cases >= 9) return 0.20;
    if (cases >= 7) return 0.15;
    if (cases >= 5) return 0.10;
    if (cases >= 3) return 0.05;
    return 0;
  };

  // Track per-advisor aggregates.
  const advisorMap = new Map<string, {
    advisor: string;
    fyc: number;
    cases: number;
    m: [number, number, number];
    // Dedup tracking for case count bonus rules (not for FYC)
    seenCase: Map<string, { idx: number; count: number }>;
  }>();

  // DPR quarter-to-date FYC (includes renewals/other production beyond New Business).
  // DPR is sometimes delayed; when both sources exist, we use the higher of
  // (New Business approved FYC) vs (DPR QTD FYC) until DPR catches up.
  const dprHas = new Set<string>();
  const dprFycMap = new Map<string, number>();
  const dprNameMap = new Map<string, string>();

  const endQuarterMonthIdx = Math.min(2, Math.max(0, endM - qm));

  for (const dr of dprRows ?? []) {
    const advisor = String(dr.advisor ?? '').trim();
    if (!advisor) continue;

    if (unitFilter && unitFilter !== 'All' && getUnit(advisor) !== unitFilter) continue;

    const idx = quarterMonthKeys.indexOf(String(dr.monthKey ?? '').trim());
    if (idx === -1) continue;
    if (idx > endQuarterMonthIdx) continue; // quarter-to-date only

    const key = normalizeName(advisor);
    dprHas.add(key);
    if (!dprNameMap.has(key)) dprNameMap.set(key, advisor);

    const cur = dprFycMap.get(key) ?? 0;
    dprFycMap.set(key, cur + (dr.fyc ?? 0));
  }

  const normKey = (s: unknown) => String(s ?? '').trim().toLowerCase();

  for (const r of rows) {
    const advisor = (r.advisor || '').trim();
    if (!advisor) continue;

    if (unitFilter && unitFilter !== 'All' && getUnit(advisor) !== unitFilter) continue;

    const ad = getApprovedDateForPpb(r);
    if (!ad) continue;

    // Quarter-to-date snapshot (through selected range end)
    if (ad.getTime() < quarterStart.getTime()) continue;
    if (ad.getTime() > rangeEndEod.getTime()) continue;

    const adMonth = ad.getUTCMonth();
    if (adMonth < qm || adMonth > qm + 2) continue;

    const idx = adMonth - qm; // 0..2

    const key = normalizeName(advisor);
    const cur = advisorMap.get(key) ?? {
      advisor,
      fyc: 0,
      cases: 0,
      m: [0, 0, 0] as [number, number, number],
      seenCase: new Map<string, { idx: number; count: number }>(),
    };

    // FYC: keep New Business totals as a fallback. DPR (if present) will override later.
    cur.fyc += r.fyc ?? 0;

    // Cases: exclude Guardian variants from case counts (for now)
    const product = String(r.product ?? '').trim();
    const isGuardian = isGuardianProduct(product);

    if (!isGuardian) {
      // Deduplicate case credits within the quarter
      const policyOwner = String(r.policyOwner ?? '').trim();
      const mode = String(r.mode ?? '').trim();

      const caseKey = [
        normKey(advisor),
        normKey(policyOwner),
        normKey(product),
        normKey(mode),
      ].join('|');

      const caseAdd = safeCaseCount(r);

      const prev = cur.seenCase.get(caseKey);
      if (!prev) {
        cur.seenCase.set(caseKey, { idx, count: caseAdd });
        cur.cases += caseAdd;
        cur.m[idx] += caseAdd;
      } else if (idx < prev.idx) {
        // Move the case credit to the earlier month (first occurrence month rule)
        cur.m[prev.idx] -= prev.count;
        cur.m[idx] += prev.count;
        cur.seenCase.set(caseKey, { idx, count: prev.count });
      }
    }

    advisorMap.set(key, cur);
  }

  // Ensure advisors that appear only in DPR still show up in the PPB table.
  for (const key of dprHas) {
    if (advisorMap.has(key)) continue;
    const name = dprNameMap.get(key) || rosterIndex.get(key)?.advisor || key;
    advisorMap.set(key, {
      advisor: name,
      fyc: 0,
      cases: 0,
      m: [0, 0, 0],
      seenCase: new Map<string, { idx: number; count: number }>(),
    });
  }

  const rowsOut = Array.from(advisorMap.entries())
    .map(([key, r]) => {
      // Quarter-to-date FYC source:
      // DPR is sometimes delayed (not real-time). If DPR exists but is lower than
      // what New Business already reflects, use the higher number until DPR catches up.
      const nbFyc = r.fyc ?? 0;
      const dprFyc = dprFycMap.get(key) ?? 0;
      const fyc = dprHas.has(key) ? Math.max(dprFyc, nbFyc) : nbFyc;

      const firstTwo = isFirstTwoYears(r.advisor);
      const minFyc = minFycFor(firstTwo);

      // FYC bonus eligibility (we default persistency to 82.5% -> multiplier 100%)
      const qualifiesFyc = fyc >= minFyc;
      const fycRate = qualifiesFyc ? fycRateFor(fyc) : 0;

      // Case count bonus eligibility (simplified; ignores net adjustments)
      // - Must qualify for FYC bonus first
      // - Must have >=3 cases (Guardian excluded)
      // - Must be active in >=2 months within the quarter (Guardian excluded)
      //   * If PA month falls in the 3rd month of the quarter, waive the 2-month rule.
      const entry = getRoster(r.advisor);
      const paKey = paMonthKey(entry?.paDate ?? null);
      const paIdx = paKey ? quarterMonthKeys.indexOf(paKey) : -1;

      const startIdx = paIdx >= 0 ? paIdx : 0;
      const activeMonths = [0, 1, 2]
        .filter(i => i >= startIdx)
        .filter(i => (r.m[i] ?? 0) > 0)
        .length;

      const activeMonthsRequired = (paIdx === 2) ? 1 : 2;
      const qualifiesCase = qualifiesFyc && r.cases >= 3 && activeMonths >= activeMonthsRequired;
      const ccbRate = qualifiesCase ? caseBonusRateFor(r.cases) : null;

      const persistencyMultiplier = 1.0; // default 82.5% => 100%
      const totalBonusRate = qualifiesFyc ? (fycRate + (ccbRate ?? 0)) : 0;
      const projectedBonus = qualifiesFyc ? totalBonusRate * persistencyMultiplier * fyc : null;

      const nextPpb = nextPpbTierInfo(fyc, firstTwo);
      const nextCcb = nextCcbTierInfo(r.cases);

      return {
        advisor: r.advisor,
        fyc,
        cases: r.cases,
        m1Cases: r.m[0],
        m2Cases: r.m[1],
        m3Cases: r.m[2],
        ppbRate: fycRate,
        ccbRate,
        totalBonusRate,
        projectedBonus,
        fycToNextBonusTier: nextPpb.balance,
        nextPpbRate: nextPpb.nextRate,
        casesToNextCcbTier: nextCcb.balance,
        nextCcbRate: nextCcb.nextRate,
      };
    })
    .filter(r => (r.fyc ?? 0) > 0 || (r.cases ?? 0) > 0)
    .sort((a, b) => (b.fyc ?? 0) - (a.fyc ?? 0) || a.advisor.localeCompare(b.advisor));

  return {
    quarter,
    months,
    rows: rowsOut,
  };
};

const monthKey = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const addMonths = (d: Date, delta: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));

export const buildConsistentMonthlyProducers = (
  rows: SalesRow[],
  rosterEntries: RosterEntry[],
  unitFilter: string | null,
  rangeEnd: Date
) => {
  const rosterIndex = buildRosterIndex(rosterEntries);

  const getUnit = (advisorName: string) => {
    const key = normalizeName(advisorName);
    return (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
  };

  const producedMonths = new Map<string, Set<string>>();
  for (const r of rows) {
    const advisor = (r.advisor || '').trim();
    if (!advisor) continue;

    // Approved month key from Month Approved (preferred), else Date Approved
    const md = monthApprovedToDate((r.monthApproved ?? '').trim()) ?? (r.dateApproved ? new Date(Date.UTC(r.dateApproved.getUTCFullYear(), r.dateApproved.getUTCMonth(), 1)) : null);
    if (!md) continue;

    const k = normalizeName(advisor);
    if (!producedMonths.has(k)) producedMonths.set(k, new Set());
    producedMonths.get(k)!.add(monthKey(md));
  }

  // CMP window ends on the month that contains `rangeEnd` (the caller controls
  // what "as of" date to use — typically the last day of the previous month).
  const endMonthStart = new Date(Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), 1));
  const asOfMonth = monthKey(endMonthStart);

  const candidates = rosterEntries
    .filter(r => Boolean(r.advisor))
    .filter(r => {
      if (!unitFilter || unitFilter === 'All') return true;
      const u = (r.unit || 'Unassigned').trim() || 'Unassigned';
      return u === unitFilter;
    });

  const threePlus: Array<{ advisor: string; streakMonths: number }> = [];
  const watch2: Array<{ advisor: string; streakMonths: number }> = [];
  const watch1: Array<{ advisor: string; streakMonths: number }> = [];

  for (const r of candidates) {
    const key = normalizeName(r.advisor);
    const set = producedMonths.get(key) ?? new Set<string>();

    let streak = 0;
    let cursor = endMonthStart;
    while (set.has(monthKey(cursor)) && streak < 240) {
      streak += 1;
      cursor = addMonths(cursor, -1);
    }

    // If the streak reaches Jan 2026 and the prior month would be Dec 2025,
    // extend using the roster's Months CMP 2025 (carry-over streak).
    if (streak > 0 && monthKey(cursor) === '2025-12') {
      const carry = Number(r.monthsCmp2025 ?? 0);
      if (Number.isFinite(carry) && carry > 0) streak += carry;
    }

    if (streak >= 3) threePlus.push({ advisor: r.advisor, streakMonths: streak });
    else if (streak === 2) watch2.push({ advisor: r.advisor, streakMonths: streak });
    else if (streak === 1) watch1.push({ advisor: r.advisor, streakMonths: streak });
  }

  const sortFn = (a: { advisor: string; streakMonths: number }, b: { advisor: string; streakMonths: number }) =>
    b.streakMonths - a.streakMonths || a.advisor.localeCompare(b.advisor);

  threePlus.sort(sortFn);
  watch2.sort(sortFn);
  watch1.sort(sortFn);

  return { asOfMonth, threePlus, watch2, watch1 };
};

export const buildAdvisorDetail = (
  rows: SalesRow[],
  advisor: string,
  start: Date,
  end: Date,
  unitFilter: string | null,
  rosterIndex: Map<string, RosterEntry>
) => {
  const approved = emptyKpis();
  const submitted = emptyKpis();
  const paid = emptyKpis();

  const productMap = new Map<string, { fyc: number; cases: number }>();

  const getUnit = (advisorName: string) => {
    const key = normalizeName(advisorName);
    return (rosterIndex.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
  };

  for (const r of rows) {
    if ((r.advisor || '').trim() !== advisor) continue;
    if (unitFilter && unitFilter !== 'All' && getUnit((r.advisor || '').trim()) !== unitFilter) continue;

    if (isApprovedInRange(r, start, end)) {
      addRowToKpis(approved, r);
      const p = (r.product || 'Unknown').trim() || 'Unknown';
      const cur = productMap.get(p) ?? { fyc: 0, cases: 0 };
      cur.fyc += r.fyc ?? 0;
      cur.cases += r.caseCount ?? 0;
      productMap.set(p, cur);
    }
    if (inRange(r.dateSubmitted, start, end)) addRowToKpis(submitted, r);
    if (inRange(r.datePaid, start, end)) addRowToKpis(paid, r);
  }

  const productMix = Array.from(productMap.entries())
    .map(([product, v]) => ({ product, ...v }))
    .sort((a, b) => b.fyc - a.fyc)
    .slice(0, 10);

  const approvedByDay = buildApprovedTrendsByDay(rows, start, end, unitFilter, advisor, rosterIndex);

  return { advisor, approved, submitted, paid, productMix, approvedByDay };
};
