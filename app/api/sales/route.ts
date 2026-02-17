import { NextResponse } from 'next/server';
import { getSheetValues } from '@/lib/sheets';
import { parseRosterEntries, parseSalesRows, parseDprRows, normalizeName } from '@/lib/parse';
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
  buildProductSellers,
  buildSalesRoundup,
  buildConsistentMonthlyProducers,
  buildPpbTracker,
  buildMonthlyExcellenceBadges,
} from '@/lib/metrics';
import type { ApiResponse, RangePreset } from '@/lib/types';

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

    const [newBusinessValues, rosterValues, dprValues] = await Promise.all([
      // Use a wider range so adding future columns won't break parsing.
      getSheetValues(newBusinessSheet, 'A:AZ'),
      // Read extra columns (Unit, SPA/LEG, Program, PA Date, Tenure, etc.).
      getSheetValues(rosterSheet, 'A:Z'),
      // DPR monthly totals (FYC/ANP/FYP + Persistency)
      getSheetValues(dprSheet, 'A:Z'),
    ]);

    const rows = parseSalesRows(newBusinessValues);
    const rosterEntries = parseRosterEntries(rosterValues);
    const dprRows = parseDprRows(dprValues);
    const rosterIndex = buildRosterIndex(rosterEntries);

    const units = Array.from(
      new Set(rosterEntries.map(r => (r.unit || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    // Advisors dropdown should include all roster advisors, plus any advisors that exist in New Business
    // (historical cases). This prevents data from "disappearing" if someone is no longer on the roster.
    const rosterNames = rosterEntries.map(r => r.advisor).filter(Boolean);
    const rowNames = rows.map(r => (r.advisor || '').trim()).filter(Boolean);
    const advisors = Array.from(new Map(
      [...rosterNames, ...rowNames].map(a => [normalizeName(a), a])
    ).values()).sort((a, b) => a.localeCompare(b));

    const statuses = buildAdvisorStatuses(rows, rosterEntries, range.start, range.end, unit);
    const team = aggregateTeam(statuses.advisors);
    const leaderboards = buildLeaderboards(statuses.advisors);
    const mdrtTracker = buildMdrtTracker(rows, rosterEntries, range.end, unit, rosterIndex);
    const trends = {
      approvedByDay: buildApprovedTrendsByDay(rows, range.start, range.end, unit, null, rosterIndex),
    };

    const spartanMonitoring = buildSpartanMonitoring(statuses.advisors, rosterEntries, unit);

    // Consistent Monthly Producers (CMP) is computed through the most recently completed
    // calendar month (this month is shown in the panel title), regardless of the selected range.
    const cmpEnd = new Date(Date.UTC(
      manilaNow.getFullYear(),
      manilaNow.getMonth(),
      0
    ));

    const specialLookouts = {
      productSellers: buildProductSellers(rows, range.start, range.end, unit, rosterIndex),
      consistentMonthlyProducers: buildConsistentMonthlyProducers(rows, rosterEntries, unit, cmpEnd),
      salesRoundup: buildSalesRoundup(rows, range.start, range.end, unit, advisor, rosterIndex),
    };

    // PPB Tracker snapshot is based on the calendar quarter where the selected range end falls.
    // It aggregates quarter-to-date (through the selected range end).
    const ppbTracker = buildPpbTracker(rows, rosterEntries, range.end, unit, rosterIndex, dprRows);

    // Monthly Excellence Awards Badges are computed for the MOST CURRENT month only
    // (the month that contains the selected range end), month-to-date through range end.
    const monthlyExcellenceBadges = buildMonthlyExcellenceBadges(
      rows,
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
        producing: statuses.producing,
        pending: statuses.pending,
        nonProducing: statuses.nonProducing,
      },
      leaderboards,
      mdrtTracker,
      trends,
      spartanMonitoring,
      specialLookouts,
      ppbTracker,
      monthlyExcellenceBadges,
    };

    if (advisor !== 'All') {
      resp.advisorDetail = buildAdvisorDetail(rows, advisor, range.start, range.end, unit, rosterIndex);
    }

    return NextResponse.json(resp);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
