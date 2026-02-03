import { NextResponse } from 'next/server';
import { getSheetValues } from '@/lib/sheets';
import { parseRoster, parseSalesRows } from '@/lib/parse';
import {
  buildAdvisorDetail,
  buildAdvisorStatuses,
  buildApprovedTrendsByDay,
  buildLeaderboards,
  getPresetRange,
  aggregateTeam,
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
      getSheetValues(rosterSheet, 'A:A'),
    ]);

    const rows = parseSalesRows(newBusinessValues);
    const roster = parseRoster(rosterValues);

    const units = Array.from(
      new Set(rows.map(r => (r.unitManager || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const advisors = Array.from(new Set(roster.filter(Boolean))).sort((a, b) => a.localeCompare(b));

    const statuses = buildAdvisorStatuses(rows, roster, range.start, range.end, unit);
    const team = aggregateTeam(statuses.advisors);
    const leaderboards = buildLeaderboards(statuses.advisors);
    const trends = {
      approvedByDay: buildApprovedTrendsByDay(rows, range.start, range.end, unit, null),
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
    };

    if (advisor !== 'All') {
      resp.advisorDetail = buildAdvisorDetail(rows, advisor, range.start, range.end, unit);
    }

    return NextResponse.json(resp);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
