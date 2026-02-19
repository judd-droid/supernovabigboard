'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { TrendingUp, CheckCircle2, Clock3, Users, LogOut } from 'lucide-react';

import type { ApiResponse, RangePreset, AdvisorStatus } from '@/lib/types';
import type { SpaLegFilter } from '@/lib/spaLeg';
import { matchesSpaLegFilter } from '@/lib/spaLeg';
import { formatPeso, formatNumber, fmtDateRange } from '@/lib/format';

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
  const producingCounts = data ? {
    producing: data.producingAdvisors.producing.length,
    pending: data.producingAdvisors.pending.length,
    nonProducing: data.producingAdvisors.nonProducing.length,
  } : { producing: 0, pending: 0, nonProducing: 0 };

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
                Team View
              </button>
              <button
                onClick={() => setTab('advisor')}
                className={`px-3 py-2 text-sm rounded-lg ${tab === 'advisor' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
              >
                Advisor View
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
              onClick={() => window.print()}
            >
              Print
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

          <Section title="Pipeline signals">
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard title="Submitted FYP" value={formatPeso(data.team.submitted.fyp)} icon={<Clock3 size={18} />} />
              <KpiCard title="Paid FYP" value={formatPeso(data.team.paid.fyp)} />
              <KpiCard title="Advisors with pending cases" value={formatNumber(producingCounts.pending)} sub="(Name) means already producing" />
              <KpiCard title="Non-producing advisors" value={formatNumber(producingCounts.nonProducing)} sub="No Submitted / Paid / Approved" />
            </div>
          </Section>

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
