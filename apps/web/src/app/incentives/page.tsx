'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Download, ExternalLink, FileSpreadsheet, FlaskConical, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { api, MonthlyMapping } from '@/lib/api';
import { money, percent } from '@/lib/utils';
import { IncentiveRuleManager } from './incentive-rule-manager';

type RowType = 'AGENT' | 'TEAM_LEAD';
type WeeklyAmounts = { target: number | null; m2Target: number | null; eligibleRevenue: number | null; achievement: number | null; incentiveAmount: number | null; bonus: number | null; incentive: number | null; teamIncentive: number | null };
type MonthAmounts = { m2Target: number; target: number; revenue: number; achievement: number; qualifiedWeeks: number; bonus: number; incentive: number; teamIncentive: number; totalPayout: number };
type IncentiveRow = { id: string; rowType: RowType; executiveId: string; executiveName: string; employeeId: string; email: string; manager: string; teamLead: string; source: string; tenurity: string; weeks: Record<string, WeeklyAmounts>; monthTotal: MonthAmounts; calculationVersion: number };
type IncentiveReport = { month: string; weeks: string[]; rows: IncentiveRow[]; teamLeadRows?: IncentiveRow[]; calculationVersion: number; ruleVersion?: string };
type LegacyRow = { id: string; executiveId: string; executiveName: string; manager?: string; target: number; eligibleRevenue: number; achievement: number; bonus: number; incentive: number; calculationVersion: number };

const currentMonth = new Date().toISOString().slice(0, 7);
const weeklyMetrics = ['Target', 'Achieved', 'Achievement %', 'Agent incentive', 'TL contribution'];
const emptyWeek: WeeklyAmounts = { target: null, m2Target: null, eligibleRevenue: null, achievement: null, incentiveAmount: null, bonus: null, incentive: null, teamIncentive: null };
const emptyMonth: MonthAmounts = { m2Target: 0, target: 0, revenue: 0, achievement: 0, qualifiedWeeks: 0, bonus: 0, incentive: 0, teamIncentive: 0, totalPayout: 0 };
const agentIncentiveSlabs = [{ threshold: 0.7, amount: 1500 }, { threshold: 0.8, amount: 2000 }, { threshold: 0.9, amount: 2700 }, { threshold: 1, amount: 3500 }, { threshold: 1.1, amount: 4000 }];

function baseIncentiveAmount(achievement: number) { return agentIncentiveSlabs.reduce((earned, slab) => achievement >= slab.threshold ? slab.amount : earned, 0); }
function teamIncentiveAmount(achievement: number) { if (achievement < 0.8) return 0; if (achievement < 0.9) return 250; if (achievement < 1) return 300; return 350; }
function teamLeadBaseAmount(achievement: number) { if (achievement < 0.7) return 0; if (achievement < 0.8) return 1500; if (achievement < 0.9) return 2000; if (achievement < 1) return 2700; return 3500; }
function teamLeadBonus(qualifiedWeeks: number) { if (qualifiedWeeks >= 4) return 7500; if (qualifiedWeeks === 3) return 5000; return 0; }
function achievementBonus(qualifiedWeeks: number, monthWeeks: number) { if (monthWeeks === 4) { if (qualifiedWeeks >= 4) return 7500; if (qualifiedWeeks === 3) return 5000; return 0; } if (qualifiedWeeks >= 5) return 9000; if (qualifiedWeeks === 4) return 6000; if (qualifiedWeeks === 3) return 3000; return 0; }

function normalizeAgent(row: IncentiveRow): IncentiveRow {
  const monthTotal = { ...emptyMonth, ...row.monthTotal };
  return { ...row, rowType: 'AGENT', teamLead: row.teamLead || row.manager || '', monthTotal: { ...monthTotal, totalPayout: (Number(monthTotal.incentive) || 0) + (Number(monthTotal.bonus) || 0) } };
}

function normalizeReport(value: IncentiveReport | LegacyRow[], month: string): IncentiveReport {
  if (Array.isArray(value)) {
    const latestVersion = value.reduce((maximum, row) => Math.max(maximum, Number(row.calculationVersion) || 0), 0);
    const rows = value.filter((row) => Number(row.calculationVersion) === latestVersion).map((row) => normalizeAgent({ id: row.id, rowType: 'AGENT', executiveId: row.executiveId, executiveName: row.executiveName, employeeId: '', email: '', manager: row.manager ?? '', teamLead: row.manager ?? '', source: '', tenurity: '', weeks: {}, monthTotal: { ...emptyMonth, target: Number(row.target) || 0, revenue: Number(row.eligibleRevenue) || 0, achievement: Number(row.achievement) || 0, bonus: Number(row.bonus) || 0, incentive: Number(row.incentive) || 0 }, calculationVersion: Number(row.calculationVersion) || 0 }));
    return { month, weeks: [], calculationVersion: latestVersion, rows };
  }
  const rows = Array.isArray(value?.rows) ? value.rows.filter((row) => row.rowType !== 'TEAM_LEAD').map(normalizeAgent) : [];
  const teamLeadRows = Array.isArray(value?.teamLeadRows) ? value.teamLeadRows.map((row) => ({ ...row, rowType: 'TEAM_LEAD' as const, teamLead: row.teamLead || row.manager || row.executiveName })) : undefined;
  return { month: value?.month || month, weeks: Array.isArray(value?.weeks) ? value.weeks : [], rows, teamLeadRows, calculationVersion: Number(value?.calculationVersion) || 0, ruleVersion: value?.ruleVersion };
}

function recalculateAgent(row: IncentiveRow): IncentiveRow {
  const fallbackM2Target = Number(row.monthTotal.m2Target) || Object.values(row.weeks).reduce((maximum, week) => Math.max(maximum, Number(week.m2Target) || 0), 0);
  let monthlyTarget = 0; let monthlyRevenue = 0; let qualifiedWeeks = 0; let weeklyIncentive = 0; let teamIncentive = 0; let monthM2Target = 0;
  const weeks = Object.fromEntries(Object.entries(row.weeks).map(([weekStart, item]) => {
    if (item.target === null || item.eligibleRevenue === null) return [weekStart, { ...emptyWeek }];
    const target = Number(item.target) || 0; const revenue = Number(item.eligibleRevenue) || 0; const m2Target = Number(item.m2Target) || fallbackM2Target;
    const achievement = target > 0 ? revenue / target : 0; const incentiveAmount = baseIncentiveAmount(achievement);
    const incentive = incentiveAmount; const team = teamIncentiveAmount(achievement);
    monthM2Target = Math.max(monthM2Target, m2Target); monthlyTarget += target; monthlyRevenue += revenue; weeklyIncentive += incentive; teamIncentive += team;
    if (target > 0 && achievement >= 0.8) qualifiedWeeks += 1;
    return [weekStart, { target, m2Target, eligibleRevenue: revenue, achievement, incentiveAmount, bonus: 0, incentive, teamIncentive: team }];
  }));
  const bonus = achievementBonus(qualifiedWeeks, Object.keys(weeks).length);
  return normalizeAgent({ ...row, weeks, monthTotal: { m2Target: monthM2Target || fallbackM2Target, target: monthlyTarget, revenue: monthlyRevenue, achievement: monthlyTarget > 0 ? monthlyRevenue / monthlyTarget : 0, qualifiedWeeks, bonus, incentive: weeklyIncentive, teamIncentive, totalPayout: weeklyIncentive + bonus } });
}

function buildTeamLeadRows(agentRows: IncentiveRow[], weeks: string[], calculationVersion: number): IncentiveRow[] {
  const groups = new Map<string, { manager: string; agents: IncentiveRow[] }>();
  agentRows.forEach((row) => {
    const manager = (row.teamLead || row.manager || '').trim();
    if (!manager) return;
    const key = manager.toLowerCase();
    const group = groups.get(key) ?? { manager, agents: [] }; group.agents.push(row); groups.set(key, group);
  });
  return Array.from(groups.entries()).map(([key, group]): IncentiveRow => {
    let monthTarget = 0; let monthRevenue = 0; let monthM2Target = 0; let teamIncentive = 0; let baseIncentive = 0; let qualifiedWeeks = 0;
    const weeklyValues = Object.fromEntries(weeks.map((week) => {
      const values = group.agents.map((agent) => agent.weeks[week] ?? emptyWeek).filter((item) => item.target !== null && item.eligibleRevenue !== null);
      if (!values.length) return [week, { ...emptyWeek }];
      const target = values.reduce((sum, item) => sum + (Number(item.target) || 0), 0); const revenue = values.reduce((sum, item) => sum + (Number(item.eligibleRevenue) || 0), 0);
      const m2Target = values.reduce((sum, item) => sum + (Number(item.m2Target) || 0), 0); const tlPayout = values.reduce((sum, item) => sum + (Number(item.teamIncentive) || 0), 0); const achievement = target > 0 ? revenue / target : 0; const weeklyBase = teamLeadBaseAmount(achievement);
      monthTarget += target; monthRevenue += revenue; monthM2Target = Math.max(monthM2Target, m2Target); teamIncentive += tlPayout; baseIncentive += weeklyBase; if (target > 0 && achievement >= 0.8) qualifiedWeeks += 1;
      return [week, { ...emptyWeek, target, m2Target, eligibleRevenue: revenue, achievement, incentiveAmount: weeklyBase, incentive: weeklyBase, teamIncentive: tlPayout }];
    }));
    const bonus = teamLeadBonus(qualifiedWeeks);
    return { id: `team-lead:${key}`, rowType: 'TEAM_LEAD', executiveId: '', executiveName: group.manager, employeeId: '', email: '', manager: group.manager, teamLead: group.manager, source: '', tenurity: '', weeks: weeklyValues, monthTotal: { ...emptyMonth, m2Target: monthM2Target, target: monthTarget, revenue: monthRevenue, achievement: monthTarget > 0 ? monthRevenue / monthTarget : 0, qualifiedWeeks, bonus, incentive: baseIncentive, teamIncentive, totalPayout: baseIncentive + teamIncentive + bonus }, calculationVersion };
  }).sort((left, right) => left.executiveName.localeCompare(right.executiveName));
}

function sampleReport(): IncentiveReport {
  const weeks = ['2026-06-29', '2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'];
  const makeRow = (id: string, identity: Pick<IncentiveRow, 'executiveName' | 'employeeId' | 'email' | 'manager' | 'source' | 'tenurity'>, m2Target: number, target: number, revenues: number[]): IncentiveRow => recalculateAgent({ id, rowType: 'AGENT', executiveId: id, ...identity, teamLead: identity.manager, weeks: Object.fromEntries(weeks.map((week, index) => [week, { ...emptyWeek, target, m2Target, eligibleRevenue: revenues[index] ?? 0 }])), monthTotal: { ...emptyMonth, m2Target }, calculationVersion: 1 });
  return { month: '2026-07', weeks, calculationVersion: 1, ruleVersion: 'LOCAL_TEST_WEEKLY_TEAM_V1', rows: [
    makeRow('sample-1', { executiveName: 'Five-week bonus example', employeeId: 'TEST001', email: 'five.week@example.com', manager: 'Test Manager', source: 'Experimental', tenurity: 'M1+' }, 75000, 75000, [83254, 98491, 62000, 80000, 90000]),
    makeRow('sample-2', { executiveName: 'Floor slab example', employeeId: 'TEST002', email: 'floor.slab@example.com', manager: 'Test Manager', source: 'META', tenurity: 'M1' }, 106250, 68750, [175696, 7600, 98972, 60000, 0]),
  ] };
}

function csvCell(value: unknown) { const text = value === null || value === undefined ? '' : String(value); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }
function display(value: number | null, format: (number: number) => string) { return value === null ? '—' : format(Number(value)); }

export default function Page() {
  const auth = useAuth(); const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth); const [search, setSearch] = useState('');
  const [section, setSection] = useState<'CALCULATIONS' | 'RULES'>('CALCULATIONS');
  const [localPreview, setLocalPreview] = useState<IncentiveReport | null>(null);
  const [exported, setExported] = useState<{ url: string; title: string; rowCount: number } | null>(null);
  const report = useQuery({ queryKey: ['incentives', month], enabled: Boolean(auth.session), queryFn: async () => normalizeReport(await api<IncentiveReport | LegacyRow[]>(`/incentives?month=${month}`), month) });
  const mappings = useQuery({ queryKey: ['monthly-mappings', month], enabled: Boolean(auth.session), queryFn: () => api<MonthlyMapping[]>(`/monthly-mappings?month=${month}`) });
  const calculate = useMutation({ mutationFn: () => api(`/incentives/calculate?month=${month}`, { method: 'POST' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incentives', month] }) });
  const exportSheet = useMutation({ mutationFn: () => api<{ url: string; title: string; rowCount: number }>(`/incentives/export?month=${month}`, { method: 'POST' }), onSuccess: setExported });
  const activeReport = useMemo(() => {
    const base = localPreview ?? report.data; if (!base) return undefined;
    const mappingByExecutive = new Map((mappings.data ?? []).map((mapping) => [mapping._id, mapping]));
    const agents = base.rows.filter((row) => row.rowType !== 'TEAM_LEAD').map((row) => {
      const calculated = localPreview ? recalculateAgent(row) : normalizeAgent(row); const mapping = mappingByExecutive.get(row.executiveId);
      if (!mapping) return calculated;
      return normalizeAgent({ ...calculated, employeeId: mapping.employeeId || calculated.employeeId, executiveName: mapping.name || calculated.executiveName, email: mapping.email || calculated.email, manager: mapping.manager || calculated.manager, teamLead: mapping.manager || calculated.teamLead, source: mapping.source || calculated.source, tenurity: mapping.tenurity || calculated.tenurity });
    });
    const teamLeadRows = localPreview || !base.teamLeadRows?.length ? buildTeamLeadRows(agents, base.weeks, base.calculationVersion) : base.teamLeadRows;
    return { ...base, rows: agents, teamLeadRows };
  }, [localPreview, mappings.data, report.data]);
  const allRows = [...(activeReport?.rows ?? []), ...(activeReport?.teamLeadRows ?? [])].sort((left, right) => {
    const leftKey = `${left.teamLead || left.manager}\u0000${left.source}\u0000${left.rowType === 'TEAM_LEAD' ? '1' : '0'}\u0000${left.email || left.executiveName}`.toLowerCase();
    const rightKey = `${right.teamLead || right.manager}\u0000${right.source}\u0000${right.rowType === 'TEAM_LEAD' ? '1' : '0'}\u0000${right.email || right.executiveName}`.toLowerCase();
    return leftKey.localeCompare(rightKey);
  });
  const rows = allRows.filter((row) => `${row.rowType} ${row.executiveName} ${row.employeeId} ${row.email} ${row.teamLead} ${row.source}`.toLowerCase().includes(search.toLowerCase()));
  const missingTeamLeads = (activeReport?.rows ?? []).filter((row) => !row.teamLead).length;

  function startPreview() { setLocalPreview(report.data?.rows.length ? report.data : sampleReport()); setExported(null); }
  function loadSample() { const sample = sampleReport(); setMonth(sample.month); setLocalPreview(sample); setExported(null); }
  function stopPreview() { setLocalPreview(null); setExported(null); }

  function downloadCsv() {
    const data = activeReport; if (!data || !allRows.length) return;
    const headers = ['Level', 'Team', 'Team Lead', 'EMP ID', 'Agent Name', 'Agent Email', 'Source M1+ Target', 'Monthly Target', ...data.weeks.flatMap((week, index) => weeklyMetrics.map((metric) => `Week ${index + 1} ${metric} (${week})`)), 'Monthly Achieved', 'Monthly Achievement %', '80%+ Weeks', 'Achievement Bonus', 'Agent Incentive', 'TL Incentive', 'Total Payout', 'Version'];
    const csvRows = allRows.map((row) => [row.rowType === 'TEAM_LEAD' ? 'Team lead' : 'Agent', row.source, row.teamLead, row.employeeId, row.executiveName, row.rowType === 'AGENT' ? row.email : '', row.monthTotal.m2Target, row.monthTotal.target, ...data.weeks.flatMap((week) => { const item = row.weeks[week] ?? emptyWeek; return [item.target, item.eligibleRevenue, item.achievement, item.incentive, item.teamIncentive]; }), row.monthTotal.revenue, row.monthTotal.achievement, row.monthTotal.qualifiedWeeks, row.monthTotal.bonus, row.monthTotal.incentive, row.monthTotal.teamIncentive, row.monthTotal.totalPayout, row.calculationVersion]);
    const blob = new Blob([[headers, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `ib-incentives-${data.month}-v${data.calculationVersion}${localPreview ? '-local-preview' : ''}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">Incentive engine</h2><p className="text-slate-500">{section === 'CALCULATIONS' ? 'Agent payouts and manager-level team-lead payouts, grouped by the agent’s mapped monthly Source.' : 'Versioned Agent and Team Lead achievement slabs with effective-date control.'}</p></div>{section === 'CALCULATIONS' && <div className="flex flex-wrap items-center gap-2"><label className="text-sm font-medium">Month <input type="month" className="ml-2" value={month} onChange={(event) => { setMonth(event.target.value); stopPreview(); }} /></label><button className="btn-secondary gap-2" disabled={!allRows.length} onClick={downloadCsv}><Download size={16} />Download CSV</button><button className="btn-secondary gap-2" disabled={Boolean(localPreview) || !report.data?.rows.length || exportSheet.isPending} onClick={() => exportSheet.mutate()}><FileSpreadsheet size={16} />{exportSheet.isPending ? 'Exporting…' : 'Export Google Sheet'}</button>{auth.canWrite && <button className="btn" disabled={Boolean(localPreview) || calculate.isPending} onClick={() => calculate.mutate()}>{calculate.isPending ? 'Calculating…' : `Calculate ${month}`}</button>}</div>}</div>

    <div role="tablist" aria-label="Incentive engine sections" className="mb-5 flex w-fit gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"><button type="button" role="tab" aria-selected={section === 'CALCULATIONS'} onClick={() => setSection('CALCULATIONS')} className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${section === 'CALCULATIONS' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Calculator size={16} />Calculations</button><button type="button" role="tab" aria-selected={section === 'RULES'} onClick={() => setSection('RULES')} className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${section === 'RULES' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><SlidersHorizontal size={16} />Slab rules</button></div>

    {section === 'CALCULATIONS' ? <>
    <section className="mb-5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><FlaskConical size={18} className="text-indigo-700" /><h3 className="font-semibold text-indigo-950">Local rule preview</h3></div><p className="mt-1 max-w-3xl text-sm text-indigo-900/75">Agent incentives use the exact value at the highest completed slab. There is no interpolation or Target ÷ M1+ Target scaling. Monthly Agent Incentive is the sum of weekly awards; Bonus is added separately in Total Payout.</p></div><div className="flex gap-2">{localPreview ? <button className="btn-secondary" onClick={stopPreview}>Exit preview</button> : <button className="btn-secondary" onClick={startPreview}>Preview new rules</button>}<button className="btn-secondary" onClick={loadSample}>Load five-week sample</button></div></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><div className="rounded-lg bg-white/80 p-3"><b>Agent slabs · effective 2026-07-01</b><p className="mt-1 text-slate-600">70% ₹1,500 · 80% ₹2,000 · 90% ₹2,700 · 100% ₹3,500 · 110% ₹4,000. A result above 110% remains at ₹4,000 until a higher slab is configured.</p></div><div className="rounded-lg bg-white/80 p-3"><b>TL contribution per agent/week</b><p className="mt-1 text-slate-600">80–&lt;90% ₹250 · 90–&lt;100% ₹300 · 100%+ ₹350. The Team column remains the agent’s mapped Source.</p></div><div className="rounded-lg bg-white/80 p-3"><b>80%+ week bonus</b><p className="mt-1 text-slate-600">Four-week month: 3 ₹5,000 · 4 ₹7,500. Five-week month: 3 ₹3,000 · 4 ₹6,000 · 5 ₹9,000.</p></div></div></section>

    {localPreview && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Local test mode:</b> no backend records will be created. Source M1+ targets are read-only; production Calculate and Google Sheet export remain disabled.</p>}
    {missingTeamLeads > 0 && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>{missingTeamLeads} agent{missingTeamLeads === 1 ? '' : 's'} missing a Team Lead.</b> Their TL contribution remains visible on the agent row but is not assigned to a team-lead summary row.</p>}
    {calculate.error && <p className="mb-4 text-red-700">{calculate.error.message}</p>}{report.error && !localPreview && <p className="mb-4 text-red-700">{report.error.message}</p>}{exportSheet.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{exportSheet.error.message}</p>}
    {exported && <p className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Created {exported.title} with {exported.rowCount} rows. <a className="inline-flex items-center gap-1 font-semibold underline" href={exported.url} target="_blank" rel="noreferrer">Open Google Sheet <ExternalLink size={14} /></a></p>}

    <div className="card overflow-hidden p-0"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><label className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input className="w-80 pl-9 pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agent, team or team lead" aria-label="Search incentives" />{search && <button type="button" aria-label="Clear incentive search" className="absolute right-2 top-2 cursor-pointer rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setSearch('')}><X size={15} /></button>}</label><p className="text-sm text-slate-500">{activeReport?.rows.length ?? 0} agents · {activeReport?.teamLeadRows?.length ?? 0} team-lead rows · {localPreview ? 'Local preview' : `Version ${report.data?.calculationVersion || 'not calculated'}`}</p></div>
      <div className="max-h-[68vh] overflow-auto"><table className="min-w-max text-xs"><caption className="sr-only">Monthly agent and team-lead incentive calculations</caption><thead className="sticky top-0 z-40"><tr><th rowSpan={2} className="sticky left-0 z-50 min-w-36 bg-slate-100">Team</th><th rowSpan={2} className="min-w-44">Team Lead</th><th rowSpan={2} className="min-w-28">EMP ID</th><th rowSpan={2} className="sticky left-36 z-50 min-w-52 border-r bg-slate-100">Agent name &amp; email</th><th rowSpan={2} className="min-w-32">Source M1+ target</th><th rowSpan={2} className="min-w-32">Monthly target</th>{(activeReport?.weeks ?? []).map((week, index) => <th key={week} colSpan={5} className="border-l border-slate-300 text-center">Week {index + 1}<span className="ml-1 font-normal text-slate-500">({week})</span></th>)}<th colSpan={7} className="border-l-2 border-indigo-300 bg-indigo-50 text-center text-indigo-950">Month summary</th><th rowSpan={2}>Version</th></tr><tr>{(activeReport?.weeks ?? []).flatMap((week) => weeklyMetrics.map((metric) => <th key={`${week}-${metric}`} className="border-l first:border-l-slate-300">{metric}</th>))}{['Achieved', 'Achievement %', '80%+ weeks', 'Bonus', 'Agent incentive', 'TL incentive', 'Total payout'].map((metric) => <th key={`month-${metric}`} className="border-l bg-indigo-50 first:border-l-2 first:border-indigo-300">{metric}</th>)}</tr></thead>
        <tbody>{rows.map((row) => { const isTeamLead = row.rowType === 'TEAM_LEAD'; return <tr key={row.id} className={isTeamLead ? 'bg-indigo-50/70' : undefined}><td className={`sticky left-0 z-20 font-semibold ${isTeamLead ? 'bg-indigo-50' : 'bg-white'}`}>{row.source || '—'}</td><td>{row.teamLead || '—'}</td><td className="font-mono font-semibold text-blue-700">{row.employeeId || '—'}</td><td className={`sticky left-36 z-20 border-r ${isTeamLead ? 'bg-indigo-50' : 'bg-white'}`}><b>{row.executiveName || '—'}</b>{isTeamLead ? <span className="mt-1 block w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800">Team lead summary</span> : <span className="block text-[11px] text-slate-500">{row.email || 'Email unavailable'}</span>}</td><td>{money(row.monthTotal.m2Target)}</td><td>{money(row.monthTotal.target)}</td>{(activeReport?.weeks ?? []).flatMap((week) => { const item = row.weeks[week] ?? emptyWeek; return [<td key={`${week}-target`}>{display(item.target, money)}</td>, <td key={`${week}-revenue`}>{display(item.eligibleRevenue, money)}</td>, <td key={`${week}-achievement`}>{display(item.achievement, percent)}</td>, <td key={`${week}-incentive`} className="font-semibold text-indigo-700">{display(item.incentive, money)}</td>, <td key={`${week}-team`}>{display(item.teamIncentive, money)}</td>]; })}<td>{money(row.monthTotal.revenue)}</td><td>{percent(row.monthTotal.achievement)}</td><td className="text-center font-semibold">{row.monthTotal.qualifiedWeeks}</td><td className="font-semibold text-amber-700">{money(row.monthTotal.bonus)}</td><td className="font-semibold text-indigo-700">{money(row.monthTotal.incentive)}</td><td className={isTeamLead ? 'font-bold text-indigo-800' : undefined}>{money(row.monthTotal.teamIncentive)}</td><td className="font-bold text-emerald-700">{money(row.monthTotal.totalPayout)}</td><td>{row.calculationVersion}</td></tr>; })}</tbody></table>
        {!report.isLoading && !rows.length && <p className="p-8 text-center text-slate-500">No incentive calculation found for {month}. Use “Load five-week sample” to test the rules without writing data.</p>}{report.isLoading && !localPreview && <p className="p-8 text-center text-slate-500">Loading incentive report…</p>}</div></div>
    <p className="mt-3 text-xs text-slate-500">Team is the Source stored on the agent’s monthly mapping. Source M1+ target remains visible as a reference but does not scale the Agent slab award. Agent Total payout excludes TL contribution; TL payouts appear once on the separate team-lead summary rows.</p>
    </> : <IncentiveRuleManager />}
  </>;
}
