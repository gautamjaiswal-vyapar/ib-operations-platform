import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabaseConfigured = Boolean(url && key);
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

let workspacePromise: Promise<string> | null = null;
export function getWorkspaceId(): Promise<string> {
  if (!supabase) return Promise.reject(new Error('Supabase is not configured.'));
  if (!workspacePromise) workspacePromise = (async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }
    const { data, error } = await supabase.rpc('bootstrap_workspace', { workspace_name: 'IB Operations' });
    if (error) throw error;
    return String(data);
  })();
  return workspacePromise;
}
