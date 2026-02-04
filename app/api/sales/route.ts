import { NextResponse } from 'next/server';
import { getSheetValues } from '@/lib/sheets';
import { parseRosterEntries, parseSalesRows, normalizeName } from '@/lib/parse';
import {
  buildAdvisorDetail,
  buildAdvisorStatuses,
  buildApprovedTrendsByDay,
  buildLeaderboards,
  getPresetRange,
  aggregateTeam,
  buildRosterIndex,
  buildSpartanMonitoring,
  buildProductSellers,
  buildConsistentMonthlyProducers,
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

    const [newBusinessValues, rosterValues] = await Promise.all([
      // Use a wider range so adding future columns won't break parsing.
      getSheetValues(newBusinessSheet, 'A:AZ'),
      // Read extra columns (Unit, SPA/LEG, Program, PA Date, Tenure, etc.).
      getSheetValues(rosterSheet, 'A:Z'),
    ]);

    const rows = parseSalesRows(newBusinessValues);
    const rosterEntries = parseRosterEntries(rosterValues);
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
    const trends = {
      approvedByDay: buildApprovedTrendsByDay(rows, range.start, range.end, unit, null, rosterIndex),
    };

    const spartanMonitoring = buildSpartanMonitoring(statuses.advisors, rosterEntries, unit);

    // Consistent Monthly Producers (CMP) should be computed "as of the previous month"
    // (i.e., the most recently completed calendar month), regardless of the selected range.
    const cmpEnd = new Date(Date.UTC(
      manilaNow.getFullYear(),
      manilaNow.getMonth(),
      0
    ));

    const specialLookouts = {
      productSellers: buildProductSellers(rows, range.start, range.end, unit, rosterIndex),
      consistentMonthlyProducers: buildConsistentMonthlyProducers(rows, rosterEntries, unit, cmpEnd),
    };

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
      trends,
      spartanMonitoring,
      specialLookouts,
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
