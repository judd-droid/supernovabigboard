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

    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtD = (iso: string) => iso.replace(/-/g, '/');
    const pct = (n: number) => `${Math.round(n * 100)}%`;

    // --- Build HTML sections ---

    // KPI cards row
    const kpis = `
      <div class="kpi">${esc(formatPeso(data.team.approved.fyc))}<span>FYC</span></div>
      <div class="kpi">${esc(formatPeso(data.team.approved.fyp))}<span>FYP</span></div>
      <div class="kpi">${esc(formatPeso(data.team.approved.anp))}<span>ANP</span></div>
      <div class="kpi">${formatNumber(data.team.approved.caseCount)}<span>Cases</span></div>`;

    // Monitoring
    let monitoringHtml = '';
    if (spaLegFilter === 'Legacy' && data.legacyMonitoring) {
      const d = data.legacyMonitoring;
      const p = d.totalLegacies > 0 ? Math.round(d.activityRatio * 100) : 0;
      const animals = d.achievers.length
        ? d.achievers.map(a => `<li>${esc(a.advisor)} <span class="dim">— ${a.cases} cases</span></li>`).join('')
        : '<li class="dim">None</li>';
      monitoringHtml = `
        <div class="card">
          <div class="card-title">Legacy Monitoring</div>
          <div class="big-stat">${d.producingLegacies}/${d.totalLegacies} <span class="dim">(${p}%)</span></div>
          <div class="sub-label">Activity Ratio</div>
          <hr class="divider">
          <div class="sub-title">Achievers (2+ cases)</div>
          <ul>${animals}</ul>
          <hr class="divider">
          <div class="stat-row"><span>FYC</span><span>${esc(formatPeso(d.totals.approvedFyc))}</span></div>
          <div class="stat-row"><span>Cases</span><span>${d.totals.approvedCases}</span></div>
          <div class="stat-row"><span>Avg/case</span><span>${esc(formatPeso(d.totals.avgFycPerCase))}</span></div>
        </div>`;
    } else if (data.spartanMonitoring) {
      const d = data.spartanMonitoring;
      const p = d.totalSpartans > 0 ? Math.round(d.activityRatio * 100) : 0;
      const animals = d.animals.length
        ? d.animals.map(a => `<li>${esc(a.advisor)} <span class="dim">— ${a.cases} cases</span></li>`).join('')
        : '<li class="dim">None</li>';
      monitoringHtml = `
        <div class="card">
          <div class="card-title">Spartan Monitoring</div>
          <div class="big-stat">${d.producingSpartans}/${d.totalSpartans} <span class="dim">(${p}%)</span></div>
          <div class="sub-label">Activity Ratio</div>
          <hr class="divider">
          <div class="sub-title">ANIMALs (2+ cases)</div>
          <ul>${animals}</ul>
          <hr class="divider">
          <div class="stat-row"><span>FYC</span><span>${esc(formatPeso(d.totals.approvedFyc))}</span></div>
          <div class="stat-row"><span>Cases</span><span>${d.totals.approvedCases}</span></div>
          <div class="stat-row"><span>Avg/case</span><span>${esc(formatPeso(d.totals.avgFycPerCase))}</span></div>
        </div>`;
    }

    // Special Lookouts
    let lookoutsHtml = '';
    if (data.specialLookouts) {
      const ps = data.specialLookouts.productSellers;
      const cmp = data.specialLookouts.consistentMonthlyProducers;
      const asOf = (cmp.asOfMonth ?? '').replace('-', '/');

      const prodList = (label: string, items: typeof ps.aPlusSignature) => {
        if (!items.length) return `<div class="prod-row"><span class="dim">${esc(label)}: None</span></div>`;
        return items.map(i => `<div class="prod-row"><span>${esc(i.advisor)}</span><span class="dim">${esc(formatPeso(i.fyc))}</span></div>`).join('');
      };

      const cmpList = (arr: Array<{ advisor: string; streakMonths: number }>) =>
        arr.length ? arr.map(r => `<li>${esc(r.advisor)} <span class="dim">(${r.streakMonths} mo)</span></li>`).join('') : '<li class="dim">None</li>';

      lookoutsHtml = `
        <div class="card">
          <div class="card-title">Product Lookouts</div>
          <div class="sub-title">A+ Signature</div>${prodList('A+ Signature', ps.aPlusSignature)}
          <hr class="divider">
          <div class="sub-title">Ascend</div>${prodList('Ascend', ps.ascend)}
          <hr class="divider">
          <div class="sub-title">FutureSafe USD 5-Pay</div>${prodList('FutureSafe USD 5-Pay', ps.futureSafeUsd5Pay)}
        </div>
        <div class="card">
          <div class="card-title">CMP <span class="dim">as of ${esc(asOf)}</span></div>
          <div class="sub-title">3+ Months</div><ul>${cmpList(cmp.threePlus)}</ul>
          <hr class="divider">
          <div class="sub-title">2 Months</div><ul>${cmpList(cmp.watch2)}</ul>
          <hr class="divider">
          <div class="sub-title">1 Month</div><ul>${cmpList(cmp.watch1)}</ul>
        </div>`;
    }

    // Advisor Overview
    const producingSet = new Set(filteredProducing.map(a => (a.advisor ?? '').trim().toLowerCase()));
    const advisorRows = (arr: AdvisorStatus[], getAmt: (a: AdvisorStatus) => string, wrap = false) =>
      arr.length ? arr.map(a => {
        const name = (a.advisor ?? '').trim();
        const shown = wrap && producingSet.has(name.toLowerCase()) ? `(${name})` : name;
        return `<div class="prod-row"><span>${esc(shown)}</span><span>${esc(getAmt(a))}</span></div>`;
      }).join('') : '<div class="dim">None</div>';

    const advisorHtml = `
      <div class="card">
        <div class="card-title">Advisor Production</div>
        <div class="badge green">Producing (${filteredProducing.length})</div>
        ${advisorRows(filteredProducing, a => formatPeso(a.approved.fyc))}
        <div class="badge amber">Pending (${filteredPending.length})</div>
        ${advisorRows(filteredPending, a => formatPeso(a.open.fyc), true)}
        <div class="badge red">Non-Producing (${filteredNonProducing.length})</div>
      </div>`;

    // Pending Cases
    let pendingHtml = '';
    if (data.pendingCases && data.pendingCases.length > 0) {
      const rows = data.pendingCases;
      const totalANP = rows.reduce((acc, r) => acc + r.anp, 0);
      const totalFYC = rows.reduce((acc, r) => acc + r.fyc, 0);
      const trs = rows.map(r => `
        <tr>
          <td>${esc(r.advisor)}</td>
          <td>${esc(r.product)}</td>
          <td class="num">${esc(formatPeso(r.anp))}</td>
          <td class="num">${esc(formatPeso(r.fyc))}</td>
          <td>${fmtD(r.datePaid)}</td>
          <td class="num ${r.daysPending >= 30 ? 'urgent' : ''}">${r.daysPending}d</td>
          <td class="remarks">${esc(r.remarks || '—')}</td>
        </tr>`).join('');
      pendingHtml = `
        <div class="card" style="margin-bottom:8px">
          <div class="card-title">Pending Cases
            <span class="dim">${rows.length} cases · ANP ${esc(formatPeso(totalANP))} · FYC ${esc(formatPeso(totalFYC))}</span>
          </div>
          <table>
            <thead><tr><th>Advisor</th><th>Product</th><th class="num">ANP</th><th class="num">FYC</th><th>Paid</th><th class="num">Days</th><th>Remarks</th></tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>`;
    }

    // PPB Tracker
    let ppbHtml = '';
    if (data.ppbTracker) {
      const ppb = data.ppbTracker;
      const ppbRows = spaLegFilter === 'All'
        ? ppb.rows
        : ppb.rows.filter(r => matchesSpaLegFilter(r.spaLeg, spaLegFilter));
      const [pm1, pm2, pm3] = ppb.months;
      const trs = ppbRows.slice(0, 10).map(r => `
        <tr>
          <td>${esc(r.advisor)}</td>
          <td class="num">${esc(formatPeso(r.fyc))}</td>
          <td class="num">${r.cases}</td>
          <td class="num">${r.m1Cases}</td>
          <td class="num">${r.m2Cases}</td>
          <td class="num">${r.m3Cases}</td>
          <td class="num">${r.totalBonusRate > 0 ? pct(r.totalBonusRate) : '—'}</td>
          <td class="num">${r.projectedBonus != null ? esc(formatPeso(r.projectedBonus)) : '—'}</td>
          <td class="num">${r.ppbRate > 0 ? pct(r.ppbRate) : '—'}</td>
          <td class="num">${r.fycToNextBonusTier != null ? esc(formatPeso(r.fycToNextBonusTier)) + (r.nextPpbRate != null ? ' (' + pct(r.nextPpbRate) + ')' : '') : '—'}</td>
          <td class="num">${r.ccbRate != null ? pct(r.ccbRate) : '—'}</td>
          <td class="num">${r.casesToNextCcbTier != null ? '+' + r.casesToNextCcbTier + (r.nextCcbRate != null ? ' (' + pct(r.nextCcbRate) + ')' : '') : '—'}</td>
        </tr>`).join('');
      ppbHtml = `
        <div class="card" style="margin-bottom:8px">
          <div class="card-title">PPB Tracker <span class="dim">${esc(ppb.quarter)}${ppbRows.length > 10 ? ` · Top 10 of ${ppbRows.length}` : ''}</span></div>
          <table>
            <thead><tr><th>Advisor</th><th class="num">FYC</th><th class="num">Cases</th><th class="num">${esc(pm1)}</th><th class="num">${esc(pm2)}</th><th class="num">${esc(pm3)}</th><th class="num">Total %</th><th class="num">Projected</th><th class="num">PPB</th><th class="num">Next Tier</th><th class="num">CCB</th><th class="num">Next CCB</th></tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>`;
    }

    // MEA Badges
    let meaHtml = '';
    if (data.monthlyExcellenceBadges) {
      const mea = data.monthlyExcellenceBadges;
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
      const filterMea = <T extends { spaLeg?: string }>(arr: T[]) => {
        if (spaLegFilter === 'All') return arr;
        const want = spaLegFilter === 'Spartans' ? 'spartan' : 'legacy';
        return arr.filter(r => norm(r.spaLeg) === want);
      };
      const meaCard = (title: string, badge: typeof mea.premiums, isCases: boolean) => {
        const achieved = filterMea(badge.achieved);
        const close = filterMea(badge.close);
        const hitItems = achieved.length
          ? achieved.map(a => `<li>${esc(a.advisor)} <span class="dim">— ${a.tier} (${isCases ? a.value : esc(formatPeso(a.value))})</span></li>`).join('')
          : '<li class="dim">None</li>';
        const closeItems = close.length
          ? close.map(c => `<li>${esc(c.advisor)} <span class="dim">— ${c.targetTier} (+${isCases ? c.remaining : esc(formatPeso(c.remaining))})</span></li>`).join('')
          : '<li class="dim">None</li>';
        return `<div class="card">
          <div class="card-title">${esc(title)}</div>
          <div class="sub-title"><span class="tag hit">Hit</span></div><ul>${hitItems}</ul>
          <div class="sub-title"><span class="tag close">Close</span></div><ul>${closeItems}</ul>
        </div>`;
      };
      meaHtml = meaCard('Premiums (MDRT FYP)', mea.premiums, false)
        + meaCard('Saved Lives (Cases)', mea.savedLives, true)
        + meaCard('Income (FYC)', mea.income, false);
    }

    // Open popup
    const popup = window.open('', '_blank', 'width=900,height=1200,scrollbars=yes,resizable=yes');
    if (!popup) return;

    popup.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>1-Page Summary</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; font-size: 11px; line-height: 1.4; padding: 16px 20px; }
  @page { size: portrait; margin: 8mm; }
  @media print { body { background: #fff; padding: 0; } .save-btn { display: none; } }
  .save-btn { position: fixed; top: 8px; right: 12px; background: #0f172a; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px; cursor: pointer; z-index: 10; }
  .save-btn:hover { background: #334155; }
  @media print { .save-btn { display: none; } }
  .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  .header h1 { font-size: 14px; font-weight: 700; }
  .header .sub { font-size: 11px; color: #64748b; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
  .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 16px; font-weight: 700; text-align: center; }
  .kpi span { display: block; font-size: 9px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
  .wide-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; overflow: hidden; }
  .card.wide { grid-column: 1 / -1; }
  .card-title { font-size: 11px; font-weight: 700; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
  .sub-title { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; margin-top: 4px; margin-bottom: 2px; }
  .sub-label { font-size: 9px; color: #94a3b8; margin-top: -2px; margin-bottom: 4px; }
  .big-stat { font-size: 20px; font-weight: 700; }
  .dim { color: #94a3b8; font-weight: 400; }
  ul { list-style: none; padding: 0; }
  ul li { padding: 1px 0; font-size: 11px; }
  .prod-row { display: flex; justify-content: space-between; gap: 4px; padding: 1px 0; font-size: 11px; }
  .stat-row { display: flex; justify-content: space-between; gap: 4px; padding: 1px 0; font-size: 11px; }
  .badge { display: inline-block; font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-top: 4px; margin-bottom: 2px; }
  .badge.green { background: #dcfce7; color: #166534; }
  .badge.amber { background: #fef3c7; color: #92400e; }
  .badge.red { background: #fee2e2; color: #991b1b; }
  .tag { font-size: 9px; font-weight: 600; padding: 0 4px; border-radius: 3px; white-space: nowrap; }
  .tag.hit { background: #dcfce7; color: #166534; }
  .tag.close { background: #fef3c7; color: #92400e; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; font-weight: 600; color: #64748b; padding: 3px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; }
  td { padding: 2px 6px; border-bottom: 1px solid #f1f5f9; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .urgent { color: #dc2626; font-weight: 600; }
  .remarks { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #64748b; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 4px 0; }
</style>
</head>
<body>
<button class="save-btn" onclick="savePdf()">Save to PDF</button>
<div class="header">
  <h1>Production Report: ${unit === 'All' ? 'Agency' : esc(unit)}</h1>
  <div class="sub">${esc(presetLabel[preset])} · ${esc(fmtDateRange(data.filters.start, data.filters.end))} · ${esc(spaLegFilter)}</div>
</div>
<div class="kpi-row">${kpis}</div>
<div class="grid">${monitoringHtml}${lookoutsHtml}${advisorHtml}</div>
${pendingHtml}
${ppbHtml}
<div class="grid-3">${meaHtml}</div>
</body>
<script>
function savePdf() {
  const unitName = '${unit === 'All' ? 'Agency' : esc(unit)}';
  const endDate = '${esc(data.filters.end)}';
  document.title = 'Production Summary - ' + unitName + ' - ' + endDate;
  window.print();
}
</script>
</html>`);
    popup.document.close();
  }, [data, preset, spaLegFilter, filteredProducing, filteredPending, filteredNonProducing]);

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
