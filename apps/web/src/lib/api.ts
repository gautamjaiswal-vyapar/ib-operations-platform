type Executive = { _id: string; employeeId: string; name: string; email: string; doj: string; source: string; tenurity: string; status: string; active: boolean };
type Target = { _id: string; source: string; tenurity: string; version: number; effectiveFrom: string; revenue: number; status: string };
type Incentive = { _id: string; executive: { name: string }; target: number; eligibleRevenue: number; achievement: number; bonus: number; incentive: number; calculationVersion: number };
type Store = { executives: Executive[]; targets: Target[]; incentives: Incentive[]; weeklySnapshots: string[]; monthlySnapshots: string[]; updatedAt: string };

const STORAGE_KEY = 'ib-operations-platform-v2';

function monthKey(date = new Date()) { return date.toISOString().slice(0, 7); }
function weekKey(date = new Date()) { const value = new Date(date); const day = value.getUTCDay(); value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1)); return value.toISOString().slice(0, 10); }
function tenurity(doj: string) { const start = new Date(doj); const now = new Date(); const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth(); return months <= 0 ? 'M0' : months === 1 ? 'M1' : 'M1+'; }
function monthsAgo(months: number) { const date = new Date(); date.setUTCMonth(date.getUTCMonth() - months); return date.toISOString().slice(0, 10); }

function initialStore(): Store {
  const executives = [
    { _id: 'exec-1', employeeId: 'IB001', name: 'Aarav Sharma', email: 'aarav@example.com', doj: monthsAgo(0), source: 'Inbound', tenurity: '', status: 'ACTIVE', active: true },
    { _id: 'exec-2', employeeId: 'IB002', name: 'Diya Patel', email: 'diya@example.com', doj: monthsAgo(1), source: 'Outbound', tenurity: '', status: 'ACTIVE', active: true },
    { _id: 'exec-3', employeeId: 'IB003', name: 'Kabir Singh', email: 'kabir@example.com', doj: monthsAgo(4), source: 'Inbound', tenurity: '', status: 'ACTIVE', active: true },
    { _id: 'exec-4', employeeId: 'IB004', name: 'Meera Iyer', email: 'meera@example.com', doj: monthsAgo(8), source: 'Partner', tenurity: '', status: 'ACTIVE', active: true }
  ].map((row) => ({ ...row, tenurity: tenurity(row.doj) }));
  const targets: Target[] = ['Inbound', 'Outbound', 'Partner'].flatMap((source, sourceIndex) => ['M0', 'M1', 'M1+'].map((tier, tierIndex) => ({
    _id: `target-${sourceIndex}-${tierIndex}`, source, tenurity: tier, version: 1, effectiveFrom: '2024-01-01', revenue: 75000 + sourceIndex * 15000 + tierIndex * 25000, status: 'ACTIVE'
  })));
  const incentives = calculateIncentives(executives, targets, 1);
  return { executives, targets, incentives, weeklySnapshots: [weekKey()], monthlySnapshots: [monthKey()], updatedAt: new Date().toISOString() };
}

function calculateIncentives(executives: Executive[], targets: Target[], version: number): Incentive[] {
  return executives.filter((row) => row.active).map((executive, index) => {
    const target = targets.find((row) => row.source === executive.source && row.tenurity === executive.tenurity && row.status === 'ACTIVE');
    const targetValue = target?.revenue ?? 100000;
    const eligibleRevenue = Math.round(targetValue * (0.82 + index * 0.11));
    const achievement = targetValue ? eligibleRevenue / targetValue : 0;
    const rate = achievement >= 1.2 ? 0.04 : achievement >= 1 ? 0.025 : 0;
    const bonus = Math.max(eligibleRevenue - targetValue, 0) * rate;
    return { _id: `${monthKey()}-${executive._id}-v${version}`, executive: { name: executive.name }, target: targetValue, eligibleRevenue, achievement, bonus, incentive: eligibleRevenue * rate + bonus, calculationVersion: version };
  });
}

export function readStore(): Store {
  if (typeof window === 'undefined') return initialStore();
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) { const seeded = initialStore(); writeStore(seeded); return seeded; }
  try { return JSON.parse(value) as Store; } catch { const seeded = initialStore(); writeStore(seeded); return seeded; }
}

export function writeStore(store: Store) { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, updatedAt: new Date().toISOString() })); }
export function resetStore() { const store = initialStore(); writeStore(store); return store; }
export function exportStore() { return JSON.stringify(readStore(), null, 2); }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  await Promise.resolve();
  const store = readStore();
  const method = init.method ?? 'GET';
  if (path === '/executives') return store.executives as T;
  if (path.startsWith('/targets')) return store.targets as T;
  if (path.startsWith('/incentives/calculate') && method === 'POST') {
    const nextVersion = Math.max(0, ...store.incentives.map((row) => row.calculationVersion)) + 1;
    store.incentives = calculateIncentives(store.executives, store.targets, nextVersion); writeStore(store);
    return { month: monthKey(), calculationVersion: nextVersion, rows: store.incentives } as T;
  }
  if (path.startsWith('/incentives')) return store.incentives as T;
  if (path.startsWith('/planning/weekly') && method === 'POST') { const week = weekKey(); if (!store.weeklySnapshots.includes(week)) store.weeklySnapshots.push(week); writeStore(store); return { period: week, executives: store.executives.length } as T; }
  if (path.startsWith('/planning/monthly') && method === 'POST') { const month = monthKey(); if (!store.monthlySnapshots.includes(month)) store.monthlySnapshots.push(month); writeStore(store); return { period: month, executives: store.executives.length } as T; }
  if (path === '/analytics/dashboard') {
    const target = store.incentives.reduce((sum, row) => sum + row.target, 0);
    const revenue = store.incentives.reduce((sum, row) => sum + row.eligibleRevenue, 0);
    const incentive = store.incentives.reduce((sum, row) => sum + row.incentive, 0);
    const trend = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setUTCMonth(date.getUTCMonth() - (5 - index)); const factor = 0.82 + index * 0.045; return { month: monthKey(date), target, revenue: Math.round(target * factor), incentive: Math.round(incentive * factor) }; });
    return { activeExecutives: store.executives.filter((row) => row.active).length, month: monthKey(), target, revenue, incentive, trend } as T;
  }
  if (path === '/auth/login') return { accessToken: 'local-static-session', refreshToken: 'local-static-session' } as T;
  throw new Error(`Unsupported local operation: ${method} ${path}`);
}
