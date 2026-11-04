const iptApiUrl = process.env.NEXT_PUBLIC_IPT_API_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';
const IPT_SESSION_KEY = 'ipt-dashboard-session';

type Envelope<T> = { ok: boolean; data?: T; error?: { status: number; message: string } };

export function getIptSession() { return typeof window === 'undefined' ? '' : sessionStorage.getItem(IPT_SESSION_KEY) || ''; }
export function setIptSession(token: string) { sessionStorage.setItem(IPT_SESSION_KEY, token); }
export function clearIptSession() { sessionStorage.removeItem(IPT_SESSION_KEY); }

export async function iptApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!iptApiUrl) throw new Error('The IPT data service is not configured.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(iptApiUrl, { method: 'POST', redirect: 'follow', signal: controller.signal, headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload }) });
    if (!response.ok) throw new Error(`The IPT data service returned ${response.status}.`);
    const body = await response.json() as Envelope<T>;
    if (!body.ok) throw new Error(body.error?.message || 'The IPT data service could not complete the request.');
    return body.data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The IPT data service timed out. Retry once.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}
