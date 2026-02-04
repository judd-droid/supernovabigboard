import { RosterEntry, SalesRow } from './types';

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
    // Support both m/d/yyyy and yyyy/m/d formats.
    const isYmd = parts[0].length === 4;
    const m = Number(isYmd ? parts[1] : parts[0]);
    const d = Number(isYmd ? parts[2] : parts[1]);
    const yRaw = isYmd ? parts[0] : parts[2];
    const y = Number(yRaw.length === 2 ? `20${yRaw}` : yRaw);
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
  // Backward compatible helper: return just advisor names.
  return parseRosterEntries(values).map(e => e.advisor);
};

export const parseRosterEntries = (values: string[][]): RosterEntry[] => {
  if (!values || values.length === 0) return [];

  const norm = (s: unknown) => String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Detect header row (first few rows) so we can handle title rows or formatting.
  const expected = ['advisors', 'advisor', 'unit', 'spa / leg', 'spa/leg', 'program', 'pa date', 'tenure', 'months cmp 2025', 'months cmp'];
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

  // If no recognizable header, assume old format: first column is names.
  if (bestScore < 1) {
    return values
      .slice(1)
      .map(r => ({ advisor: String(r[0] ?? '').trim() }))
      .filter(r => Boolean(r.advisor));
  }

  const headers = (values[headerRowIndex] ?? []).map((h) => String(h ?? '').replace(/\s+/g, ' ').trim());
  const headersNorm = headers.map(norm);
  const idxAny = (candidates: string[]) => {
    for (const c of candidates) {
      const i = headersNorm.findIndex(x => x === norm(c));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iAdvisor = idxAny(['Advisors', 'Advisor', 'Name']);
  const iUnit = idxAny(['Unit']);
  const iSpaLeg = idxAny(['SPA / LEG', 'SPA/LEG', 'SPA / LEG ', 'SPA / LEG']);
  const iProgram = idxAny(['Program']);
  const iPaDate = idxAny(['PA Date', 'PA date', 'PA']);
  const iTenure = idxAny(['Tenure', 'TENURE']);
  const iMonthsCmp2025 = idxAny(['Months CMP 2025', 'Months CMP2025', 'CMP 2025', 'Months CMP']);

  const rows = values
    .slice(headerRowIndex + 1)
    .filter(r => r.some(c => String(c ?? '').trim() !== ''))
    .map((r): RosterEntry => {
      const advisor = String((iAdvisor >= 0 ? r[iAdvisor] : r[0]) ?? '').trim();
      const unit = String((iUnit >= 0 ? r[iUnit] : '') ?? '').trim();
      const spaLeg = String((iSpaLeg >= 0 ? r[iSpaLeg] : '') ?? '').trim();
      const program = String((iProgram >= 0 ? r[iProgram] : '') ?? '').trim();
      const paDate = parseDate(iPaDate >= 0 ? r[iPaDate] : null);
      const tenure = String((iTenure >= 0 ? r[iTenure] : '') ?? '').trim();
      const monthsCmp2025 = currencyToNumber(iMonthsCmp2025 >= 0 ? r[iMonthsCmp2025] : 0);

      return {
        advisor,
        unit: unit || undefined,
        spaLeg: spaLeg || undefined,
        program: program || undefined,
        paDate,
        tenure: tenure || undefined,
        monthsCmp2025: monthsCmp2025 || undefined,
      };
    })
    .filter(r => Boolean(r.advisor));

  // Deduplicate by normalized advisor name, preferring the first occurrence.
  const dedup = new Map<string, RosterEntry>();
  for (const r of rows) {
    const key = normalizeName(r.advisor);
    if (!dedup.has(key)) dedup.set(key, r);
  }
  return Array.from(dedup.values());
};

export const monthApprovedToDate = (monthApproved?: string): Date | null => {
  if (!monthApproved) return null;
  const raw = String(monthApproved).trim();
  if (!raw) return null;

  // Common numeric formats: YYYY-MM, YYYY/MM, YYYY-MM-DD
  const m1 = raw.match(/^(\d{4})[\/-](\d{1,2})(?:[\/-](\d{1,2}))?$/);
  if (m1) {
    const y = Number(m1[1]);
    const mo = Number(m1[2]);
    if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
      return new Date(Date.UTC(y, mo - 1, 1));
    }
  }

  // Text formats: "January 2026", "Jan 2026"
  const parts = raw.split(/\s+/);
  if (parts.length < 2) return null;
  const monthToken = parts[0].toLowerCase();
  const year = Number(parts[1]);
  if (!Number.isFinite(year)) return null;

  const monthNames = [
    'january','february','march','april','may','june','july','august','september','october','november','december'
  ];
  const monthAbbr = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  let mi = monthNames.indexOf(monthToken);
  if (mi === -1) {
    const ab = monthToken.slice(0, 3);
    mi = monthAbbr.indexOf(ab);
  }
  if (mi === -1) return null;
  return new Date(Date.UTC(year, mi, 1));
};

export const formatISODate = (d: Date): string => {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
