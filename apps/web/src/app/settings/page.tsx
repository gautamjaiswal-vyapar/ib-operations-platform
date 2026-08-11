'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw } from 'lucide-react';
import { exportStore, resetStore } from '@/lib/api';

export default function Page() {
  const queryClient = useQueryClient();
  function reset() { resetStore(); void queryClient.invalidateQueries(); }
  function download() { const blob = new Blob([exportStore()], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'ib-operations-backup.json'; link.click(); URL.revokeObjectURL(link.href); }
  return <><h2 className="text-2xl font-bold">Local configuration</h2><p className="mb-6 text-slate-500">This GitHub Pages edition stores demonstration data only in this browser. No credentials or external services are used.</p><div className="grid gap-5 md:grid-cols-2"><div className="card"><Download className="text-blue-700"/><h3 className="mt-3 font-semibold">Export browser data</h3><p className="my-3 text-sm text-slate-500">Download a JSON backup of the executives, targets, snapshots, and incentives currently stored on this device.</p><button className="btn" onClick={download}>Download backup</button></div><div className="card"><RotateCcw className="text-amber-700"/><h3 className="mt-3 font-semibold">Reset demonstration data</h3><p className="my-3 text-sm text-slate-500">Replace local changes with a fresh demonstration dataset.</p><button className="btn-secondary" onClick={reset}>Reset data</button></div></div></>;
}
