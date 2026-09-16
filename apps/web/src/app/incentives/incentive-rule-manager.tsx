'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CirclePlus, Save, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { api, CreateIncentiveRuleVersion, IncentiveRuleLevel, IncentiveRuleResponse, IncentiveRuleSet } from '@/lib/api';
import { money } from '@/lib/utils';

type DraftSlab = { thresholdPercent: number; amount: number };

const localDate = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function nextDate(value: string) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function label(level: IncentiveRuleLevel) { if (level === 'AGENT') return 'Agent incentive'; if (level === 'TEAM_LEAD') return 'TL milestone'; if (level === 'TL_INCENTIVE') return 'TL incentive'; if (level === 'BONUS_4_WEEK') return 'Agent 4-week bonus'; if (level === 'BONUS_5_WEEK') return 'Agent 5-week bonus'; return 'TL bonus'; }
function isBonusLevel(level: IncentiveRuleLevel) { return level === 'BONUS_4_WEEK' || level === 'BONUS_5_WEEK' || level === 'TL_BONUS'; }
function statusClass(status: IncentiveRuleSet['status']) { if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700'; if (status === 'SCHEDULED') return 'bg-blue-50 text-blue-700'; if (status === 'ARCHIVED') return 'bg-slate-100 text-slate-600'; return 'bg-amber-50 text-amber-800'; }

export function IncentiveRuleManager() {
  const auth = useAuth(); const queryClient = useQueryClient();
  const [level, setLevel] = useState<IncentiveRuleLevel>('AGENT'); const [slabs, setSlabs] = useState<DraftSlab[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(localDate()); const [effectiveTo, setEffectiveTo] = useState(''); const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false); const [notice, setNotice] = useState('');
  const rules = useQuery({ queryKey: ['incentive-rules'], enabled: Boolean(auth.session), queryFn: () => api<IncentiveRuleResponse>('/incentives/rules') });
  const bonusLevel = isBonusLevel(level);
  const current = level === 'AGENT' ? rules.data?.agent : level === 'TEAM_LEAD' ? rules.data?.teamLead : level === 'TL_INCENTIVE' ? rules.data?.tlIncentive : level === 'BONUS_4_WEEK' ? rules.data?.fourWeekBonus : level === 'BONUS_5_WEEK' ? rules.data?.fiveWeekBonus : rules.data?.tlBonus;
  const history = (rules.data?.history ?? []).filter((rule) => rule.level === level);
  const latest = history[0] ?? current;

  useEffect(() => {
    if (!latest) return;
    setSlabs(latest.slabs.map((slab) => ({ thresholdPercent: bonusLevel ? slab.threshold : slab.threshold * 100, amount: slab.amount })));
    const minimum = latest.version > 0 ? nextDate(latest.effectiveFrom) : localDate(); setEffectiveFrom(minimum > localDate() ? minimum : localDate());
    setEffectiveTo(''); setReason(''); setConfirmed(false); setNotice('');
  }, [bonusLevel, latest, level]);

  const validation = useMemo(() => {
    if (!slabs.length) return 'Add at least one slab.';
    const sorted = [...slabs].sort((a, b) => a.thresholdPercent - b.thresholdPercent);
    if (sorted.some((slab) => !Number.isFinite(slab.thresholdPercent) || slab.thresholdPercent < 0 || bonusLevel && (!Number.isInteger(slab.thresholdPercent) || slab.thresholdPercent > 5) || !bonusLevel && slab.thresholdPercent > 10000)) return bonusLevel ? 'Qualified weeks must be whole numbers from 0 to 5.' : 'Thresholds must be between 0% and 10,000%.';
    if (sorted.some((slab) => !Number.isFinite(slab.amount) || slab.amount < 0 || !Number.isInteger(slab.amount))) return 'Incentive amounts must be whole numbers of zero or greater.';
    if (sorted.some((slab, index) => index > 0 && slab.thresholdPercent === sorted[index - 1].thresholdPercent)) return 'Every threshold must be unique.';
    if (!effectiveFrom) return 'Effective from is required.';
    if (effectiveTo && effectiveTo < effectiveFrom) return 'Effective till cannot be before Effective from.';
    if (reason.trim().length < 5) return 'Enter a reason with at least 5 characters.';
    return '';
  }, [bonusLevel, effectiveFrom, effectiveTo, reason, slabs]);

  const save = useMutation({
    mutationFn: () => {
      if (validation) throw new Error(validation);
      const body: CreateIncentiveRuleVersion = { level, effectiveFrom, effectiveTo: effectiveTo || undefined, reason: reason.trim(), slabs: [...slabs].sort((a, b) => a.thresholdPercent - b.thresholdPercent) };
      return api<IncentiveRuleSet>('/incentives/rules', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: async (created) => { await queryClient.invalidateQueries({ queryKey: ['incentive-rules'] }); setNotice(`${label(created.level)} rule version ${created.version} published.`); setConfirmed(false); },
  });

  function update(index: number, field: keyof DraftSlab, value: number) { setSlabs((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)); setConfirmed(false); setNotice(''); }
  function remove(index: number) { setSlabs((rows) => rows.filter((_, rowIndex) => rowIndex !== index)); setConfirmed(false); setNotice(''); }
  function add() { const maximum = slabs.reduce((value, slab) => Math.max(value, slab.thresholdPercent), 0); setSlabs((rows) => [...rows, { thresholdPercent: maximum + (bonusLevel ? 1 : 10), amount: 0 }]); setConfirmed(false); setNotice(''); }
  return <div className="space-y-5">
    <section className="card p-0">
      <div className="border-b px-5 pt-5"><div><h3 className="text-lg font-semibold">Incentive and bonus rule versions</h3><p className="mt-1 text-sm text-slate-500">Rules use the highest completed threshold and award its exact value. Publishing never overwrites a historical version.</p></div><div role="tablist" aria-label="Incentive rule level" className="mt-5 flex flex-wrap gap-x-6 gap-y-2">{(['AGENT', 'TEAM_LEAD', 'TL_INCENTIVE', 'BONUS_4_WEEK', 'BONUS_5_WEEK', 'TL_BONUS'] as IncentiveRuleLevel[]).map((value) => <button key={value} type="button" role="tab" aria-selected={level === value} onClick={() => setLevel(value)} className={`cursor-pointer border-b-2 px-1 pb-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${level === value ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label(value)}</button>)}</div></div>
      <div role="tabpanel" className="p-5">
        {rules.isLoading && <div className="min-h-24 py-8 text-center text-sm text-slate-500">Loading slab rules…</div>}
        {rules.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{rules.error.message}</p>}
        {current && <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current calculation rule</p><p className="mt-1 font-semibold">{current.version ? `Version ${current.version}` : 'System default'} · {current.effectiveFrom} to {current.effectiveTo || 'Current'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(current.status)}`}>{current.status.replace('_', ' ')}</span></div><div className="mt-3 flex flex-wrap gap-2">{current.slabs.map((slab) => <span key={slab.threshold} className="rounded-lg border bg-white px-3 py-2 text-sm"><b>{bonusLevel ? `${slab.threshold} qualifying week${slab.threshold === 1 ? '' : 's'}` : `${slab.threshold * 100}%+`}</b> → {money(slab.amount)}</span>)}</div></div>}

        {auth.isAdmin ? <form noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); if (confirmed && !validation) save.mutate(); }}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">Publish {label(level)} rule version {(latest?.version ?? 0) + 1}</h4><p className="mt-1 text-sm text-slate-500">The draft starts from the latest saved version. The highest completed threshold receives its exact amount; values are never interpolated or proportionally scaled.</p></div><button type="button" className="btn-secondary gap-2" onClick={add}><CirclePlus size={16} />Add slab</button></div>
          <div className="mt-4 overflow-auto rounded-xl border"><table className="min-w-[620px]"><caption className="sr-only">Draft {label(level)} slabs</caption><thead><tr><th>{bonusLevel ? 'Qualified weeks' : 'Completed achievement threshold'}</th><th>{bonusLevel ? 'Bonus amount' : 'Incentive amount'}</th><th className="w-24">Action</th></tr></thead><tbody>{[...slabs].sort((a, b) => a.thresholdPercent - b.thresholdPercent).map((slab) => { const originalIndex = slabs.indexOf(slab); return <tr key={`${originalIndex}-${slab.thresholdPercent}`}><td><label className="sr-only" htmlFor={`${level}-threshold-${originalIndex}`}>{bonusLevel ? 'Qualified weeks' : 'Achievement threshold percentage'}</label><div className="flex items-center gap-2"><input id={`${level}-threshold-${originalIndex}`} className="w-32" type="number" min="0" max={bonusLevel ? 5 : 10000} step={bonusLevel ? 1 : 0.01} value={slab.thresholdPercent} onChange={(event) => update(originalIndex, 'thresholdPercent', Number(event.target.value))} /><span className="text-slate-500">{bonusLevel ? 'weeks and above' : '% and above'}</span></div></td><td><label className="sr-only" htmlFor={`${level}-amount-${originalIndex}`}>{bonusLevel ? 'Bonus amount' : 'Incentive amount'}</label><input id={`${level}-amount-${originalIndex}`} className="w-40" type="number" min="0" step="1" value={slab.amount} onChange={(event) => update(originalIndex, 'amount', Number(event.target.value))} /></td><td><button type="button" aria-label={`Remove threshold ${slab.thresholdPercent}`} className="cursor-pointer rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-40" disabled={slabs.length === 1} onClick={() => remove(originalIndex)}><Trash2 size={16} /></button></td></tr>; })}</tbody></table></div>
          <div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold">Effective from<input className="mt-1 w-full" type="date" value={effectiveFrom} onChange={(event) => { setEffectiveFrom(event.target.value); setConfirmed(false); }} /></label><label className="text-sm font-semibold">Effective till <span className="font-normal text-slate-400">(optional)</span><input className="mt-1 w-full" type="date" min={effectiveFrom} value={effectiveTo} onChange={(event) => { setEffectiveTo(event.target.value); setConfirmed(false); }} /></label><label className="text-sm font-semibold">Reason for change<input className="mt-1 w-full" value={reason} onChange={(event) => { setReason(event.target.value); setConfirmed(false); }} placeholder="Example: FY27 incentive policy" /></label></div>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>Financial rule confirmation</b><p className="mt-1">This publishes a complete {label(level)} rule version from {effectiveFrom || 'the selected date'}{effectiveTo ? ` through ${effectiveTo}` : ' with no end date'}. The preceding version will close the day before this one begins.</p><label className="mt-3 flex items-start gap-2 font-semibold"><input type="checkbox" checked={confirmed} disabled={Boolean(validation)} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed every threshold, amount, effective date, and the impact on future calculations.</label></div>
          {validation && <p className="mt-3 text-sm text-amber-800">{validation}</p>}{save.error && <p role="alert" className="mt-3 text-sm text-red-700">{save.error.message}</p>}{notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}
          <div className="mt-4 flex justify-end"><button className="btn min-w-44 gap-2" disabled={!confirmed || Boolean(validation) || save.isPending}><Save size={16} />{save.isPending ? 'Publishing…' : 'Publish new version'}</button></div>
        </form> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">You can review slab rules. OWNER or ADMIN access is required to publish a new version.</p>}
      </div>
    </section>

    <section className="card p-0"><div className="border-b p-5"><h3 className="font-semibold">{label(level)} rule history</h3><p className="mt-1 text-sm text-slate-500">Every calculation resolves the version effective for its calculation period.</p></div><div className="overflow-auto"><table className="min-w-[760px]"><caption className="sr-only">{label(level)} rule version history</caption><thead><tr><th>Version</th><th>Effective period</th><th>Status</th><th>Slabs</th><th>Reason</th><th>Created by</th></tr></thead><tbody>{history.map((rule) => <tr key={`${rule.level}-${rule.version}-${rule.effectiveFrom}`}><td className="font-semibold">{rule.version ? `v${rule.version}` : 'Default'}</td><td>{rule.effectiveFrom} → {rule.effectiveTo || 'Current'}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(rule.status)}`}>{rule.status.replace('_', ' ')}</span></td><td>{rule.slabs.map((slab) => `${bonusLevel ? `${slab.threshold} weeks` : `${slab.threshold * 100}%`}: ${money(slab.amount)}`).join(' · ')}</td><td>{rule.reason || '—'}</td><td>{rule.createdBy || 'System'}</td></tr>)}</tbody></table>{!rules.isLoading && !history.length && <p className="p-6 text-center text-sm text-slate-500">No saved rule versions yet.</p>}</div></section>
  </div>;
}
