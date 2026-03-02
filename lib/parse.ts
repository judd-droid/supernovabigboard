import { DprRow, RosterEntry, SalesRow, ReclassificationEntry } from './types';

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

  // Google Sheets API can return dates as serial numbers when dateTimeRenderOption=SERIAL_NUMBER.
  // Serial numbers are days since 1899-12-30 (Google Sheets / Excel-style).
  const serialToDateUTC = (serial: number): Date | null => {
    if (!Number.isFinite(serial)) return null;
    // Heuristic: reject obviously-not-date serials.
    // 20000 ~ 1954-10-04, 60000 ~ 2064-04-10
    if (serial < 20000 || serial > 60000) return null;
    const base = Date.UTC(1899, 11, 30);
    // We only care about the calendar date in this dashboard, so ignore the fractional time portion.
    const days = Math.floor(serial);
    const ms = base + (days * 86400000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  if (typeof v === 'number') {
    return serialToDateUTC(v);
  }

  const s = String(v).trim();
  if (!s) return null;

  // Numeric strings may be serial numbers (because we stringify sheet cells).
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    const asSerial = serialToDateUTC(n);
    if (asSerial) return asSerial;
  }

  const monthNames = [
    'january','february','march','april','may','june','july','august','september','october','november','december'
  ];
  const monthAbbr = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const monthIndex = (token: string): number => {
    const t = token.toLowerCase().replace(/\./g, '');
    let i = monthNames.indexOf(t);
    if (i !== -1) return i;
    i = monthAbbr.indexOf(t.slice(0, 3));
    return i;
  };

  // Common numeric formats: m/d/yyyy, d/m/yyyy, yyyy-m-d
  // Note: when both m and d are <= 12, it's ambiguous. We'll use a heuristic:
  // - if one side is > 12, we can disambiguate
  // - otherwise, assume m/d/yyyy (AIA sheets typically use US-style), but serial numbers should handle the rest.
  const parts = s.split(/[\/\-]/).map(p => p.trim());
  if (parts.length === 3 && parts[2].length >= 2) {
    const isYmd = parts[0].length === 4;
    if (isYmd) {
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if ([m, d, y].every(Number.isFinite) && y > 1900) {
        const dt = new Date(Date.UTC(y, m - 1, d));
        return Number.isNaN(dt.getTime()) ? null : dt;
      }
    } else {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      const yRaw = parts[2];
      const y = Number(yRaw.length === 2 ? `20${yRaw}` : yRaw);
      if ([a, b, y].every(Number.isFinite) && y > 1900) {
        // Heuristic month/day selection.
        const monthFirst = (a > 12 && b <= 12) ? false
          : (b > 12 && a <= 12) ? true
          : true;
        const m = monthFirst ? a : b;
        const d = monthFirst ? b : a;
        const dt = new Date(Date.UTC(y, m - 1, d));
        return Number.isNaN(dt.getTime()) ? null : dt;
      }
    }
  }

  // Text formats: "01-Feb-2026", "1 Feb 2026", "Feb 1, 2026"
  const m1 = s.match(/^(\d{1,2})[\-\s]([A-Za-z]{3,})[\-\s,]*(\d{2,4})$/);
  if (m1) {
    const d = Number(m1[1]);
    const mi = monthIndex(m1[2]);
    const y = Number(m1[3].length === 2 ? `20${m1[3]}` : m1[3]);
    if (Number.isFinite(d) && mi >= 0 && Number.isFinite(y) && y > 1900) {
      const dt = new Date(Date.UTC(y, mi, d));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  const m2 = s.match(/^([A-Za-z]{3,})\s+(\d{1,2})(?:,)?\s+(\d{2,4})$/);
  if (m2) {
    const mi = monthIndex(m2[1]);
    const d = Number(m2[2]);
    const y = Number(m2[3].length === 2 ? `20${m2[3]}` : m2[3]);
    if (mi >= 0 && Number.isFinite(d) && Number.isFinite(y) && y > 1900) {
      const dt = new Date(Date.UTC(y, mi, d));
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


  // Looser matching for columns that often have extra text in the header cell.
  const idxAnyContains = (candidates: string[]) => {
    for (const c of candidates) {
      const needle = norm(c);
      const i = headersNorm.findIndex(x => x.includes(needle));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iAdvisor = idxAny(['Advisors', 'Advisor', 'Name']);
  const iUnit = idxAny(['Unit']);
  const iSpaLeg = idxAnyContains(['SPA / LEG', 'SPA/LEG']);
  const iProgram = idxAny(['Program']);
  const iPaDate = idxAnyContains(['PA Date', 'PA date']);
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

export const parseReclassificationEntries = (values: string[][]): ReclassificationEntry[] => {
  if (!values || values.length === 0) return [];

  const norm = (s: unknown) => String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const expected = ['advisors', 'advisor', 'spa / leg', 'spa/leg', 'start date', 'end date'];
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

  if (bestScore < 2) return [];

  const headers = (values[headerRowIndex] ?? []).map((h) => String(h ?? '').replace(/\s+/g, ' ').trim());
  const headersNorm = headers.map(norm);
  const idxAny = (candidates: string[]) => {
    for (const c of candidates) {
      const i = headersNorm.findIndex(x => x === norm(c));
      if (i !== -1) return i;
    }
    return -1;
  };


  // Looser matching for columns that often have extra text in the header cell.
  const idxAnyContains = (candidates: string[]) => {
    for (const c of candidates) {
      const needle = norm(c);
      const i = headersNorm.findIndex(x => x.includes(needle));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iAdvisor = idxAny(['Advisors', 'Advisor', 'Name']);
  const iSpaLeg = idxAnyContains(['SPA / LEG', 'SPA/LEG']);
  const iStart = idxAnyContains(['Start Date', 'Start']);
  const iEnd = idxAnyContains(['End Date', 'End']);

  const rows = values
    .slice(headerRowIndex + 1)
    .filter(r => r.some(c => String(c ?? '').trim() !== ''))
    .map((r): ReclassificationEntry => {
      const advisor = String((iAdvisor >= 0 ? r[iAdvisor] : r[0]) ?? '').trim();
      const spaLeg = String((iSpaLeg >= 0 ? r[iSpaLeg] : '') ?? '').trim();
      const startDate = parseDate(iStart >= 0 ? r[iStart] : null);
      const endDate = parseDate(iEnd >= 0 ? r[iEnd] : null);
      return { advisor, spaLeg, startDate, endDate };
    })
    .filter(r => Boolean(r.advisor) && Boolean(r.spaLeg) && Boolean(r.startDate) && Boolean(r.endDate));

  // Sort by advisor then start date
  rows.sort((a, b) => {
    const na = normalizeName(a.advisor);
    const nb = normalizeName(b.advisor);
    if (na !== nb) return na.localeCompare(nb);
    return (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0);
  });

  return rows;
};

export const parseDprRows = (values: string[][]): DprRow[] => {
  if (!values || values.length < 2) return [];

  const norm = (s: unknown) => String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const expected = ['month', 'advisor', 'fyc', 'anp', 'fyp', 'pers'];
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

  // If we can't find headers, assume old format and bail out (we need Month + Advisor at minimum)
  if (bestScore < 2) return [];

  const headers = (values[headerRowIndex] ?? []).map((h) => String(h ?? '').replace(/\s+/g, ' ').trim());
  const headersNorm = headers.map(norm);
  const idx = (h: string) => headersNorm.findIndex(x => x === norm(h));

  const iMonth = idx('Month');
  const iAdvisor = idx('Advisor');
  const iFyc = idx('FYC');
  const iAnp = idx('ANP');
  const iFyp = idx('FYP');
  const iPers = idx('PERS');

  const optNumber = (v: unknown): number | null => {
    const s = String(v ?? '').trim();
    if (!s) return null;
    return currencyToNumber(s);
  };

  const toMonthKey = (monthVal: unknown): string | null => {
    const d = monthApprovedToDate(String(monthVal ?? '').trim());
    if (!d) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  return values
    .slice(headerRowIndex + 1)
    .filter(r => r.some(c => String(c ?? '').trim() !== ''))
    .map((r): DprRow | null => {
      const monthKey = toMonthKey(iMonth >= 0 ? r[iMonth] : null);
      const advisor = String((iAdvisor >= 0 ? r[iAdvisor] : '') ?? '').trim();
      if (!monthKey || !advisor) return null;

      return {
        monthKey,
        advisor,
        fyc: currencyToNumber(iFyc >= 0 ? r[iFyc] : 0),
        anp: currencyToNumber(iAnp >= 0 ? r[iAnp] : 0),
        fyp: currencyToNumber(iFyp >= 0 ? r[iFyp] : 0),
        pers: optNumber(iPers >= 0 ? r[iPers] : null),
      };
    })
    .filter((r): r is DprRow => Boolean(r));
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
