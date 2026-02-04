'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { TrendingUp, CheckCircle2, Clock3, Users } from 'lucide-react';

import type { ApiResponse, RangePreset } from '@/lib/types';
import { formatPeso, formatNumber, fmtDateRange } from '@/lib/format';

import { KpiCard } from '@/components/KpiCard';
import { Section } from '@/components/Section';
import { Field, Select, DateInput } from '@/components/Field';
import { AdvisorStatusPanel } from '@/components/AdvisorStatusPanel';
import { TrendChart } from '@/components/TrendChart';
import { Leaderboard } from '@/components/Leaderboard';
import { ProductMix } from '@/components/ProductMix';
import { SpartanMonitoringRow } from '@/components/SpartanMonitoringRow';
import { SpecialLookoutsRow } from '@/components/SpecialLookoutsRow';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
  return res.json() as Promise<ApiResponse>;
};

const presetLabel: Record<RangePreset, string> = {
  MTD: 'Month-to-date',
  QTD: 'Quarter-to-date',
  YTD: 'Year-to-date',
  CUSTOM: 'Custom',
};

function buildUrl({ preset, unit, advisor, start, end }: { preset: RangePreset; unit: string; advisor: string; start?: string; end?: string; }) {
  const p = new URLSearchParams();
  p.set('preset', preset);
  p.set('unit', unit);
  p.set('advisor', advisor);
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

  const effectiveAdvisor = tab === 'advisor' ? advisor : 'All';

  const url = useMemo(() => buildUrl({
    preset,
    unit,
    advisor: effectiveAdvisor,
    start: customStart,
    end: customEnd,
  }), [preset, unit, effectiveAdvisor, customStart, customEnd]);

  const { data, error, isLoading } = useSWR(url, fetcher, { revalidateOnFocus: false });

  const options = data?.options;
  const producingCounts = data ? {
    producing: data.producingAdvisors.producing.length,
    pending: data.producingAdvisors.pending.length,
    nonProducing: data.producingAdvisors.nonProducing.length,
  } : { producing: 0, pending: 0, nonProducing: 0 };

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
                options={['MTD', 'QTD', 'YTD', 'CUSTOM']}
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
          <Section title="Approved performance">
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard title="Approved FYC" value={formatPeso(data.team.approved.fyc)} icon={<CheckCircle2 size={18} />} />
              <KpiCard title="Approved FYP" value={formatPeso(data.team.approved.fyp)} icon={<TrendingUp size={18} />} />
              <KpiCard title="Approved ANP" value={formatPeso(data.team.approved.anp)} />
              <KpiCard title="Approved cases" value={formatNumber(data.team.approved.caseCount)} icon={<Users size={18} />} />
            </div>
          </Section>

          <Section title="Pipeline signals">
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard title="Submitted FYP" value={formatPeso(data.team.submitted.fyp)} icon={<Clock3 size={18} />} />
              <KpiCard title="Paid FYP" value={formatPeso(data.team.paid.fyp)} />
              <KpiCard title="Advisors with pending cases" value={formatNumber(producingCounts.pending)} sub="(Name) means already producing" />
              <KpiCard title="Non-producing advisors" value={formatNumber(producingCounts.nonProducing)} sub="No Submitted / Paid / Approved" />
            </div>
          </Section>

          {tab === 'team' && data.spartanMonitoring ? (
            <Section title="Spartan monitoring">
              <SpartanMonitoringRow data={data.spartanMonitoring} />
            </Section>
          ) : null}

          {tab === 'team' && data.specialLookouts ? (
            <Section title="Special lookouts">
              <SpecialLookoutsRow
                productSellers={data.specialLookouts.productSellers}
                consistentMonthlyProducers={data.specialLookouts.consistentMonthlyProducers}
              />
            </Section>
          ) : null}

          <Section title="Advisor production overview">
            <AdvisorStatusPanel
              producing={data.producingAdvisors.producing}
              pending={data.producingAdvisors.pending}
              nonProducing={data.producingAdvisors.nonProducing}
            />
          </Section>

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
              <div className="hidden lg:block" />
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
