import { gasApi } from './apps-script';

export type Executive = { _id: string; employeeId: string; name: string; email: string; doj: string; manager: string; source: string; tenurity: string; status: string; active: boolean };
export type MonthlyMapping = Executive & { mappingId: string; month: string; selectedWeeks: string[] };
export type MappingCandidate = Executive & { suggestedSource: string; suggestedTenurity: string; suggestedStatus: string; previousMonth: string; alreadyMapped: boolean; selectedWeeks: string[] };
export type Target = { _id: string; source: string; tenurity: string; version: number; effectiveFrom: string; effectiveTo?: string; revenue: number; login: number; demo: number; license: number; proPlatform: number; arpl: number; status: string };
export type MappingInput = { month: string; executiveId?: string; newExecutive?: Omit<Executive, '_id' | 'active'> };
export type TargetInput = Omit<Target, '_id' | 'version' | 'effectiveTo' | 'status'>;
export type MappingOverride = { executiveId: string; source?: string; tenurity?: string; status?: string; selectedWeeks: string[] };
export type MappingBatchInput = { month: string; executiveIds: string[]; newExecutives: Array<Omit<Executive, '_id' | 'active'>>; overrides: MappingOverride[]; defaultSelectedWeeks: string[] };

function payload(init: RequestInit) { return init.body ? JSON.parse(String(init.body)) : {}; }
function mapExecutive(row: any): Executive { return { ...row, _id: row.id }; }
function mapCandidate(row: any): MappingCandidate { return { ...row, _id: row.id, selectedWeeks: Array.isArray(row.selectedWeeks) ? row.selectedWeeks : [] }; }
function mapMapping(row: any): MonthlyMapping { return { ...row, _id: row.executiveId, mappingId: row.id, doj: '', active: row.status === 'ACTIVE', selectedWeeks: Array.isArray(row.selectedWeeks) ? row.selectedWeeks : [] }; }
function mapTarget(row: any): Target { return { ...row, _id: row.id, effectiveTo: row.effectiveTo || undefined, revenue: Number(row.revenue), login: Number(row.login), demo: Number(row.demo), license: Number(row.license), proPlatform: Number(row.proPlatform), arpl: Number(row.arpl) }; }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const url = new URL(path, 'https://local.invalid');
  if (url.pathname === '/executives') return (await gasApi<any[]>('executives.list')).map(mapExecutive) as T;
  if (url.pathname === '/mapping-candidates') return (await gasApi<any[]>('mappings.candidates', { month: url.searchParams.get('month') ?? '' })).map(mapCandidate) as T;
  if (url.pathname === '/monthly-mappings' && method === 'GET') return (await gasApi<any[]>('mappings.list', { month: url.searchParams.get('month') ?? '' })).map(mapMapping) as T;
  if (url.pathname === '/monthly-mappings/batch' && method === 'POST') return (await gasApi<any[]>('mappings.batch', payload(init))).map(mapMapping) as T;
  if (url.pathname === '/targets' && method === 'GET') return (await gasApi<any[]>('targets.list')).map(mapTarget) as T;
  if (url.pathname === '/targets/versions/batch' && method === 'POST') return (await gasApi<any[]>('targets.batch', { targets: payload(init) })).map(mapTarget) as T;
  if (url.pathname === '/incentives' && method === 'GET') return gasApi<T>('incentives.list', { month: url.searchParams.get('month') ?? '' });
  if (url.pathname === '/incentives/calculate' && method === 'POST') return gasApi<T>('incentives.calculate', { month: url.searchParams.get('month') ?? '' });
  if (url.pathname === '/incentives/export' && method === 'POST') return gasApi<T>('incentives.export', { month: url.searchParams.get('month') ?? '' });
  if (url.pathname === '/planning/weekly' && method === 'POST') return gasApi<T>('planning.generate', { kind: 'weekly' });
  if (url.pathname === '/planning/monthly' && method === 'POST') return gasApi<T>('planning.generate', { kind: 'monthly' });
  if (url.pathname === '/analytics/dashboard') return gasApi<T>('analytics.dashboard');
  throw new Error(`Unsupported operation: ${method} ${path}`);
}
