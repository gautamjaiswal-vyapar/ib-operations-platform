'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { gasApi } from '@/lib/apps-script';

type Source = { id: string; name: string; active: boolean };
type RevenueRow = { employeeId: string; periodType: string; period: string; revenue: number; manualRevenue: number };

export default function Page() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [revenuePreview, setRevenuePreview] = useState<RevenueRow[]>([]);
  const [agentSpreadsheetId, setAgentSpreadsheetId] = useState('1m4xZqI-Y5UHBgaYPed_kbAPaUqqeDQWT3JzlhJOo6W4');
  const [agentSheetName, setAgentSheetName] = useState('agentDataDump');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Revenue');
  const sources = useQuery({ queryKey: ['sources'], enabled: auth.isAdmin, queryFn: () => gasApi<Source[]>('sources.list') });
  const add = useMutation({ mutationFn: () => gasApi<Source>('sources.create', { name }), onSuccess: async () => { setName(''); await queryClient.invalidateQueries({ queryKey: ['sources'] }); } });
  const configureAgents = useMutation({ mutationFn: () => gasApi<{ spreadsheetId: string; sheetName: string; rowCount: number }>('agents.dump.configure', { spreadsheetId: agentSpreadsheetId, sheetName: agentSheetName }) });
  const configureRevenue = useMutation({ mutationFn: () => gasApi('revenue.configure', { spreadsheetId, sheetName }) });
  const fetchRevenue = useMutation({ mutationFn: () => gasApi<{ rows: RevenueRow[]; count: number }>('revenue.preview'), onSuccess: (data) => setRevenuePreview(data.rows) });
  const importRevenue = useMutation({ mutationFn: () => gasApi<{ imported: number; total: number }>('revenue.import'), onSuccess: () => queryClient.invalidateQueries() });

  function submit(event: FormEvent) { event.preventDefault(); add.mutate(); }
  if (!auth.isAdmin) return <p>Administrator access is required.</p>;

  return <>
    <div className="mb-6"><h2 className="text-2xl font-bold">Sources and integrations</h2><p className="text-slate-500">Manage operational sources and header-driven Google Sheet connections.</p></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="card">
        <h3 className="text-lg font-semibold">Source configuration</h3>
        <p className="mt-1 text-sm text-slate-500">Enter only the source name. The platform generates its unique ID automatically.</p>
        <form onSubmit={submit} className="my-4 flex gap-3"><input required className="min-w-0 flex-1" placeholder="Source name" value={name} onChange={(event) => setName(event.target.value)} /><button className="btn shrink-0 gap-2" disabled={!name.trim() || add.isPending}><Plus size={16} />{add.isPending ? 'Adding…' : 'Add source'}</button></form>
        {add.error && <p className="text-sm text-red-700">{add.error.message}</p>}
        {add.isSuccess && <p className="mb-3 text-sm text-emerald-700">Source created successfully.</p>}
        {sources.data?.map((source) => <div key={source.id} className="flex items-center justify-between border-t py-3 text-sm"><b>{source.name}</b><span className="font-mono text-xs text-slate-400">ID: {source.id}</span></div>)}
      </section>
      <section className="card">
        <div className="flex items-center gap-2"><Link2 className="text-blue-700" size={20} /><h3 className="text-lg font-semibold">Executive identity connection</h3></div>
        <p className="mt-2 text-sm text-slate-500">Expected headers: data_month, employee_id, executive_name, email, doj, manager. The platform can auto-discover the populated backend tab; saving an override pins the connection.</p>
        <div className="mt-4 grid gap-3"><input placeholder="Spreadsheet ID or URL" value={agentSpreadsheetId} onChange={(event) => setAgentSpreadsheetId(event.target.value)} /><input placeholder="Sheet tab name" value={agentSheetName} onChange={(event) => setAgentSheetName(event.target.value)} /><button className="btn-secondary" onClick={() => configureAgents.mutate()} disabled={!agentSpreadsheetId || !agentSheetName || configureAgents.isPending}>{configureAgents.isPending ? 'Validating…' : 'Validate and save connection'}</button></div>
        {configureAgents.isSuccess && <p className="mt-2 text-sm text-emerald-700">Connected to {configureAgents.data.sheetName}; {configureAgents.data.rowCount} identity rows detected.</p>}
        {configureAgents.error && <p className="mt-2 text-sm text-red-700">{configureAgents.error.message}</p>}
      </section>
      <section className="card">
        <h3 className="text-lg font-semibold">Revenue Google Sheet connection</h3>
        <p className="mt-1 text-sm text-slate-500">Expected headers: Employee ID, Period Type, Period, Revenue, Login, Demo, License, Pro Platform, Manual Revenue. For weekly incentives use WEEK and a Monday date (YYYY-MM-DD).</p>
        <div className="mt-4 grid gap-3"><input placeholder="Spreadsheet ID or URL" value={spreadsheetId} onChange={(event) => setSpreadsheetId(event.target.value)} /><input placeholder="Sheet tab name" value={sheetName} onChange={(event) => setSheetName(event.target.value)} /><button className="btn-secondary" onClick={() => configureRevenue.mutate()} disabled={!spreadsheetId || !sheetName}>Save connection</button></div>
        {configureRevenue.isSuccess && <p className="mt-2 text-sm text-emerald-700">Revenue connection saved in the configuration tab.</p>}
        {configureRevenue.error && <p className="mt-2 text-sm text-red-700">{configureRevenue.error.message}</p>}
        <div className="mt-4 flex gap-3"><button className="btn-secondary" onClick={() => fetchRevenue.mutate()}>Preview revenue</button>{revenuePreview.length > 0 && <button className="btn" onClick={() => importRevenue.mutate()}>Import into performance tab</button>}</div>
        {fetchRevenue.error && <p className="mt-2 text-sm text-red-700">{fetchRevenue.error.message}</p>}
        {revenuePreview.length > 0 && <div className="mt-3 max-h-64 overflow-auto rounded-lg border">{revenuePreview.map((row, index) => <div key={`${row.employeeId}-${row.period}-${index}`} className="grid grid-cols-2 gap-2 border-b p-3 text-sm"><b>{row.employeeId}</b><span>{row.periodType} {row.period}</span><span>Revenue {row.revenue}</span><span>Manual {row.manualRevenue}</span></div>)}</div>}
        {importRevenue.isSuccess && <p className="mt-2 text-sm text-emerald-700">Imported {importRevenue.data.imported} revenue rows.</p>}
        {importRevenue.error && <p className="mt-2 text-sm text-red-700">{importRevenue.error.message}</p>}
      </section>
    </div>
  </>;
}
