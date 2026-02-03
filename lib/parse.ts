import { SalesRow } from './types';

const currencyToNumber = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  // Strip currency symbols, commas, and any non-numeric characters except dot and minus
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const parseDate = (v: unknown): Date | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Google Sheets often returns dates like "12/5/2022" (m/d/yyyy)
  // We'll parse it defensively.
  const parts = s.split(/[\/\-]/).map(p => p.trim());
  if (parts.length === 3 && parts[2].length >= 2) {
    const m = Number(parts[0]);
    const d = Number(parts[1]);
    const y = Number(parts[2].length === 2 ? `20${parts[2]}` : parts[2]);
    if ([m, d, y].every(Number.isFinite) && y > 1900) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  // Fallback: Date.parse
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t);
};

export const normalizeName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

export const parseSalesRows = (values: string[][]): SalesRow[] => {
  if (!values || values.length < 2) return [];

  // Normalize headers to handle line breaks, extra spaces, etc.
  const norm = (s: unknown) => String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Some users add a title row above the actual headers (merged cells, etc.).
  // Detect the most likely header row by searching the first few rows for known columns.
  const expected = [
    'month approved',
    'policy number',
    'advisor',
    'unit manager',
    'product',
    'date submitted',
    'date paid',
    'date approved',
  ];

  let headerRowIndex = 0;
  let bestScore = -1;
  const scanLimit = Math.min(values.length, 10);
  for (let i = 0; i < scanLimit; i++) {
    const row = values[i] ?? [];
    const headersHere = row.map(norm);
    const score = expected.reduce((acc, h) => acc + (headersHere.includes(h) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  // If we couldn't find at least a few expected headers, fall back to first row.
  if (bestScore < 3) headerRowIndex = 0;

  const headers = (values[headerRowIndex] ?? []).map((h) => String(h ?? '').replace(/\s+/g, ' ').trim());
  const headersNorm = headers.map(norm);
  const idx = (h: string) => headersNorm.findIndex(x => x === norm(h));

  const get = (row: string[], h: string) => {
    const i = idx(h);
    if (i === -1) return '';
    return row[i] ?? '';
  };

  return values
    .slice(headerRowIndex + 1)
    .filter(r => r.some(c => String(c ?? '').trim() !== ''))
    .map(r => {
      const row: SalesRow = {
        monthApproved: String(get(r, 'Month Approved') || '').trim() || undefined,
        policyNumber: String(get(r, 'Policy Number') || '').trim() || undefined,
        advisor: String(get(r, 'Advisor') || '').trim() || undefined,
        unitManager: String(get(r, 'Unit Manager') || '').trim() || undefined,
        policyOwner: String(get(r, 'Policy Owner') || '').trim() || undefined,
        product: String(get(r, 'Product') || '').trim() || undefined,
        anp: currencyToNumber(get(r, 'ANP')),
        fyp: currencyToNumber(get(r, 'FYP')),
        fyc: currencyToNumber(get(r, 'FYC')),
        mode: String(get(r, 'Mode') || '').trim() || undefined,
        mdrtFyp: currencyToNumber(get(r, 'MDRT FYP')),
        afyc: currencyToNumber(get(r, 'AFYC')),
        caseCount: currencyToNumber(get(r, 'Case Count')),
        faceAmount: currencyToNumber(get(r, 'Face Amount')),
        dateSubmitted: parseDate(get(r, 'Date Submitted')),
        datePaid: parseDate(get(r, 'Date Paid')),
        dateApproved: parseDate(get(r, 'Date Approved')),
        remarks: String(get(r, 'Remarks / Status') || '').trim() || undefined,
      };
      return row;
    });
};

export const parseRoster = (values: string[][]): string[] => {
  // Expect a single column header "Advisors" then names
  if (!values || values.length < 2) return [];
  return values
    .slice(1)
    .map(r => String(r[0] ?? '').trim())
    .filter(Boolean);
};

export const monthApprovedToDate = (monthApproved?: string): Date | null => {
  if (!monthApproved) return null;
  // Ex: "January 2026"
  const parts = monthApproved.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const monthName = parts[0].toLowerCase();
  const year = Number(parts[1]);
  const months = [
    'january','february','march','april','may','june','july','august','september','october','november','december'
  ];
  const m = months.indexOf(monthName);
  if (m === -1 || !Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, m, 1));
};

export const formatISODate = (d: Date): string => {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
