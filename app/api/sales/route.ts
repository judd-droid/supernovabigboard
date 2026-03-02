import { NextResponse } from 'next/server';
import { getSheetValues } from '@/lib/sheets';
import { parseRosterEntries, parseSalesRows, parseDprRows, normalizeName, parseReclassificationEntries } from '@/lib/parse';
import {
  buildAdvisorDetail,
  buildAdvisorStatuses,
  buildApprovedTrendsByDay,
  buildLeaderboards,
  buildMdrtTracker,
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
      ppbTracker,
      monthlyExcellenceBadges,
    };

    if (advisor !== 'All') {
      resp.advisorDetail = buildAdvisorDetail(rowsSpaLegFiltered, advisor, range.start, range.end, unit, rosterIndex);
    }

    return NextResponse.json(resp);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
