import { NextResponse } from 'next/server';
import { getSheetValues } from '@/lib/sheets';
import { parseRosterEntries, parseSalesRows, parseDprRows, normalizeName, parseReclassificationEntries, monthApprovedToDate } from '@/lib/parse';
import {
  buildAdvisorDetail,
  buildAdvisorStatuses,
  buildApprovedTrendsByDay,
  buildLeaderboards,
  buildMdrtTracker,
  isApprovedInRange,
  getPresetRange,
  aggregateTeam,
  buildRosterIndex,
  buildSpartanMonitoring,
  buildLegacyMonitoring,
  buildProductSellers,
  buildSalesRoundup,
  buildConsistentMonthlyProducers,
  buildPpbTracker,
  buildMonthlyExcellenceBadges,
  buildPendingCases,
} from '@/lib/metrics';
import type { ApiResponse, RangePreset } from '@/lib/types';
import type { SpaLegFilter } from '@/lib/spaLeg';
import { matchesSpaLegFilter } from '@/lib/spaLeg';

const getSheetName = (key: string, fallback: string) => process.env[key] ?? fallback;

const getManilaNow = () => {
  // Create a Date object that reflects Manila local time (but stored as a JS Date)
  // Useful for MTD/QTD/YTD calculations that managers expect in PH time.
  const now = new Date();
  const manila = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return manila;
};

const parseISO = (s: string | null): Date | null => {
  if (!s) return null;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = s.split('-').map(Number);
  if (![y, mo, d].every(Number.isFinite)) return null;
  return new Date(Date.UTC(y, mo - 1, d));
};

export const revalidate = 300; // cache for 5 minutes in Next/Vercel

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const preset = (url.searchParams.get('preset')?.toUpperCase() ?? 'MTD') as RangePreset;
    const unit = (url.searchParams.get('unit') ?? 'All').trim();
    const advisor = (url.searchParams.get('advisor') ?? 'All').trim();

    const spaLeg = (url.searchParams.get('spaleg') ?? 'All').trim() as SpaLegFilter;


    const customStart = parseISO(url.searchParams.get('start'));
    const customEnd = parseISO(url.searchParams.get('end'));

    const manilaNow = getManilaNow();
    let range: { start: Date; end: Date };

    if (preset === 'CUSTOM' && customStart && customEnd) {
      range = { start: customStart, end: customEnd };
    } else {
      range = getPresetRange(preset === 'CUSTOM' ? 'MTD' : preset, new Date(Date.UTC(
        manilaNow.getFullYear(),
        manilaNow.getMonth(),
        manilaNow.getDate()
      )));
    }

    const newBusinessSheet = getSheetName('NEW_BUSINESS_SHEET_NAME', 'New Business');
    const rosterSheet = getSheetName('ROSTER_SHEET_NAME', 'Roster');
    const dprSheet = getSheetName('DPR_LOG_SHEET_NAME', 'DPR Log');
    const reclassSheet = getSheetName('RECLASSIFICATION_SHEET_NAME', 'Reclassification');

    const [newBusinessValues, rosterValues, dprValues, reclassValues] = await Promise.all([
      // Use a wider range so adding future columns won't break parsing.
      getSheetValues(newBusinessSheet, 'A:AZ'),
      // Read extra columns (Unit, SPA/LEG, Program, PA Date, Tenure, etc.).
      getSheetValues(rosterSheet, 'A:Z'),
      // DPR monthly totals (FYC/ANP/FYP + Persistency)
      getSheetValues(dprSheet, 'A:Z'),
      // Rare overrides: advisor segment for a specific date range
      getSheetValues(reclassSheet, 'A:Z'),
    ]);

    const rows = parseSalesRows(newBusinessValues);
    const rosterEntriesCurrent = parseRosterEntries(rosterValues);
    const dprRows = parseDprRows(dprValues);
    const reclassEntries = parseReclassificationEntries(reclassValues);

    // Resolve SPA/LEG classification:
    // - If the advisor is in Reclassification AND the date is within any override period, use that.
    // - Otherwise, fall back to the advisor's CURRENT classification in the Roster.
    const rosterIndexCurrent = buildRosterIndex(rosterEntriesCurrent);
    const getRosterSpaLeg = (advisorName: string) => {
      const key = normalizeName(advisorName);
      return (rosterIndexCurrent.get(key)?.spaLeg || '').trim();
    };

    const getSpaLegForDate = (advisorName: string, dt: Date | null): string => {
      const name = (advisorName || '').trim();
      if (!name) return '';
      if (!dt) return getRosterSpaLeg(name);
      const key = normalizeName(name);

      // Reclassification entries are rare, so a simple scan is fine.
      for (const e of reclassEntries) {
        if (normalizeName(e.advisor) !== key) continue;
        const s = e.startDate;
        const en = e.endDate;
        if (!s || !en) continue;
        if (dt.getTime() >= s.getTime() && dt.getTime() <= en.getTime()) {
          return (e.spaLeg || '').trim();
        }
      }

      return getRosterSpaLeg(name);
    };

    // "View" roster = roster with SPA/LEG interpreted for the selected range end.
    // This keeps the app simple: rare overrides affect historical periods, roster remains the source of "current".
    const rosterEntries = rosterEntriesCurrent.map(r => ({
      ...r,
      spaLeg: getSpaLegForDate(r.advisor, range.end) || r.spaLeg,
    }));

    const rosterIndex = buildRosterIndex(rosterEntries);

    const units = Array.from(
      new Set(rosterEntriesCurrent.map(r => (r.unit || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    // Advisors dropdown should include all roster advisors, plus any advisors that exist in New Business
    // (historical cases). This prevents data from "disappearing" if someone is no longer on the roster.
    const rosterNames = rosterEntriesCurrent.map(r => r.advisor).filter(Boolean);
    const rowNames = rows.map(r => (r.advisor || '').trim()).filter(Boolean);
    const advisors = Array.from(new Map(
      [...rosterNames, ...rowNames].map(a => [normalizeName(a), a])
    ).values()).sort((a, b) => a.localeCompare(b));

    // Apply SPA/LEG filter to ALL panels EXCEPT Monitoring rows.
    // To preserve historical truth when an advisor was temporarily reclassified,
    // we evaluate the advisor's SPA/LEG based on the row's effective date.
    const getRowEffectiveDate = (r: any): Date | null => (
      r.dateApproved ?? r.datePaid ?? r.dateSubmitted ?? null
    );

    // Apply SPA/LEG filter to ALL panels EXCEPT Monitoring rows.
    // "All" means "all active" (Spartans + Legacy). Inactive advisors are excluded unless
    // the row falls within a Reclassification override period.
    const rowsSpaLegFiltered = rows.filter(r => {
      const name = (r.advisor || '').trim();
      const sl = getSpaLegForDate(name, getRowEffectiveDate(r));
      return matchesSpaLegFilter(sl, spaLeg);
    });

    const statuses = buildAdvisorStatuses(rowsSpaLegFiltered, rosterEntries, range.start, range.end, unit);

    // DPR reconciliation for APPROVED totals (FYC/FYP/ANP):
    // New Business is near real-time; DPR can lag, and sometimes one is higher than the other.
    // We reconcile by MONTH and use the higher value per month, then sum across the selected range months.
    // This preserves the intent: never under-report due to lag in either source.
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const toMonthKey = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
    const parseMonthKey = (k: string): Date | null => {
      const m = /^\d{4}-\d{2}$/.exec((k || '').trim());
      if (!m) return null;
      const [y, mo] = k.split('-').map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
      return new Date(Date.UTC(y, mo - 1, 1));
    };
    const monthsInRange = (start: Date, end: Date): string[] => {
      const out: string[] = [];
      let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      while (cur.getTime() <= last.getTime()) {
        out.push(toMonthKey(cur));
        cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      }
      return out;
    };

    const months = monthsInRange(range.start, range.end);
    const monthsSet = new Set(months);

    // New Business approved totals aggregated by advisor x month (within selected range)
    const nbByAdvisorMonth = new Map<string, Map<string, { fyc: number; fyp: number; anp: number }>>();
    const addNb = (advisorKey: string, mk: string, fyc: number, fyp: number, anp: number) => {
      const mm = nbByAdvisorMonth.get(advisorKey) ?? new Map();
      const cur = mm.get(mk) ?? { fyc: 0, fyp: 0, anp: 0 };
      cur.fyc += fyc;
      cur.fyp += fyp;
      cur.anp += anp;
      mm.set(mk, cur);
      nbByAdvisorMonth.set(advisorKey, mm);
    };

    for (const r of rowsSpaLegFiltered) {
      const name = (r.advisor || '').trim();
      if (!name) continue;
      if (!isApprovedInRange(r, range.start, range.end)) continue;

      // Determine month bucket for the approved activity
      const dt = r.dateApproved ?? monthApprovedToDate(r.monthApproved) ?? null;
      if (!dt) continue;
      const mk = toMonthKey(dt);
      if (!monthsSet.has(mk)) continue;

      const k = normalizeName(name);
      addNb(k, mk, r.fyc ?? 0, r.fyp ?? 0, r.anp ?? 0);
    }

    // DPR totals aggregated by advisor x month (for months that overlap selected range)
    const dprByAdvisorMonth = new Map<string, Map<string, { fyc: number; fyp: number; anp: number }>>();
    const addDpr = (advisorKey: string, mk: string, fyc: number, fyp: number, anp: number) => {
      const mm = dprByAdvisorMonth.get(advisorKey) ?? new Map();
      const cur = mm.get(mk) ?? { fyc: 0, fyp: 0, anp: 0 };
      cur.fyc += fyc;
      cur.fyp += fyp;
      cur.anp += anp;
      mm.set(mk, cur);
      dprByAdvisorMonth.set(advisorKey, mm);
    };

    for (const dr of dprRows ?? []) {
      const name = String(dr.advisor ?? '').trim();
      if (!name) continue;
      const mk = String(dr.monthKey ?? '').trim();
      if (!monthsSet.has(mk)) continue;

      // Unit filter for DPR rows (match how we filter New Business)
      if (unit && unit !== 'All') {
        const key = normalizeName(name);
        const u = (rosterIndexCurrent.get(key)?.unit || 'Unassigned').trim() || 'Unassigned';
        if (u !== unit) continue;
      }

      // SPA/LEG filter for DPR rows should respect reclassification windows.
      // Use the month start date for the segment lookup.
      const md = parseMonthKey(mk);
      const sl = getSpaLegForDate(name, md);
      if (!matchesSpaLegFilter(sl, spaLeg)) continue;

      const k = normalizeName(name);
      addDpr(k, mk, dr.fyc ?? 0, dr.fyp ?? 0, dr.anp ?? 0);
    }

    // Apply per-month reconciliation to the status objects (mutates in place)
    const reconcileApproved = (advisorName: string, current: { fyc: number; fyp: number; anp: number }) => {
      const k = normalizeName(advisorName);
      const nbM = nbByAdvisorMonth.get(k);
      const dprM = dprByAdvisorMonth.get(k);
      let fyc = 0;
      let fyp = 0;
      let anp = 0;
      for (const mk of months) {
        const nb = nbM?.get(mk) ?? { fyc: 0, fyp: 0, anp: 0 };
        const dpr = dprM?.get(mk) ?? { fyc: 0, fyp: 0, anp: 0 };
        fyc += Math.max(nb.fyc, dpr.fyc);
        fyp += Math.max(nb.fyp, dpr.fyp);
        anp += Math.max(nb.anp, dpr.anp);
      }
      // Never reduce below New Business totals already computed
      return {
        fyc: Math.max(current.fyc, fyc),
        fyp: Math.max(current.fyp, fyp),
        anp: Math.max(current.anp, anp),
      };
    };

    for (const s of statuses.advisors) {
      const eff = reconcileApproved(s.advisor, { fyc: s.approved.fyc, fyp: s.approved.fyp, anp: s.approved.anp });
      s.approved.fyc = eff.fyc;
      s.approved.fyp = eff.fyp;
      s.approved.anp = eff.anp;
    }

    const filteredAdvisors = statuses.advisors.filter(a => matchesSpaLegFilter(a.spaLeg, spaLeg));
    const filteredProducing = statuses.producing.filter(a => matchesSpaLegFilter(a.spaLeg, spaLeg));
    const filteredPending = statuses.pending.filter(a => matchesSpaLegFilter(a.spaLeg, spaLeg));
    const filteredNonProducing = statuses.nonProducing.filter(a => matchesSpaLegFilter(a.spaLeg, spaLeg));

    const team = aggregateTeam(filteredAdvisors);
    const leaderboards = buildLeaderboards(filteredAdvisors);
    const mdrtTracker = buildMdrtTracker(rowsSpaLegFiltered, rosterEntries, range.end, unit, rosterIndex);
    const trends = {
      // Already SPA/LEG-filtered above.
      approvedByDay: buildApprovedTrendsByDay(rowsSpaLegFiltered, range.start, range.end, unit, null, rosterIndex, 'All'),
    };

    // Monitoring rows should align with the selected range's interpreted SPA/LEG classification.
    // This ensures historical months (e.g., a temporary Spartan period) are counted correctly.
    const spartanMonitoring = buildSpartanMonitoring(statuses.advisors, rosterEntries, unit);
    const legacyMonitoring = buildLegacyMonitoring(statuses.advisors, rosterEntries, unit);

    // Consistent Monthly Producers (CMP) is computed through the most recently completed
    // calendar month (this month is shown in the panel title), regardless of the selected range.
    const cmpEnd = new Date(Date.UTC(
      manilaNow.getFullYear(),
      manilaNow.getMonth(),
      0
    ));

    const specialLookouts = {
      productSellers: buildProductSellers(rowsSpaLegFiltered, range.start, range.end, unit, rosterIndex),
      consistentMonthlyProducers: buildConsistentMonthlyProducers(rowsSpaLegFiltered, rosterEntries, unit, cmpEnd),
      salesRoundup: buildSalesRoundup(rowsSpaLegFiltered, range.start, range.end, unit, advisor, rosterIndex),
    };

    // PPB Tracker snapshot is based on the calendar quarter where the selected range end falls.
    // It aggregates quarter-to-date (through the selected range end).
    const ppbTracker = buildPpbTracker(rowsSpaLegFiltered, rosterEntries, range.end, unit, rosterIndex, dprRows);

    // Monthly Excellence Awards Badges are computed for the MOST CURRENT month only
    // (the month that contains the selected range end), month-to-date through range end.
    const monthlyExcellenceBadges = buildMonthlyExcellenceBadges(
      rowsSpaLegFiltered,
      rosterEntries,
      range.end,
      unit,
      advisor,
      rosterIndex
    );

    // Pending cases: paid but not yet approved (not range-scoped — shows ALL pending).
    // Filtered by SPA/LEG and unit like other panels.
    const allPendingCases = buildPendingCases(rowsSpaLegFiltered, rosterIndex, manilaNow);
    const pendingCases = unit === 'All'
      ? allPendingCases
      : allPendingCases.filter(c => {
          const re = rosterIndex.get(normalizeName(c.advisor));
          return re && (re.unit ?? '').trim() === unit;
        });

    const resp: ApiResponse = {
      generatedAt: new Date().toISOString(),
      filters: {
        preset,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        unit,
        advisor,
      },
      options: {
        units: ['All', ...units],
        advisors: ['All', ...advisors],
      },
      team,
      producingAdvisors: {
        producing: filteredProducing,
        pending: filteredPending,
        nonProducing: filteredNonProducing,
      },
      leaderboards,
      mdrtTracker,
      trends,
      spartanMonitoring,
      legacyMonitoring,
      specialLookouts,
      pendingCases,
      ppbTracker,
      monthlyExcellenceBadges,
    };

    if (advisor !== 'All') {
      const detail = buildAdvisorDetail(rowsSpaLegFiltered, advisor, range.start, range.end, unit, rosterIndex);
      // Apply the same DPR reconciliation to the advisor detail approved totals.
      const eff = reconcileApproved(detail.advisor, { fyc: detail.approved.fyc, fyp: detail.approved.fyp, anp: detail.approved.anp });
      detail.approved.fyc = eff.fyc;
      detail.approved.fyp = eff.fyp;
      detail.approved.anp = eff.anp;
      resp.advisorDetail = detail;
    }

    return NextResponse.json(resp);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
