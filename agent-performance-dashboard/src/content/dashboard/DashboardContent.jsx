import React, { useMemo, useState } from "react";
import { Chart, DataComponent, DataTable, Dropdown, SectionHeader, SegmentedControl, useDashboardTabs, useDataApp } from "../../data-app-public.jsx";
import "./dashboard.css";

const METRICS = [
  { id: "totalLeads", label: "Leads", short: "Leads" },
  { id: "totalLogins", label: "Logins", short: "Logins" },
  { id: "totalDemos", label: "Demos", short: "Demos" },
  { id: "totalConversions", label: "Conversions", short: "Conv." },
];
const PERIODS = [{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }];
const CURRENT_FIELDS = {
  day: { totalLeads: "dayLeads", totalLogins: "dayLogins", totalDemos: "dayDemos", totalConversions: "dayConversions" },
  week: { totalLeads: "weekLeads", totalLogins: "weekLogins", totalDemos: "weekDemos", totalConversions: "weekConversions" },
};
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const compactAgent = (email) => email === "all" ? "All agents" : email?.split("@")[0]?.replaceAll(".", " ") || "Unknown agent";
const compactLead = (email) => email?.split("@")[0]?.replaceAll(".", " ") || "Unknown team lead";
const monthLabel = (value) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const periodLabel = (grain, value) => grain === "month" ? monthLabel(value) : grain === "week" ? `Week of ${shortDateFormat.format(new Date(`${value}T00:00:00Z`))}` : dateFormat.format(new Date(`${value}T00:00:00Z`));
const periodNoun = (grain) => PERIODS.find((item) => item.value === grain)?.label || "Month";

function currentPeriod(retrievedAt, grain) {
  const day = String(retrievedAt || new Date().toISOString()).slice(0, 10);
  if (grain === "day") return day;
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

function normalizePeriodRow(row) {
  const periodType = String(row.periodType || row.period_type || "").toUpperCase();
  return {
    ...row,
    periodType,
    period: String(row.period || row.period_start || "").slice(0, 10),
    agentEmail: row.agentEmail || row.month_agent_email || "",
    agentId: row.agentId || row.month_agent_id || "",
    teamLead: row.teamLead || row.month_team_lead || "",
    designation: row.designation || row.month_agent_designation || "",
    cluster: row.cluster || row.month_cluster_name || "",
    iptTeam: row.iptTeam || row.month_ipt_team || "",
    totalLeads: Number(row.leads ?? row.leads_created ?? 0),
    totalLogins: Number(row.logins ?? 0),
    totalDemos: Number(row.demos ?? 0),
    totalConversions: Number(row.conversions ?? 0),
  };
}

function scopePopulation(rows, level, selection) {
  return rows.filter((item) => level === "teamLead" ? item.teamLead === selection : selection === "all" || item.agentEmail === selection);
}

function aggregateRows(rows, level = "agent", selection = "all", fields = null) {
  const scoped = scopePopulation(rows, level, selection);
  const first = scoped[0] || {};
  const isAggregate = level === "teamLead" || selection === "all";
  const read = (item, metric) => Number(item?.[fields?.[metric] || metric] || 0);
  return {
    ...first,
    agentEmail: level === "agent" ? selection : "all",
    agentId: isAggregate ? `${level}:${selection}` : first.agentId,
    teamLead: level === "teamLead" ? selection : first.teamLead,
    designation: level === "teamLead" ? "Team lead aggregate" : selection === "all" ? "Administrator view" : first.designation,
    iptTeam: isAggregate ? [...new Set(scoped.map((item) => item.iptTeam).filter(Boolean))].join(" + ") || "IPT" : first.iptTeam,
    cluster: isAggregate ? `${new Set(scoped.map((item) => item.agentEmail)).size} agents in scope` : first.cluster,
    ...Object.fromEntries(METRICS.map(({ id }) => [id, scoped.reduce((sum, item) => sum + read(item, id), 0)])),
  };
}

function targetFor(targets, row, metric, month) {
  const match = targets.find((target) => target.month === month && target.metric === metric && (target.agentId === row.agentId || target.agentEmail === row.agentEmail));
  return Number.isFinite(Number(match?.target)) ? Number(match.target) : null;
}

function targetForScope(targets, scopedRows, metric, month) {
  const agents = [...new Map(scopedRows.map((item) => [item.agentEmail, item])).values()];
  if (!agents.length) return null;
  const values = agents.map((item) => targetFor(targets, item, metric, month));
  return values.every((value) => value != null) ? values.reduce((sum, value) => sum + value, 0) : null;
}

function MetricScore({ metric, actual, target, previous, comparisonLabel, active, onSelect }) {
  const attainment = target > 0 ? actual / target : null;
  const gap = target == null ? null : actual - target;
  const change = previous > 0 ? (actual - previous) / previous : null;
  return <button type="button" className="agent-metric" data-active={active || undefined} onClick={onSelect} aria-pressed={active}>
    <span className="agent-metric-label">{metric.label}</span><strong>{number.format(actual)}</strong>
    <span className="agent-metric-target">{target == null ? "Target not set" : `of ${number.format(target)} target`}</span>
    <span className="agent-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (attainment || 0) * 100)}%` }} /></span>
    <span className="agent-metric-foot" data-tone={gap == null ? "neutral" : gap >= 0 ? "positive" : "negative"}>{attainment == null ? "Awaiting reviewed target" : `${Math.round(attainment * 100)}% · ${gap >= 0 ? "+" : ""}${number.format(gap)} gap`}</span>
    <span className="agent-metric-change" data-tone={change == null ? "neutral" : change >= 0 ? "positive" : "negative"}>{change == null ? `Previous ${comparisonLabel} unavailable` : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change * 100).toFixed(1)}% vs previous ${comparisonLabel}`}</span>
  </button>;
}

function Funnel({ row }) {
  const steps = [["Leads", row.totalLeads], ["Logins", row.totalLogins], ["Demos", row.totalDemos], ["Conversions", row.totalConversions]];
  const max = Math.max(1, ...steps.map(([, value]) => value || 0));
  return <div className="agent-funnel" data-reviewed-rows>{steps.map(([label, value], index) => <div className="agent-funnel-step" key={label}>
    <div><span>{label}</span><strong>{number.format(value || 0)}</strong></div>
    <div className="agent-funnel-track"><i style={{ width: `${Math.max(2, (value || 0) / max * 100)}%` }} /></div>
    {index < steps.length - 1 && <small>{value > 0 ? `${Math.round((steps[index + 1][1] || 0) / value * 100)}% to next step` : "No eligible volume"}</small>}
  </div>)}</div>;
}

export function DashboardContent() {
  useDashboardTabs([{ id: "performance", label: "Performance" }]);
  const { queries, chartOverrides, chartProps } = useDataApp();
  const allRows = queries.agent_performance?.rows || [];
  const dedicatedHistoryRows = queries.agent_performance_history?.rows || [];
  const periodRows = useMemo(() => (dedicatedHistoryRows.length ? dedicatedHistoryRows : allRows).map(normalizePeriodRow).filter((row) => ["DAY", "WEEK", "MONTH"].includes(row.periodType) && row.period), [allRows, dedicatedHistoryRows]);
  const hasPeriodHistory = periodRows.length > 0;
  const targets = queries.target_configuration?.rows || [];
  const months = useMemo(() => [...new Set((hasPeriodHistory ? periodRows.filter((row) => row.periodType === "MONTH").map((row) => row.period) : allRows.map((row) => row.month)).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [allRows, hasPeriodHistory, periodRows]);
  const populationRows = hasPeriodHistory ? periodRows : allRows;
  const agents = useMemo(() => [...new Set(populationRows.map((row) => row.agentEmail).filter(Boolean))].sort(), [populationRows]);
  const teamLeads = useMemo(() => [...new Set(populationRows.map((row) => row.teamLead).filter(Boolean))].sort(), [populationRows]);
  const retrievedAt = queries.agent_performance?.source?.retrievedAt;
  const historicalChoices = (type) => [...new Set(periodRows.filter((row) => row.periodType === type).map((row) => row.period))].sort((a, b) => b.localeCompare(a));
  const choicesByGrain = hasPeriodHistory ? { month: historicalChoices("MONTH"), week: historicalChoices("WEEK"), day: historicalChoices("DAY") } : { month: months, week: [currentPeriod(retrievedAt, "week")], day: [currentPeriod(retrievedAt, "day")] };
  const [grain, setGrain] = useState("month");
  const [selectedPeriods, setSelectedPeriods] = useState(() => ({ month: months[0], week: currentPeriod(retrievedAt, "week"), day: currentPeriod(retrievedAt, "day") }));
  const [level, setLevel] = useState("agent");
  const [agent, setAgent] = useState("all");
  const [teamLead, setTeamLead] = useState(teamLeads[0]);
  const [metricId, setMetricId] = useState("totalConversions");
  const [showDistribution, setShowDistribution] = useState(false);
  const periodChoices = choicesByGrain[grain];
  const selectedPeriod = periodChoices.includes(selectedPeriods[grain]) ? selectedPeriods[grain] : periodChoices[0];
  const activeAgent = agent === "all" || agents.includes(agent) ? agent : "all";
  const activeTeamLead = teamLeads.includes(teamLead) ? teamLead : teamLeads[0];
  const selection = level === "teamLead" ? activeTeamLead : activeAgent;
  const selectedRows = hasPeriodHistory ? periodRows.filter((item) => item.periodType === grain.toUpperCase() && item.period === selectedPeriod) : grain === "month" ? allRows.filter((item) => item.month === selectedPeriod) : allRows;
  const valueFields = hasPeriodHistory || grain === "month" ? null : CURRENT_FIELDS[grain];
  const row = aggregateRows(selectedRows, level, selection, valueFields);
  const metric = METRICS.find((item) => item.id === metricId) || METRICS[0];
  const subjectLabel = level === "teamLead" ? compactLead(activeTeamLead) : compactAgent(activeAgent);
  const selectedPopulationRows = scopePopulation(selectedRows, level, selection);
  const subjectTarget = (metricName) => grain === "month" ? targetForScope(targets, selectedPopulationRows, metricName, selectedPeriod) : null;
  const scoreRows = METRICS.map((item) => ({ metric: item.label, actual: Number(row[item.id] || 0), target: subjectTarget(item.id) }));
  const seriesPeriods = choicesByGrain[grain].slice().sort();
  const rowsForPeriod = (period) => hasPeriodHistory ? periodRows.filter((item) => item.periodType === grain.toUpperCase() && item.period === period) : grain === "month" ? allRows.filter((item) => item.month === period) : allRows;
  const aggregateForPeriod = (period) => aggregateRows(rowsForPeriod(period), level, selection, hasPeriodHistory || grain === "month" ? null : CURRENT_FIELDS[grain]);
  const trendRows = seriesPeriods.map((period) => ({ period, periodDisplay: periodLabel(grain, period), actual: Number(aggregateForPeriod(period)[metric.id] || 0), target: grain === "month" ? targetForScope(targets, scopePopulation(rowsForPeriod(period), level, selection), metric.id, period) : null }));
  const selectedTrendIndex = trendRows.findIndex((item) => item.period === selectedPeriod);
  const previousPeriod = selectedTrendIndex > 0 ? trendRows[selectedTrendIndex - 1].period : null;
  const previousRow = previousPeriod ? aggregateForPeriod(previousPeriod) : null;
  const trendSpec = chartOverrides["metric-progress"] ?? { type: "area", x: "periodDisplay", y: "actual", fields: ["actual", "target"], colors: { actual: "var(--chart-1)", target: "var(--chart-4)" }, legend: { labels: { actual: "Achievement", target: "Target" } }, showLegend: true, startAtZero: true, showXAxisLabel: false, showYAxisLabel: false };
  const comparisonSpec = chartOverrides["target-comparison"] ?? { type: "bar", x: "metric", y: "actual", fields: ["actual", "target"], colors: { actual: "var(--chart-1)", target: "var(--chart-4)" }, legend: { labels: { actual: "Actual", target: "Target" } }, showLegend: true, startAtZero: true, showXAxisLabel: false, showYAxisLabel: false };
  const rosterRows = level === "teamLead" ? selectedRows.filter((item) => item.teamLead === activeTeamLead) : selectedRows;
  const rosterAgents = [...new Set(rosterRows.map((item) => item.agentEmail).filter(Boolean))].sort();
  const tableRows = rosterAgents.map((agentEmail) => {
    const item = aggregateRows(selectedRows, "agent", agentEmail, valueFields);
    const leads = item.totalLeads, logins = item.totalLogins, demos = item.totalDemos, conversions = item.totalConversions;
    return { ...item, agentName: compactAgent(item.agentEmail), teamLeadName: compactLead(item.teamLead), displayLeads: leads, displayLogins: logins, displayDemos: demos, displayConversions: conversions, loginRateDisplay: leads > 0 ? logins / leads : null, demoRateDisplay: logins > 0 ? demos / logins : null, conversionRateDisplay: demos > 0 ? conversions / demos : null };
  });
  const displayMetricKey = { totalLeads: "displayLeads", totalLogins: "displayLogins", totalDemos: "displayDemos", totalConversions: "displayConversions" }[metricId];
  const distributionRows = tableRows.map((item) => ({ agent: item.agentName, value: Number(item[displayMetricKey] || 0) })).sort((a, b) => b.value - a.value);
  const distributionSpec = chartOverrides["agent-distribution"] ?? { type: "horizontalBar", x: "agent", y: "value", colors: { value: "var(--chart-1)" }, startAtZero: true, showLegend: false, showXAxisLabel: false, showYAxisLabel: false };
  const scope = [{ field: "periodType", label: "Period type", value: grain.toUpperCase() }, { field: "period", label: periodNoun(grain), value: selectedPeriod }, level === "teamLead" ? { field: "teamLead", label: "Team lead", value: activeTeamLead } : { field: "agentEmail", label: "Agent", value: activeAgent }];
  const historyQueryId = dedicatedHistoryRows.length ? "agent_performance_history" : "agent_performance";
  const queryIds = [...new Set([historyQueryId, "target_configuration"])];
  const reviewedHistoryRows = dedicatedHistoryRows.length ? dedicatedHistoryRows : allRows;
  const sourceRowsByQuery = { [historyQueryId]: reviewedHistoryRows, target_configuration: targets };

  return <article className="agent-performance-page">
    <section className="agent-command" aria-label="Performance controls"><div>
      <span className="agent-kicker">{level === "teamLead" ? "Team lead performance" : "Agent performance"}</span><h1>{subjectLabel}</h1>
      <p>{row.designation || "IPT agent"} · {row.iptTeam || "Team not assigned"} · {row.cluster || "Cluster not assigned"}</p>
    </div><div className="agent-controls">
      <SegmentedControl ariaLabel="Time level" value={grain} options={PERIODS} onChange={setGrain} />
      <SegmentedControl ariaLabel="Performance level" value={level} options={[{ value: "agent", label: "Agent" }, { value: "teamLead", label: "Team lead" }]} onChange={setLevel} />
      {level === "teamLead" ? <Dropdown label="Team lead" showLabel value={activeTeamLead} choices={teamLeads} formatChoice={compactLead} onChange={setTeamLead} /> : <Dropdown label="Agent" showLabel value={activeAgent} choices={["all", ...agents]} formatChoice={compactAgent} onChange={setAgent} />}
      <Dropdown label={periodNoun(grain)} showLabel value={selectedPeriod} choices={periodChoices} formatChoice={(value) => periodLabel(grain, value)} onChange={(value) => setSelectedPeriods((current) => ({ ...current, [grain]: value }))} />
      {level === "teamLead" && <button type="button" className="agent-distribution-toggle" aria-expanded={showDistribution} onClick={() => setShowDistribution((value) => !value)}>{showDistribution ? "Hide agent distribution" : "Show agent distribution"}</button>}
    </div></section>

    {!hasPeriodHistory && grain !== "month" && <div className="agent-period-notice" role="status"><strong>Current {grain} only.</strong><span>Refresh the updated historical query to load every dated {grain} period.</span></div>}

    <section className="agent-score-grid" aria-label="Target versus achievement">{METRICS.map((item) => <MetricScore key={item.id} metric={item} actual={Number(row[item.id] || 0)} target={subjectTarget(item.id)} previous={previousRow ? Number(previousRow[item.id] || 0) : null} comparisonLabel={grain} active={metricId === item.id} onSelect={() => setMetricId(item.id)} />)}</section>

    {level === "teamLead" && showDistribution && <DataComponent id="agent-distribution" queryId={historyQueryId} kind="chart" variant="card" title={`${metric.label} distribution by agent`} description={`Ranked ${grain} performance for agents reporting to ${subjectLabel}.`} chart={distributionSpec} displayRows={distributionRows} sourceRows={rosterRows} scopeFilters={scope} headerControls={<SegmentedControl ariaLabel="Distribution metric" value={metricId} options={METRICS.map((item) => ({ value: item.id, label: item.short }))} onChange={setMetricId} />}>
      <Chart spec={distributionSpec} rows={distributionRows} height={Math.max(300, Math.min(720, distributionRows.length * 34))} {...chartProps("agent-distribution")} />
    </DataComponent>}

    <section className="agent-analysis-grid">
      <DataComponent id="metric-progress" queryIds={queryIds} queryId={historyQueryId} kind="chart" variant="card" title={`${metric.label}: ${grain} history`} description={`Trend and previous-period comparison use every historical ${grain} returned by the connected query.`} chart={trendSpec} displayRows={trendRows} sourceRows={hasPeriodHistory ? periodRows : allRows} sourceRowsByQuery={sourceRowsByQuery} scopeFilters={scope} headerControls={<SegmentedControl ariaLabel="Metric" value={metricId} options={METRICS.map((item) => ({ value: item.id, label: item.short }))} onChange={setMetricId} />}>
        <Chart spec={trendSpec} rows={trendRows} height={286} {...chartProps("metric-progress")} />
      </DataComponent>
      <DataComponent id="monthly-scorecard" queryId={historyQueryId} kind="table" variant="card" title={`${periodNoun(grain)} stage funnel`} description="Stage counts use the selected historical period and population; each step shows conversion into the next stage." displayRows={scoreRows} sourceRows={selectedRows} scopeFilters={scope}><Funnel row={row} /></DataComponent>
      <div className="agent-target-comparison"><DataComponent id="target-comparison" queryIds={queryIds} queryId={historyQueryId} kind="chart" variant="card" title={`${subjectLabel}: ${grain} actual vs target`} description={grain === "month" ? "Actuals are summed across agents in scope. A target is plotted only when every in-scope agent has a reviewed monthly target." : `Actuals use the selected historical ${grain}. Targets remain unset because the reviewed target source currently defines monthly targets only.`} chart={comparisonSpec} displayRows={scoreRows} sourceRows={selectedRows} sourceRowsByQuery={sourceRowsByQuery} scopeFilters={scope}>
        <Chart spec={comparisonSpec} rows={scoreRows} height={300} {...chartProps("target-comparison")} />
      </DataComponent></div>
    </section>

    <section className="agent-roster-section"><SectionHeader id="agent-roster-title" title={`Team snapshot · ${periodLabel(grain, selectedPeriod)}`} />
      <DataComponent id="agent-table" queryId={historyQueryId} kind="table" variant="card" title="Agent performance detail" description="Search, compare, and inspect agent performance for the selected historical period and team-lead scope." displayRows={tableRows} sourceRows={rosterRows} scopeFilters={scope}>
        <DataTable rows={tableRows} rowKey="agentId" caption={`Agent performance by ${grain}`} columns={[
          { key: "agentName", label: "Agent", presentation: "identity", secondaryField: "iptTeam" }, { key: "teamLeadName", label: "Team lead" }, { key: "displayLeads", label: "Leads" }, { key: "displayLogins", label: "Logins" }, { key: "displayDemos", label: "Demos" }, { key: "displayConversions", label: "Conversions" }, { key: "loginRateDisplay", label: "Login rate", presentation: "percent" }, { key: "demoRateDisplay", label: "Demo rate", presentation: "percent" }, { key: "conversionRateDisplay", label: "Conversion rate", presentation: "percent" },
        ]} onRowSelect={(selected) => { setLevel("agent"); setAgent(selected.agentEmail); }} rowActionLabel={(selected) => `Open ${compactAgent(selected.agentEmail)} performance`} />
      </DataComponent>
    </section>
  </article>;
}
