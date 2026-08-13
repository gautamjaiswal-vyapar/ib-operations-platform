'use client';

import { CheckCircle2, Database, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PlatformUser } from './auth-provider';

type Props = { user?: PlatformUser | null; countdown?: number; onContinue?: () => void; verifying?: boolean };
const cells = Array.from({ length: 16 }, (_, index) => index);

export function WorkspaceLoader({ user, countdown = 0, onContinue, verifying = false }: Props) {
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState(5);
  const authenticated = Boolean(user);
  useEffect(() => { if (!authenticated) return; const timer = window.setInterval(() => setTarget((current) => (current + 7) % cells.length), 900); return () => window.clearInterval(timer); }, [authenticated]);
  function collect() { setScore((current) => current + 1); setTarget((current) => (current + 5) % cells.length); }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-white">
    <div className="absolute left-[12%] top-[14%] h-52 w-52 rounded-full bg-blue-600/20 blur-3xl" />
    <div className="absolute bottom-[10%] right-[10%] h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
    <section className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl backdrop-blur md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.24em] text-blue-300">IB OPERATIONS PLATFORM</p><div className="mt-4 flex items-center gap-3">{authenticated ? <CheckCircle2 className="text-emerald-400" size={34} aria-hidden="true" /> : <Database className="animate-pulse text-blue-400" size={34} aria-hidden="true" />}<div><h1 className="text-2xl font-bold md:text-3xl">{authenticated ? 'Sign-in successful' : verifying ? 'Verifying secure session' : 'Preparing your workspace'}</h1><p className="mt-1 text-sm text-slate-400">{authenticated ? `Welcome, ${user?.fullName || user?.email}.` : 'Loading identity, permissions, and operational data.'}</p></div></div></div>{authenticated && <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">{user?.role} access confirmed</span>}</div>
      <div className="mt-7 h-2 overflow-hidden rounded-full bg-slate-800" aria-label="Workspace loading progress"><div className={`h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 ${authenticated ? 'workspace-progress' : 'workspace-progress-indeterminate'}`} /></div>
      {authenticated ? <div className="mt-8 grid gap-6 md:grid-cols-[1fr_250px] md:items-center"><div><div className="flex items-center gap-2"><Sparkles className="text-amber-300" size={18} /><h2 className="font-semibold">Quick challenge: collect data pulses</h2></div><p className="mt-2 text-sm leading-6 text-slate-400">Click the moving pulse—or focus it and press Enter—while your dashboard finishes loading.</p><div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 p-3" aria-label="Data pulse mini-game">{cells.map((cell) => <div key={cell} className="grid aspect-square place-items-center rounded-lg bg-slate-900">{cell === target && <button type="button" onClick={collect} aria-label="Collect data pulse" className="h-8 w-8 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_24px_rgba(34,211,238,.85)] transition hover:scale-110 focus:outline-none focus:ring-4 focus:ring-cyan-200/30" />}</div>)}</div></div><div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5 text-center"><p className="text-sm text-slate-400">Pulses collected</p><p className="mt-2 text-5xl font-bold text-cyan-300">{score}</p><p className="mt-5 text-sm text-slate-400">Opening workspace in <b className="text-white">{countdown}</b>s</p>{onContinue && <button type="button" className="btn mt-4 w-full" onClick={onContinue}>Continue now</button>}</div></div> : <div className="mt-8 grid gap-3 sm:grid-cols-3">{['Secure session', 'Role permissions', 'Workspace data'].map((label, index) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"><div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full animate-pulse rounded-full bg-blue-500" style={{ width: `${45 + index * 20}%` }} /></div><p className="text-sm text-slate-300">{label}</p></div>)}</div>}
    </section>
  </main>;
}
