'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Check, CheckCircle2, Clipboard, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { DataTable } from '@/components/data-table';
import { api, Target, TargetInput } from '@/lib/api';
import { parsePaste } from '@/lib/paste-parser';
import { money } from '@/lib/utils';

const column = createColumnHelper<Target>();
const columns = [
  column.accessor('source', { header: 'Source' }),
  column.accessor('tenurity', { header: 'Tenurity' }),
  column.accessor('version', { header: 'Version' }),
  column.accessor('effectiveFrom', { header: 'Effective from' }),
  column.accessor('effectiveTo', { header: 'Effective till', cell: (value) => value.getValue() ?? 'Current' }),
  column.accessor('revenue', { header: 'Revenue', cell: (value) => money(value.getValue()) }),
  column.accessor('login', { header: 'Login' }),
  column.accessor('demo', { header: 'Demo' }),
  column.accessor('license', { header: 'License' }),
  column.accessor('status', { header: 'Status' }),
];
const blank: TargetInput = { source: '', tenurity: 'M0', effectiveFrom: new Date().toISOString().slice(0, 10), revenue: 0, login: 0, demo: 0, license: 0, proPlatform: 0, arpl: 0 };
const targetTemplate = 'Source\tTenurity\tEffective From\tRevenue\tLogin\tDemo\tLicense\tPro Platform\tARPL\nInbound\tM0\t2026-09-01\t100000\t20\t12\t5\t3\t5000';
const aliases: Record<keyof TargetInput, string[]> = { source: ['Source'], tenurity: ['Tenurity', 'Tenure'], effectiveFrom: ['Effective From', 'Effective Date'], revenue: ['Revenue'], login: ['Login'], demo: ['Demo'], license: ['License'], proPlatform: ['Pro Platform', 'ProPlatform'], arpl: ['ARPL'] };

function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export default function Page() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'manual' | 'paste' | 'review'>('paste');
  const [form, setForm] = useState<TargetInput>(blank);
  const [manualRows, setManualRows] = useState<TargetInput[]>([]);
  const [pasted, setPasted] = useState('');
  const [copied, setCopied] = useState(false);
  const targets = useQuery({ queryKey: ['targets'], queryFn: () => api<Target[]>('/targets') });
  const parsed = useMemo(() => parsePaste<TargetInput>(pasted, aliases, (row) => {
    if (!row.source) throw new Error('Source is required.');
    if (!['M0', 'M1', 'M1+'].includes(row.tenurity)) throw new Error('Tenurity must be M0, M1, or M1+.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveFrom)) throw new Error('Effective From must be YYYY-MM-DD.');
    const result = { ...row, revenue: Number(row.revenue), login: Number(row.login), demo: Number(row.demo), license: Number(row.license), proPlatform: Number(row.proPlatform), arpl: Number(row.arpl) };
    if ([result.revenue, result.login, result.demo, result.license, result.proPlatform, result.arpl].some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Metrics must be non-negative numbers.');
    return result;
  }), [pasted]);
  const batch = useMemo(() => [...manualRows, ...parsed.rows], [manualRows, parsed.rows]);
  const create = useMutation({
    mutationFn: (inputs: TargetInput[]) => api('/targets/versions/batch', { method: 'POST', body: JSON.stringify(inputs) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['targets'] }); setOpen(false); setForm(blank); setManualRows([]); setPasted(''); setTab('paste'); },
  });

  function addManual() {
    if (!form.source || !form.effectiveFrom) return;
    setManualRows((current) => [...current, form]);
    setForm({ ...blank, source: form.source, tenurity: form.tenurity, effectiveFrom: form.effectiveFrom });
  }
  function reviewBatch() { if (batch.length && !parsed.errors.length) setTab('review'); }
  function submit(event: FormEvent) { event.preventDefault(); if (tab === 'review' && !parsed.errors.length) create.mutate(batch); }
  async function copy() { await navigator.clipboard.writeText(targetTemplate); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">Target versions</h2><p className="text-slate-500">Batch-create effective-dated versions; matching active versions close automatically.</p></div><div className="flex gap-3"><button className="btn-secondary gap-2" onClick={() => targets.refetch()}><RefreshCw size={16} /> Fetch</button>{auth.canWrite && <button className="btn gap-2" onClick={() => setOpen(true)}><Plus size={17} /> Batch add targets</button>}</div></div>
    {targets.error && <p className="mb-4 text-red-700">{targets.error.message}</p>}
    <DataTable data={targets.data ?? []} columns={columns} />

    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-6 shadow-2xl">
      <div className="flex justify-between"><div><h3 className="text-xl font-bold">Batch create target versions</h3><p className="text-sm text-slate-500">Add rows, review every value, and explicitly confirm the version changes.</p></div><button type="button" onClick={() => setOpen(false)}><X /></button></div>
      <div className="my-5 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1"><button type="button" className={tab === 'manual' ? 'btn' : 'btn-secondary'} onClick={() => setTab('manual')}>Manual rows ({manualRows.length})</button><button type="button" className={tab === 'paste' ? 'btn' : 'btn-secondary'} onClick={() => setTab('paste')}>Paste rows ({parsed.rows.length})</button><button type="button" className={tab === 'review' ? 'btn' : 'btn-secondary'} disabled={tab !== 'review'}><CheckCircle2 size={16} /> Confirm</button></div>

      {tab === 'manual' && <div><div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-medium">Source<input required className="mt-1 w-full" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label><label className="text-sm font-medium">Tenurity<select className="mt-1 w-full" value={form.tenurity} onChange={(event) => setForm({ ...form, tenurity: event.target.value })}><option>M0</option><option>M1</option><option>M1+</option></select></label><label className="text-sm font-medium">Effective from<input required type="date" className="mt-1 w-full" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label>{(['revenue', 'login', 'demo', 'license', 'proPlatform', 'arpl'] as const).map((key) => <label key={key} className="text-sm font-medium">{key === 'proPlatform' ? 'Pro Platform' : key[0].toUpperCase() + key.slice(1)}<input min="0" step="0.01" type="number" className="mt-1 w-full" value={form[key]} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /></label>)}</div><button type="button" className="btn-secondary mt-4" onClick={addManual}>Add row to batch</button>{manualRows.length > 0 && <div className="mt-4 rounded-lg border">{manualRows.map((row, index) => <div key={`${row.source}-${row.tenurity}-${index}`} className="flex items-center gap-3 border-b p-3 last:border-0"><span className="flex-1 text-sm"><b>{row.source} / {row.tenurity}</b> · {row.effectiveFrom} · {money(row.revenue)}</span><button type="button" onClick={() => setManualRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16} /></button></div>)}</div>}</div>}

      {tab === 'paste' && <div><div className="mb-2 flex items-center justify-between"><p className="text-sm text-slate-600">Paste tab-separated cells from Sheets/Excel, including headers.</p><button type="button" className="btn-secondary gap-2" onClick={copy}>{copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? 'Copied' : 'Copy template'}</button></div><textarea className="h-52 w-full rounded-lg border p-3 font-mono text-xs" placeholder={targetTemplate} value={pasted} onChange={(event) => setPasted(event.target.value)} /><div className="mt-2 text-sm"><span className="text-emerald-700">{parsed.rows.length} valid rows</span>{parsed.errors.map((error) => <p key={error} className="text-red-700">{error}</p>)}</div></div>}

      {tab === 'review' && <div><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h4 className="font-semibold text-amber-950">Confirm target version changes</h4><p className="mt-1 text-sm text-amber-800">Creating these versions is append-only. Any matching active Source + Tenurity version will become inactive and close one day before the new effective date.</p></div><div className="mt-4 max-h-96 overflow-auto rounded-lg border"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Source</th><th className="p-3">Tenurity</th><th className="p-3">Effective from</th><th className="p-3">Closes current</th><th className="p-3">Revenue</th><th className="p-3">Login</th><th className="p-3">Demo</th><th className="p-3">License</th><th className="p-3">Pro Platform</th><th className="p-3">ARPL</th></tr></thead><tbody>{batch.map((row, index) => { const active = (targets.data ?? []).find((target) => target.source.toLowerCase() === row.source.toLowerCase() && target.tenurity === row.tenurity && target.status === 'ACTIVE'); return <tr key={`${row.source}-${row.tenurity}-${index}`} className="border-t"><td className="p-3 font-medium">{row.source}</td><td className="p-3">{row.tenurity}</td><td className="p-3">{row.effectiveFrom}</td><td className="p-3">{active ? `v${active.version} on ${previousDate(row.effectiveFrom)}` : 'None'}</td><td className="p-3">{money(row.revenue)}</td><td className="p-3">{row.login}</td><td className="p-3">{row.demo}</td><td className="p-3">{row.license}</td><td className="p-3">{row.proPlatform}</td><td className="p-3">{money(row.arpl)}</td></tr>; })}</tbody></table></div>{create.error && <p className="mt-4 text-sm text-red-700">{create.error.message}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setTab('paste')}>Back to edit</button><button className="btn" disabled={create.isPending}>{create.isPending ? 'Creating batch…' : `Confirm and create ${batch.length} versions`}</button></div></div>}

      {tab !== 'review' && <div className="mt-6 flex items-center justify-between"><p className="text-sm font-medium">Total target versions: {batch.length}</p><div className="flex gap-3"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn" disabled={!!parsed.errors.length || batch.length === 0} onClick={reviewBatch}>Review target batch</button></div></div>}
    </form></div>}
  </>;
}
