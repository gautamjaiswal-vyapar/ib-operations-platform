'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, Executive, MappingInput, MonthlyMapping } from '@/lib/api';
import { DataTable } from '@/components/data-table';

const column = createColumnHelper<MonthlyMapping>();
const columns = [
  column.accessor('month', { header: 'Month' }), column.accessor('employeeId', { header: 'Employee ID' }),
  column.accessor('name', { header: 'Executive' }), column.accessor('email', { header: 'Email' }),
  column.accessor('manager', { header: 'Manager' }), column.accessor('source', { header: 'Source' }),
  column.accessor('tenurity', { header: 'Tenurity' }), column.accessor('status', { header: 'Status' })
];
const currentMonth = new Date().toISOString().slice(0, 7);
const emptyNew = { employeeId: '', name: '', email: '', doj: '', manager: '', source: '', status: 'ACTIVE' };

export default function Page() {
  const [month, setMonth] = useState(currentMonth); const [open, setOpen] = useState(false); const [mode, setMode] = useState<'existing'|'new'>('existing'); const [executiveId, setExecutiveId] = useState(''); const [newExecutive, setNewExecutive] = useState(emptyNew); const queryClient = useQueryClient();
  const mappings = useQuery({ queryKey: ['monthly-mappings', month], queryFn: () => api<MonthlyMapping[]>(`/monthly-mappings?month=${month}`) });
  const executives = useQuery({ queryKey: ['executives'], queryFn: () => api<Executive[]>('/executives') });
  const save = useMutation({ mutationFn: (input: MappingInput) => api('/monthly-mappings', { method: 'POST', body: JSON.stringify(input) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['monthly-mappings', month] }); await queryClient.invalidateQueries({ queryKey: ['executives'] }); setOpen(false); setExecutiveId(''); setNewExecutive(emptyNew); } });
  function submit(event: FormEvent) { event.preventDefault(); save.mutate(mode === 'existing' ? { month, executiveId } : { month, newExecutive }); }
  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">Monthly executive mapping</h2><p className="text-slate-500">Executive details are snapshotted for the selected month; tenurity is calculated from DOJ.</p></div><div className="flex items-center gap-3"><label className="text-sm font-medium">Month <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ml-2"/></label><button className="btn gap-2" onClick={() => setOpen(true)}><Plus size={17}/> Add mapping</button></div></div>{mappings.error&&<p className="mb-4 text-red-700">{mappings.error.message}</p>}<DataTable data={mappings.data ?? []} columns={columns}/>
  {open&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h3 className="text-xl font-bold">Add executive for {month}</h3><p className="text-sm text-slate-500">Choose an existing agent or create a complete agent profile.</p></div><button type="button" onClick={() => setOpen(false)}><X/></button></div><div className="my-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1"><button type="button" className={mode==='existing'?'btn':'btn-secondary'} onClick={()=>setMode('existing')}>Existing agent</button><button type="button" className={mode==='new'?'btn':'btn-secondary'} onClick={()=>setMode('new')}>New agent</button></div>
  {mode==='existing'?<label className="block text-sm font-medium">Agent<select required className="mt-1 w-full" value={executiveId} onChange={e=>setExecutiveId(e.target.value)}><option value="">Select an agent</option>{executives.data?.map(row=><option key={row._id} value={row._id}>{row.employeeId} — {row.name} ({row.source})</option>)}</select></label>:<div className="grid gap-4 md:grid-cols-2">{([['employeeId','Employee ID','text'],['name','Executive name','text'],['email','Email','email'],['doj','DOJ','date'],['manager','Manager','text'],['source','Source','text']] as const).map(([key,label,type])=><label key={key} className="text-sm font-medium">{label}<input required type={type} className="mt-1 w-full" value={newExecutive[key]} onChange={e=>setNewExecutive({...newExecutive,[key]:e.target.value})}/></label>)}<label className="text-sm font-medium">Status<select className="mt-1 w-full" value={newExecutive.status} onChange={e=>setNewExecutive({...newExecutive,status:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></label></div>}
  {save.error&&<p className="mt-4 text-sm text-red-700">{save.error.message}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><button className="btn" disabled={save.isPending}>{save.isPending?'Saving…':'Save mapping'}</button></div></form></div>}</>;
}
