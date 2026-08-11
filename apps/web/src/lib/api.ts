import { getWorkspaceId, supabase, supabaseConfigured } from './supabase';

export type Executive = { _id: string; employeeId: string; name: string; email: string; doj: string; manager: string; source: string; tenurity: string; status: string; active: boolean };
export type MonthlyMapping = Executive & { mappingId: string; month: string };
export type Target = { _id: string; source: string; tenurity: string; version: number; effectiveFrom: string; effectiveTo?: string; revenue: number; login: number; demo: number; license: number; proPlatform: number; arpl: number; status: string };
type Incentive = { _id: string; executive: { name: string }; target: number; eligibleRevenue: number; achievement: number; bonus: number; incentive: number; calculationVersion: number };
type Store = { executives: Executive[]; monthlyMappings: MonthlyMapping[]; targets: Target[]; incentives: Incentive[]; weeklySnapshots: string[]; monthlySnapshots: string[]; updatedAt: string };
export type MappingInput = { month: string; executiveId?: string; newExecutive?: Omit<Executive, '_id' | 'tenurity' | 'active'> };
export type TargetInput = Omit<Target, '_id' | 'version' | 'effectiveTo' | 'status'>;

const STORAGE_KEY = 'ib-operations-platform-v3';
const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);
function weekKey(date = new Date()) { const value = new Date(date); const day = value.getUTCDay(); value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1)); return value.toISOString().slice(0, 10); }
export function calculateTenurity(doj: string, month = monthKey()) { const start = new Date(`${doj.slice(0, 7)}-01T00:00:00Z`); const at = new Date(`${month}-01T00:00:00Z`); const months = (at.getUTCFullYear() - start.getUTCFullYear()) * 12 + at.getUTCMonth() - start.getUTCMonth(); if (months < 0) throw new Error('DOJ cannot be after the selected month.'); return months === 0 ? 'M0' : months === 1 ? 'M1' : 'M1+'; }
function monthsAgo(months: number) { const date = new Date(); date.setUTCMonth(date.getUTCMonth() - months); return date.toISOString().slice(0, 10); }

function initialStore(): Store {
  const executives: Executive[] = [
    { _id: 'exec-1', employeeId: 'IB001', name: 'Aarav Sharma', email: 'aarav@example.com', doj: monthsAgo(0), manager: 'Riya Kapoor', source: 'Inbound', tenurity: '', status: 'ACTIVE', active: true },
    { _id: 'exec-2', employeeId: 'IB002', name: 'Diya Patel', email: 'diya@example.com', doj: monthsAgo(1), manager: 'Riya Kapoor', source: 'Outbound', tenurity: '', status: 'ACTIVE', active: true },
    { _id: 'exec-3', employeeId: 'IB003', name: 'Kabir Singh', email: 'kabir@example.com', doj: monthsAgo(4), manager: 'Arjun Rao', source: 'Inbound', tenurity: '', status: 'ACTIVE', active: true },
    { _id: 'exec-4', employeeId: 'IB004', name: 'Meera Iyer', email: 'meera@example.com', doj: monthsAgo(8), manager: 'Arjun Rao', source: 'Partner', tenurity: '', status: 'ACTIVE', active: true }
  ].map((row) => ({ ...row, tenurity: calculateTenurity(row.doj) }));
  const monthlyMappings = executives.map((row) => ({ ...row, mappingId: `mapping-${row._id}-${monthKey()}`, month: monthKey() }));
  const targets: Target[] = ['Inbound', 'Outbound', 'Partner'].flatMap((source, sourceIndex) => ['M0', 'M1', 'M1+'].map((tier, tierIndex) => ({ _id: `target-${sourceIndex}-${tierIndex}`, source, tenurity: tier, version: 1, effectiveFrom: '2024-01-01', revenue: 75000 + sourceIndex * 15000 + tierIndex * 25000, login: 20, demo: 12, license: 5, proPlatform: 3, arpl: 5000, status: 'ACTIVE' })));
  const incentives = calculateIncentives(executives, targets, 1);
  return { executives, monthlyMappings, targets, incentives, weeklySnapshots: [weekKey()], monthlySnapshots: [monthKey()], updatedAt: new Date().toISOString() };
}

function calculateIncentives(executives: Executive[], targets: Target[], version: number): Incentive[] { return executives.filter((row) => row.active).map((executive, index) => { const target = targets.find((row) => row.source === executive.source && row.tenurity === executive.tenurity && row.status === 'ACTIVE'); const targetValue = target?.revenue ?? 100000; const eligibleRevenue = Math.round(targetValue * (0.82 + index * 0.11)); const achievement = targetValue ? eligibleRevenue / targetValue : 0; const rate = achievement >= 1.2 ? 0.04 : achievement >= 1 ? 0.025 : 0; const bonus = Math.max(eligibleRevenue - targetValue, 0) * rate; return { _id: `${monthKey()}-${executive._id}-v${version}`, executive: { name: executive.name }, target: targetValue, eligibleRevenue, achievement, bonus, incentive: eligibleRevenue * rate + bonus, calculationVersion: version }; }); }
export function readStore(): Store { if (typeof window === 'undefined') return initialStore(); const value = localStorage.getItem(STORAGE_KEY); if (!value) { const seeded = initialStore(); writeStore(seeded); return seeded; } try { const parsed = JSON.parse(value) as Store; return parsed.monthlyMappings ? parsed : initialStore(); } catch { return initialStore(); } }
export function writeStore(store: Store) { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, updatedAt: new Date().toISOString() })); }
export function resetStore() { const store = initialStore(); writeStore(store); return store; }
export function exportStore() { return JSON.stringify(readStore(), null, 2); }

function mapExecutive(row: any): Executive { return { _id: row.id, employeeId: row.employee_id, name: row.executive_name, email: row.email, doj: row.doj, manager: row.manager, source: row.source, tenurity: calculateTenurity(row.doj), status: row.status, active: row.status === 'ACTIVE' }; }
function mapMapping(row: any): MonthlyMapping { return { mappingId: row.id, month: String(row.month).slice(0, 7), _id: row.executive_id, employeeId: row.employee_id, name: row.executive_name, email: row.email, doj: '', manager: row.manager, source: row.source, tenurity: row.tenurity, status: row.status, active: row.status === 'ACTIVE' }; }
function mapTarget(row: any): Target { return { _id: row.id, source: row.source, tenurity: row.tenurity, version: row.version, effectiveFrom: row.effective_from, effectiveTo: row.effective_to ?? undefined, revenue: Number(row.revenue), login: Number(row.login), demo: Number(row.demo), license: Number(row.license), proPlatform: Number(row.pro_platform), arpl: Number(row.arpl), status: row.status }; }
function payload(init: RequestInit) { return init.body ? JSON.parse(String(init.body)) : {}; }

async function listExecutives(): Promise<Executive[]> { if (!supabaseConfigured || !supabase) return readStore().executives; const workspace = await getWorkspaceId(); const { data, error } = await supabase.from('executives').select('*').eq('workspace_id', workspace).order('executive_name'); if (error) throw error; return data.map(mapExecutive); }
async function listMappings(month: string): Promise<MonthlyMapping[]> { if (!supabaseConfigured || !supabase) return readStore().monthlyMappings.filter((row) => row.month === month); const workspace = await getWorkspaceId(); const { data, error } = await supabase.from('monthly_mappings').select('*').eq('workspace_id', workspace).eq('month', `${month}-01`).order('executive_name'); if (error) throw error; return data.map(mapMapping); }
async function saveMapping(input: MappingInput): Promise<MonthlyMapping> {
  if (!supabaseConfigured || !supabase) { const store = readStore(); let executive = store.executives.find((row) => row._id === input.executiveId); if (!executive && input.newExecutive) { executive = { ...input.newExecutive, _id: crypto.randomUUID(), tenurity: calculateTenurity(input.newExecutive.doj), active: input.newExecutive.status === 'ACTIVE' }; store.executives.push(executive); } if (!executive) throw new Error('Select or create an executive.'); const mapping: MonthlyMapping = { ...executive, tenurity: calculateTenurity(executive.doj, input.month), mappingId: crypto.randomUUID(), month: input.month }; const existing = store.monthlyMappings.findIndex((row) => row.month === input.month && row._id === executive!._id); if (existing >= 0) store.monthlyMappings[existing] = mapping; else store.monthlyMappings.push(mapping); writeStore(store); return mapping; }
  const workspace = await getWorkspaceId(); let executive: Executive | undefined;
  if (input.executiveId) executive = (await listExecutives()).find((row) => row._id === input.executiveId);
  if (!executive && input.newExecutive) { const record = input.newExecutive; const { data, error } = await supabase.from('executives').insert({ workspace_id: workspace, employee_id: record.employeeId, executive_name: record.name, email: record.email, doj: record.doj, manager: record.manager, source: record.source, status: record.status }).select().single(); if (error) throw error; executive = mapExecutive(data); }
  if (!executive) throw new Error('Select or create an executive.');
  const { data, error } = await supabase.from('monthly_mappings').upsert({ workspace_id: workspace, month: `${input.month}-01`, executive_id: executive._id, employee_id: executive.employeeId, executive_name: executive.name, email: executive.email, manager: executive.manager, source: executive.source, tenurity: calculateTenurity(executive.doj, input.month), status: executive.status }, { onConflict: 'workspace_id,month,executive_id' }).select().single(); if (error) throw error; return mapMapping(data);
}
async function listTargets(): Promise<Target[]> { if (!supabaseConfigured || !supabase) return readStore().targets; const workspace = await getWorkspaceId(); const { data, error } = await supabase.from('target_versions').select('*').eq('workspace_id', workspace).order('source').order('tenurity').order('version', { ascending: false }); if (error) throw error; return data.map(mapTarget); }
async function createTarget(input: TargetInput): Promise<Target> { if (!supabaseConfigured || !supabase) { const store = readStore(); const active = store.targets.find((row) => row.source === input.source && row.tenurity === input.tenurity && row.status === 'ACTIVE'); const version = Math.max(0, ...store.targets.filter((row) => row.source === input.source && row.tenurity === input.tenurity).map((row) => row.version)) + 1; if (active) { active.status = 'INACTIVE'; const end = new Date(`${input.effectiveFrom}T00:00:00Z`); end.setUTCDate(end.getUTCDate() - 1); active.effectiveTo = end.toISOString().slice(0, 10); } const created: Target = { ...input, _id: crypto.randomUUID(), version, status: 'ACTIVE' }; store.targets.push(created); writeStore(store); return created; } const workspace = await getWorkspaceId(); const { data, error } = await supabase.rpc('create_target_version', { target_workspace: workspace, target_source: input.source, target_tenurity: input.tenurity, starts_on: input.effectiveFrom, target_revenue: input.revenue, target_login: input.login, target_demo: input.demo, target_license: input.license, target_pro_platform: input.proPlatform, target_arpl: input.arpl }); if (error) throw error; return mapTarget(data); }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET'; const url = new URL(path, 'https://local.invalid');
  if (url.pathname === '/executives') return await listExecutives() as T;
  if (url.pathname === '/monthly-mappings' && method === 'GET') return await listMappings(url.searchParams.get('month') ?? monthKey()) as T;
  if (url.pathname === '/monthly-mappings' && method === 'POST') return await saveMapping(payload(init)) as T;
  if (url.pathname === '/targets' && method === 'GET') return await listTargets() as T;
  if (url.pathname === '/targets/versions' && method === 'POST') return await createTarget(payload(init)) as T;
  const store = readStore();
  if (url.pathname === '/incentives/calculate' && method === 'POST') { const nextVersion = Math.max(0, ...store.incentives.map((row) => row.calculationVersion)) + 1; store.incentives = calculateIncentives(store.executives, store.targets, nextVersion); writeStore(store); return { month: monthKey(), calculationVersion: nextVersion, rows: store.incentives } as T; }
  if (url.pathname === '/incentives') return store.incentives as T;
  if (url.pathname === '/planning/weekly' && method === 'POST') { const week = weekKey(); if (!store.weeklySnapshots.includes(week)) store.weeklySnapshots.push(week); writeStore(store); return { period: week, executives: store.executives.length } as T; }
  if (url.pathname === '/planning/monthly' && method === 'POST') { const month = monthKey(); if (!store.monthlySnapshots.includes(month)) store.monthlySnapshots.push(month); writeStore(store); return { period: month, executives: store.executives.length } as T; }
  if (url.pathname === '/analytics/dashboard') { const target = store.incentives.reduce((sum, row) => sum + row.target, 0); const revenue = store.incentives.reduce((sum, row) => sum + row.eligibleRevenue, 0); const incentive = store.incentives.reduce((sum, row) => sum + row.incentive, 0); const trend = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setUTCMonth(date.getUTCMonth() - (5 - index)); const factor = 0.82 + index * 0.045; return { month: monthKey(date), target, revenue: Math.round(target * factor), incentive: Math.round(incentive * factor) }; }); return { activeExecutives: store.executives.filter((row) => row.active).length, month: monthKey(), target, revenue, incentive, trend } as T; }
  throw new Error(`Unsupported operation: ${method} ${path}`);
}
