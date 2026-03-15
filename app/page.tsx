'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { TrendingUp, CheckCircle2, Users, LogOut } from 'lucide-react';

import type { ApiResponse, RangePreset, AdvisorStatus } from '@/lib/types';
import type { SpaLegFilter } from '@/lib/spaLeg';
import { matchesSpaLegFilter } from '@/lib/spaLeg';
import { formatPeso, formatNumber, fmtDateRange } from '@/lib/format';

import { PendingCaseMonitoring } from '@/components/PendingCaseMonitoring';
import { KpiCard } from '@/components/KpiCard';
import { Section } from '@/components/Section';
import { Field, Select, DateInput } from '@/components/Field';
import { AdvisorStatusPanel } from '@/components/AdvisorStatusPanel';
import { TrendChart } from '@/components/TrendChart';
import { Leaderboard } from '@/components/Leaderboard';
import { ProductMix } from '@/components/ProductMix';
import { SpartanMonitoringRow } from '@/components/SpartanMonitoringRow';
import { LegacyMonitoringRow } from '@/components/LegacyMonitoringRow';
import { SpecialLookoutsRow } from '@/components/SpecialLookoutsRow';
import { PpbTrackerRow } from '@/components/PpbTrackerRow';
import { MonthlyExcellenceBadgesRow } from '@/components/MonthlyExcellenceBadgesRow';
import { CopySummaryButton } from '@/components/CopySummaryButton';
import { MdrtTracker } from '@/components/MdrtTracker';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
  return res.json() as Promise<ApiResponse>;
};

const presetLabel: Record<RangePreset, string> = {
  MTD: 'MTD',
  QTD: 'QTD',
  YTD: 'YTD',
  PREV_MONTH: 'Previous Month',
  CUSTOM: 'Custom',
};

function buildUrl({ preset, unit, advisor, spaLeg, start, end }: { preset: RangePreset; unit: string; advisor: string; spaLeg: SpaLegFilter; start?: string; end?: string; }) {
  const p = new URLSearchParams();
  p.set('preset', preset);
  p.set('unit', unit);
  p.set('advisor', advisor);
  p.set('spaleg', spaLeg);
  if (preset === 'CUSTOM' && start && end) {
    p.set('start', start);
    p.set('end', end);
  }
  return `/api/sales?${p.toString()}`;
}

export default function Page() {
  const [tab, setTab] = useState<'team' | 'advisor'>('team');
  const [preset, setPreset] = useState<RangePreset>('MTD');
  const [unit, setUnit] = useState('All');
  const [advisor, setAdvisor] = useState('All');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [spaLegFilter, setSpaLegFilter] = useState<SpaLegFilter>('All');

  const effectiveAdvisor = tab === 'advisor' ? advisor : 'All';

  const url = useMemo(() => buildUrl({
    preset,
    unit,
    advisor: effectiveAdvisor,
    spaLeg: spaLegFilter,
    start: customStart,
    end: customEnd,
  }), [preset, unit, effectiveAdvisor, spaLegFilter, customStart, customEnd]);

  const { data, error, isLoading } = useSWR(url, fetcher, { revalidateOnFocus: false });

  const options = data?.options;
  const filterStatuses = (arr: AdvisorStatus[]) => arr.filter(a => matchesSpaLegFilter(a.spaLeg, spaLegFilter));

  const filteredProducing = data ? filterStatuses(data.producingAdvisors.producing) : [];
  const filteredPending = data ? filterStatuses(data.producingAdvisors.pending) : [];
  const filteredNonProducing = data ? filterStatuses(data.producingAdvisors.nonProducing) : [];

  const approvedPerformanceSummary = useMemo(() => {
    if (!data) return '';
    // Compact bullet format for easy pasting into notes/messages
    const header = `- Approved Performance (${presetLabel[preset]} · ${fmtDateRange(data.filters.start, data.filters.end)})`;
    return [
      header,
      `    - FYC: ${formatPeso(data.team.approved.fyc)}`,
      `    - FYP: ${formatPeso(data.team.approved.fyp)}`,
      `    - ANP: ${formatPeso(data.team.approved.anp)}`,
      `    - Cases: ${formatNumber(data.team.approved.caseCount)}`,
    ].join('\n');
  }, [data, preset]);

  const advisorOverviewSummary = useMemo(() => {
    if (!data) return '';
    const header = `## Advisor Production Overview (${spaLegFilter}) (${presetLabel[preset]} · ${fmtDateRange(data.filters.start, data.filters.end)})`;

    const producingSet = new Set(filteredProducing.map(a => (a.advisor ?? '').trim().toLowerCase()));

    const listWithAmounts = (items: AdvisorStatus[], getRight: (a: AdvisorStatus) => string, wrapIfAlsoProducing = false) => {
      if (!items.length) return ['- None'];
      return items.map(a => {
        const name = (a.advisor ?? '').trim();
        const key = name.toLowerCase();
        const shownName = wrapIfAlsoProducing && producingSet.has(key) ? `(${name})` : name;
        const amt = getRight(a);
        return `- ${shownName}${amt ? ` — ${amt}` : ''}`;
      });
    };

    const listNamesOnly = (items: AdvisorStatus[]) => {
      if (!items.length) return ['- None'];
      return items.map(a => `- ${(a.advisor ?? '').trim()}`);
    };

    return [
      header,
      '',
      `### Producing (${filteredProducing.length})`,
      '',
      ...listWithAmounts(filteredProducing, (a) => formatPeso(a.approved.fyc)),
      '',
      `### Pending (${filteredPending.length})`,
      '',
      ...listWithAmounts(filteredPending, (a) => formatPeso(a.open.fyc), true),
      '',
      `### Non-Producing (${filteredNonProducing.length})`,
      '',
      ...listNamesOnly(filteredNonProducing),
    ].join('\n');
  }, [spaLegFilter, data, filteredNonProducing, filteredPending, filteredProducing, preset]);

  const monthlyBadgesSummary = useMemo(() => {
    if (!data?.monthlyExcellenceBadges) return '';
    const d = data.monthlyExcellenceBadges;
    const header = `- MEA Badges (Counting: ${d.asOfMonth}) (${spaLegFilter})`;
    const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
    const filter = <T extends { spaLeg?: string }>(arr: T[]) => {
      if (spaLegFilter === 'All') return arr;
      const want = spaLegFilter === 'Spartans' ? 'spartan' : 'legacy';
      return arr.filter((r) => norm(r.spaLeg) === want);
    };
    const joinOneLine = (items: string[]) => (items.length ? items.join('; ') : 'None');
    const block = (title: string, b: any, isCases = false) => {
      const achieved = filter(b.achieved ?? []);
      const close = filter(b.close ?? []);
      const hit = achieved.length
        ? achieved.map((a: any) => `${a.advisor} — ${a.tier} (${isCases ? a.value : formatPeso(a.value)})`)
        : ['None'];
      const closeLine = close.length
        ? close.map((c: any) => `${c.advisor} — ${c.targetTier} (+${isCases ? c.remaining : formatPeso(c.remaining)})`)
        : ['None'];

      return [
        `    - ${title}`,
        `        - Hit: ${joinOneLine(hit)}`,
        `        - Close: ${joinOneLine(closeLine)}`,
      ].join('\n');
    };
    return [
      header,
      block('Premiums (MDRT FYP)', d.premiums, false),
      block('Saved Lives (cases)', d.savedLives, true),
      block('Income (FYC)', d.income, false),
    ].join('\n');
  }, [spaLegFilter, data?.monthlyExcellenceBadges]);

  const ppbTrackerSummaryText = useMemo(() => {
    if (!data?.ppbTracker) return '';
    const d = data.ppbTracker;
    const rows = spaLegFilter === 'All'
      ? d.rows
      : d.rows.filter(r => matchesSpaLegFilter(r.spaLeg, spaLegFilter));

    const pct = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);
    const header = `## PPB Tracker (${spaLegFilter}) — ${d.quarter}`;
    const cols = ['Advisor', 'FYC', 'Cases', 'Total Bonus', 'PPB', 'CCB', 'Projected'];
    const lines = rows.map((r) => [
      r.advisor,
      formatPeso(r.fyc),
      `${r.cases}`,
      `${pct(r.totalBonusRate)}`,
      `${pct(r.ppbRate)}`,
      `${pct(r.ccbRate)}`,
      r.projectedBonus == null ? '—' : formatPeso(r.projectedBonus),
    ].join(' | '));

    return [header, '', cols.join(' | '), ...lines].join('\n');
  }, [data?.ppbTracker, spaLegFilter]);

  const openOnePageSummary = useCallback(() => {
    if (!data) return;

    const s: string[] = [];
    const fmtDate = (iso: string) => iso.replace(/-/g, '/');

    // Subheading with range and filter
    s.push(`${presetLabel[preset]} · ${fmtDateRange(data.filters.start, data.filters.end)}`);
    s.push(`Filter: ${spaLegFilter}`);

    // --- Approved Performance ---
    s.push('## Approved Performance');
    s.push(`- FYC: ${formatPeso(data.team.approved.fyc)}`);
    s.push(`- FYP: ${formatPeso(data.team.approved.fyp)}`);
    s.push(`- ANP: ${formatPeso(data.team.approved.anp)}`);
    s.push(`- Cases: ${formatNumber(data.team.approved.caseCount)}`);
    s.push('---');

    // --- Spartan / Legacy Monitoring ---
    if (spaLegFilter === 'Legacy' && data.legacyMonitoring) {
      const d = data.legacyMonitoring;
      const pct = d.totalLegacies > 0 ? Math.round(d.activityRatio * 100) : 0;
      s.push('## Legacy Monitoring');
      s.push(`Activity Ratio: ${d.producingLegacies}/${d.totalLegacies} (${pct}% producing)`);
      s.push('### Legacy Achievers (2+ cases):');
      if (d.achievers.length) {
        d.achievers.forEach(a => s.push(`- ${a.advisor} — ${a.cases} cases`));
      } else {
        s.push('- None');
      }
      s.push('### Legacy FYC and Cases');
      s.push(`- FYC: ${formatPeso(d.totals.approvedFyc)}`);
      s.push(`- Cases: ${d.totals.approvedCases}`);
      s.push(`- Avg FYC/case: ${formatPeso(d.totals.avgFycPerCase)}`);
      s.push('---');
    } else if (data.spartanMonitoring) {
      const d = data.spartanMonitoring;
      const pct = d.totalSpartans > 0 ? Math.round(d.activityRatio * 100) : 0;
      s.push('## Spartan Monitoring');
      s.push(`Activity Ratio: ${d.producingSpartans}/${d.totalSpartans} (${pct}% producing)`);
      s.push('### Spartan ANIMALs (2+ cases):');
      if (d.animals.length) {
        d.animals.forEach(a => s.push(`- ${a.advisor} — ${a.cases} cases`));
      } else {
        s.push('- None');
      }
      s.push('### Spartan FYC and Cases');
      s.push(`- FYC: ${formatPeso(d.totals.approvedFyc)}`);
      s.push(`- Cases: ${d.totals.approvedCases}`);
      s.push(`- Avg FYC/case: ${formatPeso(d.totals.avgFycPerCase)}`);
      s.push('---');
    }

    // --- Special Lookouts ---
    if (data.specialLookouts) {
      const ps = data.specialLookouts.productSellers;
      const cmp = data.specialLookouts.consistentMonthlyProducers;
      s.push('## Special Lookouts');

      s.push('### Product Lookouts with FYC:');
      const listProd = (label: string, items: typeof ps.aPlusSignature) => {
        if (!items.length) { s.push(`${label}: None`); return; }
        s.push(`${label}:`);
        items.forEach(i => s.push(`- ${i.advisor} — ${i.product} — ${formatPeso(i.fyc)}`));
      };
      listProd('A+ Signature', ps.aPlusSignature);
      listProd('Ascend', ps.ascend);
      listProd('FutureSafe USD 5-Pay', ps.futureSafeUsd5Pay);

      const asOf = (cmp.asOfMonth ?? '').replace('-', '/');
      s.push(`### CMP as of ${asOf}:`);
      const joinCmp = (label: string, arr: Array<{ advisor: string; streakMonths: number }>) => {
        s.push(`${label}:`);
        if (!arr.length) { s.push('- None'); return; }
        arr.forEach(r => s.push(`- ${r.advisor} (${r.streakMonths} mo)`));
      };
      joinCmp('3+ Months', cmp.threePlus);
      joinCmp('2 Months', cmp.watch2);
      joinCmp('1 Month', cmp.watch1);

      const salesRoundup = data.specialLookouts.salesRoundup ?? [];
      const filteredRoundup = spaLegFilter === 'All'
        ? salesRoundup
        : salesRoundup.filter(sr => matchesSpaLegFilter(sr.spaLeg, spaLegFilter));
      s.push('### Sales Round-up with AFYC:');
      if (!filteredRoundup.length) {
        s.push('- None');
      } else {
        filteredRoundup.forEach(sr => {
          const showAmt = (sr.afyc ?? 0) >= 1000;
          s.push(`- ${sr.advisor} — ${sr.product}${showAmt ? ` — ${formatPeso(sr.afyc)}` : ''}`);
        });
      }
      s.push('---');
    }

    // --- PPB Tracker ---
    if (ppbTrackerSummaryText) {
      // Re-use existing summary but fix header to ##
      const ppbLines = ppbTrackerSummaryText.split('\n');
      s.push('## PPB Tracker');
      // Skip the original header line (starts with "## PPB Tracker")
      const bodyStart = ppbLines[0].startsWith('##') ? (ppbLines[1] === '' ? 2 : 1) : 0;
      ppbLines.slice(bodyStart).forEach(l => s.push(l));
      s.push('---');
    }

    // --- Advisor Production Overview ---
    {
      const producingSet = new Set(filteredProducing.map(a => (a.advisor ?? '').trim().toLowerCase()));

      s.push('## Advisor Production Overview');
      s.push(`### Producing (${filteredProducing.length})`);
      if (filteredProducing.length) {
        filteredProducing.forEach(a => s.push(`- ${(a.advisor ?? '').trim()} — ${formatPeso(a.approved.fyc)}`));
      } else {
        s.push('- None');
      }
      s.push(`### Pending (${filteredPending.length})`);
      if (filteredPending.length) {
        filteredPending.forEach(a => {
          const name = (a.advisor ?? '').trim();
          const key = name.toLowerCase();
          const shown = producingSet.has(key) ? `(${name})` : name;
          s.push(`- ${shown} — ${formatPeso(a.open.fyc)}`);
        });
      } else {
        s.push('- None');
      }
      s.push(`### Non-Producing (${filteredNonProducing.length})`);
      s.push('---');
    }

    // --- Pending Case Monitoring ---
    if (data.pendingCases && data.pendingCases.length > 0) {
      const rows = data.pendingCases;
      const totalANP = rows.reduce((acc, r) => acc + r.anp, 0);
      const totalFYC = rows.reduce((acc, r) => acc + r.fyc, 0);
      s.push('## Pending Case Monitoring');
      s.push('### Snapshot');
      s.push(`- ${rows.length} pending cases`);
      s.push(`- ANP: ${formatPeso(totalANP)}`);
      s.push(`- FYC: ${formatPeso(totalFYC)}`);
      s.push('### Pending Cases');
      rows.forEach(r => {
        s.push(`<details>`);
        s.push(`<summary>${r.policyNumber || '—'} (${r.advisor})</summary>`);
        s.push(`\t- ${r.product}`);
        s.push(`\t- ANP ${formatPeso(r.anp)}`);
        s.push(`\t- FYC ${formatPeso(r.fyc)}`);
        s.push(`\t- Paid ${fmtDate(r.datePaid)}`);
        s.push(`\t- ${r.daysPending}d pending`);
        s.push(`\t- ${r.remarks || 'Pending'}`);
        s.push(`</details>`);
      });
      s.push('---');
    }

    // --- Monthly Excellence Awards Badges ---
    if (data.monthlyExcellenceBadges) {
      const mea = data.monthlyExcellenceBadges;
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
      const filterMea = <T extends { spaLeg?: string }>(arr: T[]) => {
        if (spaLegFilter === 'All') return arr;
        const want = spaLegFilter === 'Spartans' ? 'spartan' : 'legacy';
        return arr.filter(r => norm(r.spaLeg) === want);
      };

      s.push('## Monthly Excellence Awards Badges');

      const meaBlock = (title: string, badge: typeof mea.premiums, isCases: boolean) => {
        s.push(`### ${title}`);
        const achieved = filterMea(badge.achieved);
        const close = filterMea(badge.close);
        if (achieved.length) {
          s.push('- Hit:');
          achieved.forEach(a => s.push(`\t- ${a.advisor} — ${a.tier} (${isCases ? a.value : formatPeso(a.value)})`));
        } else {
          s.push('- Hit: None');
        }
        if (close.length) {
          s.push('- Close:');
          close.forEach(c => s.push(`\t- ${c.advisor} — ${c.targetTier} (+${isCases ? c.remaining : formatPeso(c.remaining)})`));
        } else {
          s.push('- Close: None');
        }
      };

      meaBlock('Premiums (MDRT FYP)', mea.premiums, false);
      meaBlock('Saved Lives (Cases)', mea.savedLives, true);
      meaBlock('Income (FYC)', mea.income, false);
    }

    const fullText = s.join('\n').trim();

    // Open popup window
    const popup = window.open('', '_blank', 'width=800,height=900,scrollbars=yes,resizable=yes');
    if (!popup) return;

    popup.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>1-Page Summary</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; padding: 32px; background: #fff; color: #1e293b; line-height: 1.6; }
  .copy-btn { position: fixed; top: 16px; right: 16px; background: #0f172a; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; z-index: 10; }
  .copy-btn:hover { background: #334155; }
  .copy-btn.copied { background: #059669; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
</style>
</head>
<body>
<button class="copy-btn" onclick="copyAll()">Copy</button>
<pre id="content"></pre>
<script>
  document.getElementById('content').textContent = ${JSON.stringify(fullText)};
  function copyAll() {
    var text = document.getElementById('content').textContent;
    navigator.clipboard.writeText(text).then(function() {
      var btn = document.querySelector('.copy-btn');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
    });
  }
</script>
</body>
</html>`);
    popup.document.close();
  }, [data, preset, spaLegFilter, ppbTrackerSummaryText, filteredProducing, filteredPending, filteredNonProducing]);

  const mdrtSummaryText = useMemo(() => {
    if (!data?.mdrtTracker) return '';
    const d = data.mdrtTracker;
    const rows = spaLegFilter === 'All'
      ? d.rows
      : d.rows.filter(r => matchesSpaLegFilter(r.spaLeg, spaLegFilter));

    const header = `- MDRT Tracker (YTD · as of ${d.asOf}) (${spaLegFilter})`;
    const cols = 'Advisor | YTD MDRT FYP | Balance to MDRT';
    const lines = rows.map((r) => [
      r.advisor,
      formatPeso(r.mdrtFyp),
      formatPeso(r.balanceToMdrt),
    ].join(' | '));

    const ind = (s: string) => `    ${s}`;
    return [header, '', ind(cols), ...lines.map(ind)].join('\n');
  }, [data?.mdrtTracker, spaLegFilter]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4 no-print">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">New Business Dashboard</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {data ? `${presetLabel[preset]} · ${fmtDateRange(data.filters.start, data.filters.end)}` : 'Loading…'}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setTab('team')}
                className={`px-3 py-2 text-sm rounded-lg ${tab === 'team' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
              >
                Team
              </button>
              <button
                onClick={() => setTab('advisor')}
                className={`px-3 py-2 text-sm rounded-lg ${tab === 'advisor' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
              >
                Advisor
              </button>
            </div>

            <Field label="Range">
              <Select
                value={preset}
                onChange={(v) => setPreset(v as RangePreset)}
                options={[
                  { value: 'MTD', label: 'MTD' },
                  { value: 'QTD', label: 'QTD' },
                  { value: 'YTD', label: 'YTD' },
                  { value: 'PREV_MONTH', label: 'Previous Month' },
                  { value: 'CUSTOM', label: 'Custom' },
                ]}
              />
            </Field>

            {preset === 'CUSTOM' ? (
              <>
                <Field label="Start">
                  <DateInput value={customStart} onChange={setCustomStart} />
                </Field>
                <Field label="End">
                  <DateInput value={customEnd} onChange={setCustomEnd} />
                </Field>
              </>
            ) : null}

            <Field label="Unit">
              <Select
                value={unit}
                onChange={setUnit}
                options={options?.units ?? ['All']}
              />
            </Field>

            <Field label="SPA/LEG">
              <div className="flex items-center rounded-xl bg-slate-100 p-1">
                {(['All', 'Spartans', 'Legacy'] as const).map((v) => (
                  <button
                    key={`spaleg-filter-${v}`}
                    onClick={() => setSpaLegFilter(v)}
                    className={`px-3 py-2 text-xs rounded-lg ${spaLegFilter === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </Field>

            
            {tab === 'advisor' ? (
              <Field label="Advisor">
                <Select
                  value={advisor}
                  onChange={setAdvisor}
                  options={options?.advisors ?? ['All']}
                />
              </Field>
            ) : null}

            <button
              className="h-10 rounded-xl bg-slate-900 px-4 text-sm text-white shadow-sm hover:bg-slate-800"
              onClick={openOnePageSummary}
              disabled={!data}
            >
              1-Page
            </button>

            <button
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 flex items-center gap-2"
              onClick={() => {
                try {
                  sessionStorage.removeItem('supernova_newbiz_dashboard_auth_v1');
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {String(error.message ?? error)}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-6 text-sm text-slate-500">Loading dashboard…</div>
      ) : null}

      {data ? (
        <>
          <Section
            title="Approved performance"
            right={<CopySummaryButton getText={() => approvedPerformanceSummary} title="Copy Approved Performance summary" />}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard title="Approved FYC" value={formatPeso(data.team.approved.fyc)} icon={<CheckCircle2 size={18} />} />
              <KpiCard title="Approved FYP" value={formatPeso(data.team.approved.fyp)} icon={<TrendingUp size={18} />} />
              <KpiCard title="Approved ANP" value={formatPeso(data.team.approved.anp)} />
              <KpiCard title="Approved cases" value={formatNumber(data.team.approved.caseCount)} icon={<Users size={18} />} />
            </div>
          </Section>

          {tab === 'team' && spaLegFilter === 'Legacy' && data.legacyMonitoring ? (
            <Section title="Legacy monitoring">
              <LegacyMonitoringRow data={data.legacyMonitoring} />
            </Section>
          ) : tab === 'team' && data.spartanMonitoring ? (
            <Section title="Spartan monitoring">
              <SpartanMonitoringRow data={data.spartanMonitoring} />
            </Section>
          ) : null}



          {tab === 'team' && data.specialLookouts ? (
            <Section title="Special lookouts">
              <SpecialLookoutsRow
                productSellers={data.specialLookouts.productSellers}
                consistentMonthlyProducers={data.specialLookouts.consistentMonthlyProducers}
                salesRoundup={data.specialLookouts.salesRoundup ?? []}
                advisorFilter={spaLegFilter}
              />
            </Section>
          ) : null}

          {tab === 'team' && data.ppbTracker ? (
            <Section
              title="PPB tracker"
              right={(
                <div className="flex items-center gap-3">
                  <CopySummaryButton getText={() => ppbTrackerSummaryText} title="Copy PPB Tracker summary" />
                </div>
              )}
            >
              <PpbTrackerRow data={data.ppbTracker} advisorFilter={spaLegFilter} />
            </Section>
          ) : null}

          {tab === 'team' ? (
            <Section
              title="Advisor production overview"
              right={(
                <div className="flex items-center gap-3">
                  <CopySummaryButton
                    getText={() => advisorOverviewSummary}
                    title="Copy Advisor Production Overview summary"
                  />
                </div>
              )}
            >
              <AdvisorStatusPanel
                producing={filteredProducing}
                pending={filteredPending}
                nonProducing={filteredNonProducing}
              />
            </Section>
          ) : null}

          {data.pendingCases && data.pendingCases.length > 0 ? (
            <Section title="Pending case monitoring">
              <PendingCaseMonitoring rows={data.pendingCases} />
            </Section>
          ) : null}

          {tab === 'team' && data.monthlyExcellenceBadges ? (
            <Section
              title="Monthly Excellence Awards Badges"
              right={(
                <div className="flex items-center gap-3">
                  <CopySummaryButton
                    getText={() => monthlyBadgesSummary}
                    title="Copy Monthly Excellence Badges summary"
                  />
                </div>
              )}
            >
              <MonthlyExcellenceBadgesRow
                data={data.monthlyExcellenceBadges}
                showToggle={false}
                advisorFilter={spaLegFilter}
                onAdvisorFilterChange={setSpaLegFilter}
              />
            </Section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Trend" >
              <TrendChart title="Approved trend" data={data.trends.approvedByDay} />
            </Section>

            <Section title="Leaderboards">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                <Leaderboard
                  title="Top advisors"
                  valueLabel="Approved FYC"
                  rows={data.leaderboards.advisorsByFYC.map(r => ({ name: r.advisor, value: r.value }))}
                />
                <Leaderboard
                  title="Top units"
                  valueLabel="Approved FYC"
                  rows={data.leaderboards.unitsByFYC.map(r => ({ name: r.unit, value: r.value }))}
                />
              </div>
            </Section>

            {tab === 'advisor' && data.advisorDetail ? (
              <Section title="Advisor breakdown">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <KpiCard title="Advisor Approved FYC" value={formatPeso(data.advisorDetail.approved.fyc)} />
                    <KpiCard title="Advisor Approved cases" value={formatNumber(data.advisorDetail.approved.caseCount)} />
                    <KpiCard title="Advisor Submitted FYP" value={formatPeso(data.advisorDetail.submitted.fyp)} />
                  </div>
                  <ProductMix rows={data.advisorDetail.productMix} />
                  <TrendChart title="Advisor trend" data={data.advisorDetail.approvedByDay} />
                </div>
              </Section>
            ) : (
              <Section
                title="MDRT Tracker"
                right={
                  <div className="flex items-center gap-3">
                    <CopySummaryButton
                      getText={() => mdrtSummaryText}
                      title="Copy MDRT Tracker summary"
                      ariaLabel="Copy MDRT Tracker text summary to clipboard"
                    />
                  </div>
                }
              >
                {data.mdrtTracker ? (
                  <MdrtTracker data={data.mdrtTracker} advisorFilter={spaLegFilter} />
                ) : (
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 text-slate-500">
                    No data
                  </div>
                )}
              </Section>
            )}
          </div>

          <div className="print-only hidden mt-8 text-xs text-slate-500">
            Generated: {new Date(data.generatedAt).toISOString()}
          </div>
        </>
      ) : null}
    </main>
  );
}
