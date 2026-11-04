'use client';

import { Activity, ArrowUpRight, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react';

const dashboardUrl = process.env.NEXT_PUBLIC_IPT_AGENT_DASHBOARD_URL ?? '';
const isConfigured = dashboardUrl.startsWith('https://script.google.com/');

export default function AgentPerformancePage() {
  const openDashboard = () => {
    if (!isConfigured) {
      window.alert('The IPT Agent Performance endpoint has not been configured.');
      return;
    }

    window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-6xl items-center py-6">
      <section className="relative w-full overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 text-slate-50 shadow-2xl shadow-slate-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.2),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.16),transparent_40%)]" />
        <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.35fr_0.65fr] lg:p-14">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1.5 text-sm font-medium text-teal-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Workspace protected
            </div>
            <div className="flex items-start gap-4">
              <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-teal-300">
                <Activity className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-teal-300">IPT operations</p>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Agent performance dashboard</h1>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Review performance by month, week, or day, compare targets, and drill from team leads into their agent distribution.
            </p>
            <button
              type="button"
              onClick={openDashboard}
              disabled={!isConfigured}
              className="mt-9 inline-flex items-center gap-2 rounded-xl bg-teal-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              Open dashboard
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {!isConfigured && <p className="mt-3 text-sm text-amber-300">Set the IPT_AGENT_DASHBOARD_URL repository variable before deployment.</p>}
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur">
            <div className="flex gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-white">Protected data path</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Employee data stays in Google Sheets and Apps Script. The public Pages build contains only the protected application URL.</p>
              </div>
            </div>
            <div className="my-6 h-px bg-white/10" />
            <div className="flex gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-white">Four-hour refresh window</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Cached data refreshes at 10:00, 14:00, 18:00, and 22:00 IST. The dashboard displays the latest successful refresh time.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
