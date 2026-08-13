'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Clipboard, Download, Plus, RefreshCw, Search, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { DataTable } from '@/components/data-table';
import { api, Executive, MappingBatchInput, MonthlyMapping } from '@/lib/api';
import { gasApi } from '@/lib/apps-script';
import { parsePaste } from '@/lib/paste-parser';

type NewAgent = MappingBatchInput['newExecutives'][number];
type AgentDumpRow = Pick<Executive, 'employeeId' | 'name' | 'email' | 'doj' | 'manager'> & { dataMonth: string };
type AgentSync = { refreshed: boolean; sourceSheet: string; rowCount?: number; reason: string; warning?: string };
type AgentPreview = { rows: AgentDumpRow[]; count: number; sourceSheet: string; sourceSpreadsheetId: string; availableMonths: string[]; requestedMonth: string; sync?: AgentSync };
type Source = { id: string; name: string; code: string; active: boolean };
type ImportResult = { imported: number; total: number; executiveIds: string[] };

const column = createColumnHelper<MonthlyMapping>();
const columns = [
  column.accessor('month', { header: 'Month' }),
  column.accessor('employeeId', { header: 'Employee ID' }),
  column.accessor('name', { header: 'Executive' }),
  column.accessor('email', { header: 'Email' }),
  column.accessor('manager', { header: 'Manager' }),
  column.accessor('source', { header: 'Source' }),
  column.accessor('tenurity', { header: 'Tenurity' }),
  column.accessor('status', { header: 'Status' }),
];
const currentMonth = new Date().toISOString().slice(0, 7);
const agentPageSize = 20;
const localDateTime = () => {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
};
const agentTemplate = 'Employee ID\tExecutive Name\tEmail\tDOJ\tManager\tSource\tTenurity\tStatus\nIB005\tAnanya Gupta\tananya@example.com\t2026-08-01\tRiya Kapoor\tInbound\tM0\tACTIVE';
const aliases: Record<keyof NewAgent, string[]> = {
  employeeId: ['Employee ID', 'EmployeeID'],
  name: ['Executive Name', 'Name', 'Agent'],
  email: ['Email'],
  doj: ['DOJ', 'Date of Joining'],
  manager: ['Manager'],
  source: ['Source'],
  tenurity: ['Tenurity', 'Tenure'],
  status: ['Status'],
};

export default function Page() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'existing' | 'paste' | 'connected' | 'review'>('existing');
  const [reviewMode, setReviewMode] = useState<'mapping' | 'connected'>('mapping');
  const [selected, setSelected] = useState<string[]>([]);
  const [existingSearch, setExistingSearch] = useState('');
  const [existingPage, setExistingPage] = useState(0);
  const [pasted, setPasted] = useState('');
  const [copied, setCopied] = useState(false);
  const [dumpRows, setDumpRows] = useState<AgentDumpRow[]>([]);
  const [agentConnection, setAgentConnection] = useState<Pick<AgentPreview, 'sourceSheet' | 'sourceSpreadsheetId' | 'availableMonths'> | null>(null);
  const [agentSync, setAgentSync] = useState<AgentSync | null>(null);
  const [dumpSelected, setDumpSelected] = useState<string[]>([]);
  const [connectedSearch, setConnectedSearch] = useState('');
  const [connectedPage, setConnectedPage] = useState(0);
  const [manager, setManager] = useState('');
  const [source, setSource] = useState('');
  const [tenurity, setTenurity] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [updatedAt, setUpdatedAt] = useState(localDateTime);

  const mappings = useQuery({ queryKey: ['monthly-mappings', month], queryFn: () => api<MonthlyMapping[]>(`/monthly-mappings?month=${month}`) });
  const executives = useQuery({ queryKey: ['executives'], queryFn: () => api<Executive[]>('/executives') });
  const sources = useQuery({ queryKey: ['sources'], enabled: auth.isAdmin, queryFn: () => gasApi<Source[]>('sources.list') });
  const parsed = useMemo(() => parsePaste<NewAgent>(pasted, aliases, (row) => {
    if (!row.employeeId || !row.name || !row.email || !row.doj || !row.manager || !row.source || !row.tenurity) throw new Error('Required value is blank.');
    if (!/^\S+@\S+\.\S+$/.test(row.email)) throw new Error('Email is invalid.');
    if (Number.isNaN(new Date(row.doj).valueOf())) throw new Error('DOJ must be YYYY-MM-DD.');
    const normalizedTenurity = row.tenurity.toUpperCase();
    if (!['M0', 'M1', 'M1+'].includes(normalizedTenurity)) throw new Error('Tenurity must be M0, M1, or M1+.');
    const normalizedStatus = row.status.toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) throw new Error('Status must be ACTIVE or INACTIVE.');
    return { ...row, tenurity: normalizedTenurity, status: normalizedStatus };
  }), [pasted]);
  const alreadyMapped = useMemo(() => new Set((mappings.data ?? []).map((row) => row._id)), [mappings.data]);
  const selectedExecutives = useMemo(() => (executives.data ?? []).filter((agent) => selected.includes(agent._id)), [executives.data, selected]);
  const filteredExecutives = useMemo(() => {
    const query = existingSearch.trim().toLowerCase();
    return (executives.data ?? []).filter((agent) => !query || [agent.employeeId, agent.name, agent.email, agent.manager, agent.source, agent.tenurity, agent.status].some((value) => String(value).toLowerCase().includes(query)));
  }, [executives.data, existingSearch]);
  const existingPageCount = Math.max(1, Math.ceil(filteredExecutives.length / agentPageSize));
  const visibleExecutives = filteredExecutives.slice(Math.min(existingPage, existingPageCount - 1) * agentPageSize, (Math.min(existingPage, existingPageCount - 1) + 1) * agentPageSize);
  const selectedDumpRows = useMemo(() => dumpRows.filter((row) => dumpSelected.includes(row.employeeId)), [dumpRows, dumpSelected]);
  const filteredDumpRows = useMemo(() => {
    const query = connectedSearch.trim().toLowerCase();
    return dumpRows.filter((agent) => !query || [agent.employeeId, agent.name, agent.email, agent.manager, agent.dataMonth].some((value) => String(value).toLowerCase().includes(query)));
  }, [dumpRows, connectedSearch]);
  const connectedPageCount = Math.max(1, Math.ceil(filteredDumpRows.length / agentPageSize));
  const safeConnectedPage = Math.min(connectedPage, connectedPageCount - 1);
  const visibleDumpRows = filteredDumpRows.slice(safeConnectedPage * agentPageSize, (safeConnectedPage + 1) * agentPageSize);
  const connectedManagerMissing = useMemo(() => selectedDumpRows.some((row) => !manager && !row.manager), [selectedDumpRows, manager]);
  const executivesByEmployee = useMemo(() => new Map((executives.data ?? []).map((row) => [row.employeeId.toUpperCase(), row])), [executives.data]);
  const connectedTenurityRequiredCount = useMemo(() => selectedDumpRows.filter((row) => {
    const existingTenurity = executivesByEmployee.get(row.employeeId.toUpperCase())?.tenurity?.toUpperCase();
    return !existingTenurity || !['M0', 'M1', 'M1+'].includes(existingTenurity);
  }).length, [selectedDumpRows, executivesByEmployee]);

  const save = useMutation({
    mutationFn: (input: MappingBatchInput) => api('/monthly-mappings/batch', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['monthly-mappings', month] }), queryClient.invalidateQueries({ queryKey: ['executives'] })]);
      setOpen(false); setSelected([]); setPasted('');
    },
  });
  const fetchDump = useMutation({
    mutationFn: () => gasApi<AgentPreview>('agents.dump.preview', { limit: 1000, month }),
    onSuccess: (data) => { setDumpRows(data.rows); setDumpSelected([]); setConnectedPage(0); setAgentSync(data.sync ?? null); setAgentConnection({ sourceSheet: data.sourceSheet, sourceSpreadsheetId: data.sourceSpreadsheetId, availableMonths: data.availableMonths }); },
  });
  const importDump = useMutation({
    mutationFn: () => gasApi<ImportResult>('agents.dump.import', {
      employeeIds: dumpSelected,
      details: { manager, source, tenurity: tenurity || undefined, status, updatedAt },
      month,
      limit: 10000,
    }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['executives'] });
      setSelected((current) => Array.from(new Set([...current, ...data.executiveIds.filter((id) => !alreadyMapped.has(id))])));
      setDumpSelected([]);
      setTab('existing');
    },
  });

  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function toggleDump(employeeId: string) { setDumpSelected((current) => current.includes(employeeId) ? current.filter((value) => value !== employeeId) : [...current, employeeId]); }
  function toggleVisibleExecutives() { const ids = visibleExecutives.filter((agent) => !alreadyMapped.has(agent._id)).map((agent) => agent._id); const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id)); setSelected((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids]))); }
  function toggleVisibleDumpRows() { const ids = visibleDumpRows.map((agent) => agent.employeeId); const allSelected = ids.length > 0 && ids.every((id) => dumpSelected.includes(id)); setDumpSelected((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids]))); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (tab !== 'review' || reviewMode !== 'mapping' || parsed.errors.length) return;
    save.mutate({ month, executiveIds: selected, newExecutives: parsed.rows });
  }
  function reviewMapping() {
    if (parsed.errors.length || selected.length + parsed.rows.length === 0) return;
    setReviewMode('mapping'); setTab('review');
  }
  function reviewConnectedImport() {
    if (!dumpSelected.length || connectedManagerMissing || !source || !updatedAt || (connectedTenurityRequiredCount > 0 && !tenurity)) return;
    setReviewMode('connected'); setTab('review');
  }
  async function copy() { await navigator.clipboard.writeText(agentTemplate); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-2xl font-bold">Monthly executive mapping</h2><p className="text-slate-500">Batch-map existing agents, paste new profiles, or import identities from the connected sheet.</p></div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Month <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ml-2" /></label>
        <button className="btn-secondary gap-2" onClick={() => { void mappings.refetch(); void executives.refetch(); }}><RefreshCw size={16} /> Fetch</button>
        {auth.canWrite && <button className="btn gap-2" onClick={() => setOpen(true)}><Plus size={17} /> Batch add</button>}
      </div>
    </div>
    {mappings.error && <p className="mb-4 text-red-700">{mappings.error.message}</p>}
    <DataTable data={mappings.data ?? []} columns={columns} />

    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-2 sm:p-4">
      <form onSubmit={submit} className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-4 shadow-2xl sm:p-5">
        <div className="flex justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold">Add agents</h3><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Mapping month {month}</span></div><p className="mt-0.5 text-xs text-slate-500">Choose existing agents, paste records, or fetch connected identities.</p></div><button type="button" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button></div>
        <div className={`my-3 grid ${auth.isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-1 rounded-lg bg-slate-100 p-1 [&_.btn-secondary]:border-0 [&_.btn-secondary]:bg-transparent [&_.btn-secondary]:px-2 [&_.btn-secondary]:py-1.5 [&_.btn]:px-2 [&_.btn]:py-1.5`}>
          <button type="button" className={tab === 'existing' ? 'btn' : 'btn-secondary'} onClick={() => setTab('existing')}>Existing ({selected.length})</button>
          <button type="button" className={tab === 'paste' ? 'btn' : 'btn-secondary'} onClick={() => setTab('paste')}>Paste new ({parsed.rows.length})</button>
          {auth.isAdmin && <button type="button" className={tab === 'connected' ? 'btn' : 'btn-secondary'} onClick={() => setTab('connected')}>Connected sheet</button>}
          <button type="button" className={tab === 'review' ? 'btn' : 'btn-secondary'} disabled={tab !== 'review'}><CheckCircle2 size={16} /> Confirm</button>
        </div>

        {tab === 'existing' && <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2"><div><p className="text-sm font-semibold text-slate-900">Existing agent directory</p><p className="text-xs text-slate-500">{filteredExecutives.length} visible · {selected.length} selected</p></div><div className="flex flex-1 items-center justify-end gap-2 sm:flex-none"><label className="relative min-w-0 flex-1 sm:w-72"><Search className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" size={15} /><input className="w-full py-1.5 pl-8" placeholder="Search ID, name, manager, source…" value={existingSearch} onChange={(event) => { setExistingSearch(event.target.value); setExistingPage(0); }} /></label><button type="button" className="btn-secondary whitespace-nowrap px-3 py-1.5" onClick={toggleVisibleExecutives}>Select page</button></div></div>
          <div className="max-h-[52vh] overflow-auto">{visibleExecutives.map((agent) => <label key={agent._id} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 last:border-0 hover:bg-blue-50/50"><input type="checkbox" checked={selected.includes(agent._id) || alreadyMapped.has(agent._id)} disabled={alreadyMapped.has(agent._id)} onChange={() => toggle(agent._id)} /><span className="min-w-0"><span className="flex flex-wrap items-baseline gap-x-2"><b className="text-sm text-slate-950">{agent.name}</b><span className="font-mono text-xs font-semibold text-blue-700">{agent.employeeId}</span></span><span className="mt-0.5 block truncate text-xs text-slate-500">{agent.email} · DOJ {agent.doj} · {agent.manager || 'Manager missing'} · {agent.source}</span></span><span className="flex items-center gap-2"><span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{agent.tenurity || 'Not set'}</span>{alreadyMapped.has(agent._id) && <span className="hidden text-xs font-medium text-emerald-700 sm:inline">Mapped</span>}</span></label>)}</div>
          <div className="flex items-center justify-between border-t bg-white px-3 py-2 text-xs text-slate-500"><span>Showing {filteredExecutives.length ? Math.min(existingPage, existingPageCount - 1) * agentPageSize + 1 : 0}–{Math.min((Math.min(existingPage, existingPageCount - 1) + 1) * agentPageSize, filteredExecutives.length)} of {filteredExecutives.length}</span><div className="flex items-center gap-2"><button type="button" className="rounded border p-1 disabled:opacity-40" disabled={existingPage <= 0} onClick={() => setExistingPage((page) => Math.max(0, page - 1))}><ChevronLeft size={15} /></button><span>Page {Math.min(existingPage, existingPageCount - 1) + 1} / {existingPageCount}</span><button type="button" className="rounded border p-1 disabled:opacity-40" disabled={existingPage >= existingPageCount - 1} onClick={() => setExistingPage((page) => Math.min(existingPageCount - 1, page + 1))}><ChevronRight size={15} /></button></div></div>
        </div>}

        {tab === 'paste' && <div><div className="mb-2 flex items-center justify-between"><p className="text-sm text-slate-600">Paste tab-separated cells from Sheets/Excel, including the header row.</p><button type="button" className="btn-secondary gap-2" onClick={copy}>{copied ? <Check size={16} /> : <Clipboard size={16} />} {copied ? 'Copied' : 'Copy template'}</button></div><textarea className="h-52 w-full rounded-lg border p-3 font-mono text-xs" placeholder={agentTemplate} value={pasted} onChange={(event) => setPasted(event.target.value)} /><div className="mt-2 text-sm"><span className="text-emerald-700">{parsed.rows.length} valid rows</span>{parsed.errors.map((error) => <p key={error} className="text-red-700">{error}</p>)}</div></div>}

        {tab === 'connected' && auth.isAdmin && <div>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">Connected executive identities</h4><p className="text-sm text-slate-500">Fetches the latest active identity rows from the connected query. Mapping month {month} is user-selected. Tenurity changes only when you explicitly select a value; otherwise an existing value is preserved. data_month is freshness metadata only.</p>{agentConnection && <p className="mt-1 text-xs text-emerald-700">Connected to {agentConnection.sourceSheet} · Source snapshots: {agentConnection.availableMonths.join(', ') || 'unversioned data'}</p>}</div><button type="button" className="btn-secondary gap-2" onClick={() => fetchDump.mutate()} disabled={fetchDump.isPending}><Download size={16} /> {fetchDump.isPending ? 'Fetching…' : 'Fetch active agents'}</button></div>
          {fetchDump.error && <p className="mt-3 text-sm text-red-700">{fetchDump.error.message}</p>}
          {agentSync && dumpRows.length > 0 && <p className={`mt-3 text-sm ${agentSync.reason.includes('FALLBACK') ? 'text-amber-700' : 'text-emerald-700'}`}>{agentSync.reason === 'UPDATED' ? `Latest scheduled Connected Sheet snapshot copied; ${agentSync.rowCount ?? dumpRows.length} rows written to agentDataDump.` : agentSync.reason === 'UNCHANGED' ? `Connected Sheet snapshot checked; agentDataDump is already current with ${agentSync.rowCount ?? dumpRows.length} rows.` : agentSync.reason.includes('FALLBACK') ? `Using the last successful agentDataDump snapshot because the connected snapshot was unavailable${agentSync.warning ? `: ${agentSync.warning}` : '.'}` : `Loaded ${dumpRows.length} connected identities.`}</p>}
          {fetchDump.isSuccess && dumpRows.length === 0 && <p className="mt-3 text-sm text-amber-700">No active executives were returned. Refresh the Connected Sheet query and retry.</p>}
          {dumpRows.length > 0 && <>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2"><div><p className="text-sm font-semibold text-slate-900">Available agents</p><p className="text-xs text-slate-500">{filteredDumpRows.length} visible · {dumpSelected.length} selected</p></div><div className="flex flex-1 items-center justify-end gap-2 sm:flex-none"><label className="relative min-w-0 flex-1 sm:w-72"><Search className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" size={15} /><input className="w-full py-1.5 pl-8" placeholder="Search ID, agent, email, manager…" value={connectedSearch} onChange={(event) => { setConnectedSearch(event.target.value); setConnectedPage(0); }} /></label><button type="button" className="btn-secondary whitespace-nowrap px-3 py-1.5" onClick={toggleVisibleDumpRows}>Select page</button></div></div>
                <div className="max-h-[48vh] overflow-auto">{visibleDumpRows.map((row) => { const existing = executivesByEmployee.get(row.employeeId.toUpperCase()); return <label key={row.employeeId} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 last:border-0 hover:bg-blue-50/50"><input type="checkbox" checked={dumpSelected.includes(row.employeeId)} onChange={() => toggleDump(row.employeeId)} /><span className="min-w-0"><span className="flex flex-wrap items-baseline gap-x-2"><b className="text-sm text-slate-950">{row.name}</b><span className="font-mono text-xs font-semibold text-blue-700">{row.employeeId}</span></span><span className="mt-0.5 block truncate text-xs text-slate-500">{row.email} · DOJ {row.doj} · {row.manager || 'Manager missing'}</span></span><span className="text-right"><span className="block rounded-md bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{tenurity || existing?.tenurity || 'New · select'}</span><span className="mt-1 block text-[10px] text-slate-400">{row.dataMonth || 'No snapshot month'}</span></span></label>; })}</div>
                <div className="flex items-center justify-between border-t bg-white px-3 py-2 text-xs text-slate-500"><span>Showing {filteredDumpRows.length ? safeConnectedPage * agentPageSize + 1 : 0}–{Math.min((safeConnectedPage + 1) * agentPageSize, filteredDumpRows.length)} of {filteredDumpRows.length}</span><div className="flex items-center gap-2"><button type="button" className="rounded border p-1 disabled:opacity-40" disabled={safeConnectedPage <= 0} onClick={() => setConnectedPage((page) => Math.max(0, page - 1))}><ChevronLeft size={15} /></button><span>Page {safeConnectedPage + 1} / {connectedPageCount}</span><button type="button" className="rounded border p-1 disabled:opacity-40" disabled={safeConnectedPage >= connectedPageCount - 1} onClick={() => setConnectedPage((page) => Math.min(connectedPageCount - 1, page + 1))}><ChevronRight size={15} /></button></div></div>
              </div>
              <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-3 lg:sticky lg:top-0"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">Batch details</p><p className="text-xs text-slate-500">Applied to selected agents</p></div><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{dumpSelected.length}</span></div><div className="grid gap-2.5">
                <label className="text-xs font-semibold text-slate-600">Source<input required={tab === 'connected'} list="executive-source-options" className="mt-1 w-full py-1.5" value={source} onChange={(event) => setSource(event.target.value)} /><datalist id="executive-source-options">{sources.data?.filter((item) => item.active).map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
                <label className="text-xs font-semibold text-slate-600">Tenurity <span className="font-normal">({connectedTenurityRequiredCount ? `required for ${connectedTenurityRequiredCount} selected` : 'optional'})</span><select className="mt-1 w-full py-1.5" value={tenurity} onChange={(event) => setTenurity(event.target.value)}><option value="">Keep existing value</option><option value="M0">M0</option><option value="M1">M1</option><option value="M1+">M1+</option></select></label>
                <label className="text-xs font-semibold text-slate-600">Manager override <span className="font-normal">(optional)</span><input className="mt-1 w-full py-1.5" placeholder="Use connected managers" value={manager} onChange={(event) => setManager(event.target.value)} /></label>
                <label className="text-xs font-semibold text-slate-600">Status<select className="mt-1 w-full py-1.5" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
                <label className="text-xs font-semibold text-slate-600">Updated at<input required={tab === 'connected'} type="datetime-local" className="mt-1 w-full py-1.5" value={updatedAt} onChange={(event) => setUpdatedAt(event.target.value)} /></label>
              </div>{connectedManagerMissing && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">A selected agent has no manager. Add an override.</p>}{connectedTenurityRequiredCount > 0 && !tenurity && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">Choose tenurity for {connectedTenurityRequiredCount} executive{connectedTenurityRequiredCount === 1 ? '' : 's'} without a stored value.</p>}<button type="button" className="btn mt-3 w-full" disabled={!dumpSelected.length || connectedManagerMissing || !source || !updatedAt || (connectedTenurityRequiredCount > 0 && !tenurity)} onClick={reviewConnectedImport}>Review {dumpSelected.length || ''} selected</button></aside>
            </div>
          </>}
          {importDump.isSuccess && <p className="mt-3 text-sm text-emerald-700">Imported {importDump.data.imported} executives. They are now selected in Existing agents; save the batch to create the {month} mapping.</p>}
          {importDump.error && <p className="mt-3 text-sm text-red-700">{importDump.error.message}</p>}
        </div>}

        {tab === 'review' && reviewMode === 'connected' && <div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h4 className="font-semibold text-amber-950">Confirm executive master update</h4><p className="mt-1 text-sm text-amber-800">This will upsert {selectedDumpRows.length} selected identities into Executives. Review all supplied operational details before confirming.</p></div>
          <div className="mt-4 grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-5"><div><span className="text-slate-500">Manager handling</span><b className="block">{manager || 'Per connected row'}</b></div><div><span className="text-slate-500">Source</span><b className="block">{source}</b></div><div><span className="text-slate-500">Tenurity</span><b className="block">{tenurity || 'Keep existing'}</b></div><div><span className="text-slate-500">Status</span><b className="block">{status}</b></div><div><span className="text-slate-500">Updated at</span><b className="block">{updatedAt}</b></div></div>
          <div className="mt-4 max-h-72 overflow-auto rounded-lg border"><table className="w-full min-w-[980px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Month</th><th className="p-3">Employee ID</th><th className="p-3">Executive</th><th className="p-3">Email</th><th className="p-3">DOJ</th><th className="p-3">Tenurity</th><th className="p-3">Manager</th></tr></thead><tbody>{selectedDumpRows.map((row) => <tr key={row.employeeId} className="border-t"><td className="p-3">{month}</td><td className="p-3 font-medium">{row.employeeId}</td><td className="p-3">{row.name}</td><td className="p-3">{row.email}</td><td className="p-3">{row.doj}</td><td className="p-3 font-medium">{tenurity || executivesByEmployee.get(row.employeeId.toUpperCase())?.tenurity || 'Required'}</td><td className="p-3">{manager || row.manager}</td></tr>)}</tbody></table></div>
          {importDump.error && <p className="mt-3 text-sm text-red-700">{importDump.error.message}</p>}
          <div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setTab('connected')}>Back to edit</button><button type="button" className="btn" disabled={importDump.isPending} onClick={() => importDump.mutate()}>{importDump.isPending ? 'Importing…' : 'Confirm executive import'}</button></div>
        </div>}

        {tab === 'review' && reviewMode === 'mapping' && <div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4"><h4 className="font-semibold text-blue-950">Confirm monthly agent mapping</h4><p className="mt-1 text-sm text-blue-800">Month: <b>{month}</b> · Existing executives: <b>{selectedExecutives.length}</b> · New pasted executives: <b>{parsed.rows.length}</b></p></div>
          <div className="mt-4 max-h-80 overflow-auto rounded-lg border"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Type</th><th className="p-3">Employee ID</th><th className="p-3">Executive</th><th className="p-3">Email</th><th className="p-3">DOJ</th><th className="p-3">Tenurity</th><th className="p-3">Manager</th><th className="p-3">Source</th><th className="p-3">Status</th></tr></thead><tbody>{selectedExecutives.map((row) => <tr key={row._id} className="border-t"><td className="p-3">Existing</td><td className="p-3 font-medium">{row.employeeId}</td><td className="p-3">{row.name}</td><td className="p-3">{row.email}</td><td className="p-3">{row.doj}</td><td className="p-3 font-medium">{row.tenurity || 'Not set'}</td><td className="p-3">{row.manager}</td><td className="p-3">{row.source}</td><td className="p-3">{row.status}</td></tr>)}{parsed.rows.map((row) => <tr key={`new-${row.employeeId}`} className="border-t"><td className="p-3">New</td><td className="p-3 font-medium">{row.employeeId}</td><td className="p-3">{row.name}</td><td className="p-3">{row.email}</td><td className="p-3">{row.doj}</td><td className="p-3 font-medium">{row.tenurity}</td><td className="p-3">{row.manager}</td><td className="p-3">{row.source}</td><td className="p-3">{row.status}</td></tr>)}</tbody></table></div>
          {save.error && <p className="mt-4 text-sm text-red-700">{save.error.message}</p>}
          <div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setTab('existing')}>Back to edit</button><button className="btn" disabled={save.isPending}>{save.isPending ? 'Saving batch…' : 'Confirm and save mapping'}</button></div>
        </div>}

        {tab !== 'review' && tab !== 'connected' && <div className="mt-4 flex items-center justify-between"><p className="text-sm font-medium">Total to map: {selected.length + parsed.rows.length}</p><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn" disabled={!!parsed.errors.length || selected.length + parsed.rows.length === 0} onClick={reviewMapping}>Review mapping</button></div></div>}
      </form>
    </div>}
  </>;
}
