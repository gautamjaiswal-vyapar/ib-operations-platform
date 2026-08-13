'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { money, percent } from '@/lib/utils';

type Amounts = { target: number; revenue: number; achievement: number; bonus: number; incentive: number };
type WeeklyAmounts = { target: number; eligibleRevenue: number; achievement: number; bonus: number; incentive: number };
type IncentiveRow = { id: string; executiveId: string; executiveName: string; manager: string; weeks: Record<string, WeeklyAmounts>; monthTotal: Amounts; calculationVersion: number };
type IncentiveReport = { month: string; weeks: string[]; rows: IncentiveRow[]; calculationVersion: number };
type LegacyRow = { id: string; executiveId: string; executiveName: string; manager?: string; target: number; eligibleRevenue: number; achievement: number; bonus: number; incentive: number; calculationVersion: number };

const currentMonth = new Date().toISOString().slice(0, 7);
const metrics = ['Target', 'Revenue', 'Achievement', 'Bonus', 'Incentive'];
const zeroWeek: WeeklyAmounts = { target: 0, eligibleRevenue: 0, achievement: 0, bonus: 0, incentive: 0 };

function normalizeReport(value: IncentiveReport | LegacyRow[], month: string): IncentiveReport {
  if (Array.isArray(value)) {
    const latestVersion = value.reduce((maximum, row) => Math.max(maximum, Number(row.calculationVersion) || 0), 0);
    const latestRows = value.filter((row) => Number(row.calculationVersion) === latestVersion);
    return { month, weeks: [], calculationVersion: latestVersion, rows: latestRows.map((row) => ({ id: row.id, executiveId: row.executiveId, executiveName: row.executiveName, manager: row.manager ?? '', weeks: {}, monthTotal: { target: Number(row.target) || 0, revenue: Number(row.eligibleRevenue) || 0, achievement: Number(row.achievement) || 0, bonus: Number(row.bonus) || 0, incentive: Number(row.incentive) || 0 }, calculationVersion: Number(row.calculationVersion) || 0 })) };
  }
  return { month: value?.month || month, weeks: Array.isArray(value?.weeks) ? value.weeks : [], rows: Array.isArray(value?.rows) ? value.rows : [], calculationVersion: Number(value?.calculationVersion) || 0 };
}

function AmountCells({ values }: { values: Amounts | WeeklyAmounts }) {
  const revenue = 'revenue' in values ? values.revenue : values.eligibleRevenue;
  return <><td>{money(Number(values.target))}</td><td>{money(Number(revenue))}</td><td>{percent(Number(values.achievement))}</td><td>{money(Number(values.bonus))}</td><td>{money(Number(values.incentive))}</td></>;
}

export default function Page() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState('');
  const report = useQuery({ queryKey: ['incentives', month], queryFn: async () => normalizeReport(await api<IncentiveReport | LegacyRow[]>(`/incentives?month=${month}`), month) });
  const calculate = useMutation({ mutationFn: () => api(`/incentives/calculate?month=${month}`, { method: 'POST' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incentives', month] }) });
  const rows = (report.data?.rows ?? []).filter((row) => `${row.executiveName} ${row.manager}`.toLowerCase().includes(search.toLowerCase()));

  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">Incentive engine</h2><p className="text-slate-500">Week-pivoted calculations with monthly totals stored as immutable calculation versions.</p></div><div className="flex items-center gap-3"><label className="text-sm font-medium">Month <input type="month" className="ml-2" value={month} onChange={(event) => setMonth(event.target.value)} /></label>{auth.canWrite && <button className="btn" disabled={calculate.isPending} onClick={() => calculate.mutate()}>{calculate.isPending ? 'Calculating…' : `Calculate ${month}`}</button>}</div></div>
    {calculate.error && <p className="mb-4 text-red-700">{calculate.error.message}</p>}
    {report.error && <p className="mb-4 text-red-700">{report.error.message}</p>}
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search executive or manager…" aria-label="Search incentives" /><p className="text-sm text-slate-500">Calculation version: {report.data?.calculationVersion || 'Not calculated'}</p></div>
      <div className="overflow-auto">
        <table className="min-w-max text-sm">
          <thead>
            <tr><th rowSpan={2} className="sticky left-0 z-30 min-w-48 bg-slate-100">Executive</th><th rowSpan={2} className="sticky left-48 z-30 min-w-40 bg-slate-100">Manager</th>{(report.data?.weeks ?? []).map((week, index) => <th key={week} colSpan={5} className="border-l border-slate-300 text-center">Week {index + 1}<span className="ml-1 font-normal text-slate-500">({week})</span></th>)}<th colSpan={5} className="border-l-2 border-blue-300 bg-blue-50 text-center text-blue-950">Month total</th><th rowSpan={2}>Version</th></tr>
            <tr>{(report.data?.weeks ?? []).flatMap((week) => metrics.map((metric) => <th key={`${week}-${metric}`} className="border-l first:border-l-slate-300">{metric}</th>))}{metrics.map((metric) => <th key={`month-${metric}`} className="border-l bg-blue-50 first:border-l-2 first:border-blue-300">{metric}</th>)}</tr>
          </thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td className="sticky left-0 z-10 bg-white font-semibold">{row.executiveName}</td><td className="sticky left-48 z-10 bg-white">{row.manager}</td>{(report.data?.weeks ?? []).map((week) => <AmountCells key={week} values={row.weeks[week] ?? zeroWeek} />)}<AmountCells values={row.monthTotal} /><td>{row.calculationVersion}</td></tr>)}</tbody>
        </table>
        {!report.isLoading && !rows.length && <p className="p-8 text-center text-slate-500">No incentive calculation found for {month}.</p>}
        {report.isLoading && <p className="p-8 text-center text-slate-500">Loading incentive report…</p>}
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-500">Monthly Target, Revenue, Bonus, and Incentive are sums of weekly values. Monthly Achievement is monthly Revenue divided by monthly Target.</p>
  </>;
}
