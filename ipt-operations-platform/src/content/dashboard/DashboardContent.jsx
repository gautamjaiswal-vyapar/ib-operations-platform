import React, { useMemo } from "react";

import {
  DataComponent, DataTable, EvidenceChart, Filters, MetricCard, SectionHeader,
  SortableItem, SortableRegion, useDataApp, useDashboardTabs,
} from "../../data-app-public.jsx";

const countBy = (rows, field) => Object.entries(rows.reduce((acc, row) => {
  const key = row[field] || "Unknown";
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {})).map(([category, customers]) => ({ category, customers }))
  .sort((a, b) => b.customers - a.customers || a.category.localeCompare(b.category));

const countItems = (rows, field) => Object.entries(rows.reduce((acc, row) => {
  for (const item of row[field] || []) acc[item] = (acc[item] || 0) + 1;
  return acc;
}, {})).map(([category, customers]) => ({ category, customers }))
  .sort((a, b) => b.customers - a.customers || a.category.localeCompare(b.category));

const pct = (value) => `${Math.round(value * 100)}%`;
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const horizontalBars = { type: "horizontalBar", x: "category", y: "customers", sortOrder: "descending", showXAxisLabel: false, showYAxisLabel: false };
const intentEngagement = { type: "scatter", x: "intentScore", y: "latestEngagement", series: "leadSource", xLabel: "Intent score", yLabel: "Latest engagement" };
const customerColumns = [
  { field: "leadId", label: "Customer", presentation: "identity", secondaryField: "leadSource" },
  { field: "stage", label: "Stage", presentation: "status" },
  { field: "intentScore", label: "Intent", presentation: "bar", max: 100 },
  { field: "latestEngagement", label: "Engagement", presentation: "bar", max: 100 },
  { field: "callCount", label: "Calls" },
  { field: "talkMinutes", label: "Talk time (min)" },
  { field: "deviceState", label: "Device state" },
  { field: "recommendedPlan", label: "Recommended plan" },
];

const partnerColumns = [
  { field: "metric", label: "Metric", presentation: "identity", secondaryField: "group" },
  { field: "definition", label: "Definition" },
  { field: "businessDate", label: "Business date" },
  { field: "status", label: "Readiness", presentation: "status" },
];
const sourceColumns = [
  { field: "source", label: "Source", presentation: "identity", secondaryField: "state" },
  { field: "routing", label: "Routing logic" }, { field: "owner", label: "Owner" }, { field: "control", label: "Control / confirmation" },
];
const kpiColumns = [
  { field: "stage", label: "Stage", presentation: "identity", secondaryField: "status" },
  { field: "kpi", label: "Primary KPI" }, { field: "decision", label: "Decision supported" }, { field: "guardrail", label: "Guardrail" },
];
const controlColumns = [
  { field: "risk", label: "Risk", presentation: "identity", secondaryField: "stance" }, { field: "control", label: "Required control" },
];
const questionColumns = [
  { field: "question", label: "Open definition", presentation: "identity", secondaryField: "priority" }, { field: "owner", label: "Suggested owner" },
];

const dashboardTabs = [
  { id: "partner", label: "Partner View", filterIds: [] },
  { id: "customer", label: "Customer View", filterIds: ["leadSource", "stage", "deviceState"] },
];

export function DashboardContent() {
  const { activeTabId } = useDashboardTabs(dashboardTabs);
  return activeTabId === "customer" ? <CustomerView /> : <PartnerView />;
}

function PartnerView() {
  const { queries, visible } = useDataApp();
  const rows = queries.partner_metric_schema?.rows ?? [];
  const sources = queries.partner_sources?.rows ?? [];
  const kpis = queries.partner_kpis?.rows ?? [];
  const controls = queries.partner_controls?.rows ?? [];
  const questions = queries.partner_open_questions?.rows ?? [];
  const milestones = ["Acquire", "Classify", "Onboard", "Enable referral code", "Hunting", "First lead / business", "Activate", "Score", "Farming"];
  const canvasRows = [
    { id: "partner:readiness", className: "partner-summary-grid", label: "Partner view readiness", items: ["partner-schema-status", "partner-groups", "partner-source-status"] },
    { id: "partner:journey", className: "ipt-section", label: "Partner milestone journey", items: ["partner-milestones"], header: <SectionHeader id="partner-journey-title" title="Partner operating lifecycle" /> },
    { id: "partner:acquisition", className: "ipt-section", label: "Acquisition and routing", items: ["partner-source-table"], header: <SectionHeader id="partner-source-title" title="Acquisition and routing" /> },
    { id: "partner:measurement", className: "ipt-section", label: "Partner KPI framework", items: ["partner-kpi-table"], header: <SectionHeader id="partner-kpi-title" title="Lifecycle KPI framework" /> },
    { id: "partner:controls", className: "ipt-grid ipt-section", label: "Controls and open definitions", items: ["partner-control-table", "partner-question-table"], header: <SectionHeader id="partner-control-title" title="Controls and definition gaps" /> },
    { id: "partner:definitions", className: "ipt-section", label: "Partner metric definitions", items: ["partner-metric-table"], header: <SectionHeader id="partner-definition-title" title="Existing output metric schema" /> },
  ];
  return <>
    <div className="view-heading">
      <div><p className="view-eyebrow">IPT operations</p><h2>Partner performance</h2><p>A measurement-ready view for partner output, economics, productivity, and milestone progression.</p></div>
      <span className="status-pill status-pill--warning">Partner data connection required</span>
    </div>
    <SortableRegion id="dashboard:partner:canvas" label="Partner dashboard blocks" variant="canvas" columns={12} spacing="standard" authoredRevision={1} rows={canvasRows}>
      {visible("partner-schema-status") && <SortableItem id="partner-schema-status" label="Defined metrics" kind="metric" span={4} minSpan={3}>
        <MetricCard id="partner-schema-status" title="Defined metrics" value={number.format(rows.length)} queryId="partner_metric_schema" sourceRows={rows} description="Canonical partner measurements available for dashboard implementation." />
      </SortableItem>}
      {visible("partner-groups") && <SortableItem id="partner-groups" label="Metric families" kind="metric" span={4} minSpan={3}>
        <MetricCard id="partner-groups" title="Lifecycle KPI stages" value={number.format(kpis.length)} queryId="partner_kpis" sourceRows={kpis} description="Acquisition through Farming, plus program economics." />
      </SortableItem>}
      {visible("partner-source-status") && <SortableItem id="partner-source-status" label="Observed partner rows" kind="metric" span={4} minSpan={3}>
        <MetricCard id="partner-source-status" title="Observed partner rows" value="—" comparison="Awaiting governed source" queryId="partner_metric_schema" sourceRows={rows} description="No partner-level observation dataset is present in the local workspace." />
      </SortableItem>}
      {visible("partner-milestones") && <SortableItem id="partner-milestones" label="Partner milestone journey" kind="custom" span={12} minSpan={5}>
        <DataComponent variant="card" padding="spacious" id="partner-milestones" title="Partner operating lifecycle" queryId="partner_kpis" kind="custom" displayRows={kpis} sourceRows={kpis} description="Onboarding creates the relationship; Hunting drives first business and activation; performance scoring governs the Farming handoff. Counts and rates require partner observations.">
          <ol className="milestone-flow" aria-label="Partner milestone sequence">
            {milestones.map((milestone, index) => <li key={milestone}><span>{index + 1}</span><strong>{milestone}</strong></li>)}
          </ol>
        </DataComponent>
      </SortableItem>}
      {visible("partner-source-table") && <SortableItem id="partner-source-table" label="Partner acquisition sources" kind="table" span={12} minSpan={6}>
        <DataComponent variant="card" id="partner-source-table" title="Partner acquisition sources" queryId="partner_sources" kind="table" displayRows={sources} sourceRows={sources} description="Routing is operationally controlled: initial category assignment may be corrected by a TL after call review.">
          <DataTable rows={sources} columns={sourceColumns} rowKey="source" searchable={false} caption="Partner acquisition and routing sources" />
        </DataComponent>
      </SortableItem>}
      {visible("partner-kpi-table") && <SortableItem id="partner-kpi-table" label="Partner lifecycle KPI framework" kind="table" span={12} minSpan={6}>
        <DataComponent variant="card" id="partner-kpi-table" title="Lifecycle KPI framework" queryId="partner_kpis" kind="table" displayRows={kpis} sourceRows={kpis} description="Items marked Needs definition must not be operationalized until their taxonomy or threshold is confirmed.">
          <DataTable rows={kpis} columns={kpiColumns} rowKey="stage" searchable={false} caption="Partner lifecycle KPI framework" />
        </DataComponent>
      </SortableItem>}
      {visible("partner-control-table") && <SortableItem id="partner-control-table" label="Partner program controls" kind="table" span={6} minSpan={4}>
        <DataComponent variant="card" id="partner-control-table" title="Program controls" queryId="partner_controls" kind="table" displayRows={controls} sourceRows={controls} description="Known exceptions should be monitored, not normalized as standard partner behavior.">
          <DataTable rows={controls} columns={controlColumns} rowKey="risk" searchable={false} caption="Partner program control points" />
        </DataComponent>
      </SortableItem>}
      {visible("partner-question-table") && <SortableItem id="partner-question-table" label="Open partner definitions" kind="table" span={6} minSpan={4}>
        <DataComponent variant="card" id="partner-question-table" title="Open definitions" queryId="partner_open_questions" kind="table" displayRows={questions} sourceRows={questions} description="Resolve these before treating the affected measures or routing rules as policy.">
          <DataTable rows={questions} columns={questionColumns} rowKey="question" searchable={false} caption="Open partner program definitions" />
        </DataComponent>
      </SortableItem>}
      {visible("partner-metric-table") && <SortableItem id="partner-metric-table" label="Partner metric definitions" kind="table" span={12} minSpan={6}>
        <DataComponent variant="card" id="partner-metric-table" title="Partner metric definitions" queryId="partner_metric_schema" kind="table" displayRows={rows} sourceRows={rows} description="Definitions are ready; observations remain unavailable until the partner dataset is connected.">
          <DataTable rows={rows} columns={partnerColumns} rowKey="metric" searchable caption="IPT partner metric definitions" />
        </DataComponent>
      </SortableItem>}
    </SortableRegion>
  </>;
}

function CustomerView() {
  const { snapshot, queries, filters, setFilter, reviewedRows, visible } = useDataApp();
  const customers = reviewedRows("customer_leads");
  const model = useMemo(() => {
    const total = customers.length;
    const highIntent = customers.filter((row) => row.intentScore >= 70).length;
    const loggedIn = customers.filter((row) => row.mobileLogin || row.desktopLogin).length;
    const multiDevice = customers.filter((row) => row.needsMultiDevice).length;
    const avgEngagement = total ? customers.reduce((sum, row) => sum + row.latestEngagement, 0) / total : 0;
    return {
      total, highIntent, loggedIn, multiDevice, avgEngagement,
      stages: countBy(customers, "stage"), sources: countBy(customers, "leadSource"),
      requirements: countItems(customers, "requirements").slice(0, 8),
      objections: countItems(customers, "objections").slice(0, 8),
      priority: [...customers].sort((a, b) => b.intentScore - a.intentScore || b.latestEngagement - a.latestEngagement),
    };
  }, [customers]);

  const metrics = [
    { id: "total-customers", title: "Customers", value: number.format(model.total), description: "Distinct customer leads in the selected local IPT dataset." },
    { id: "high-intent", title: "High-intent customers", value: number.format(model.highIntent), comparison: model.total ? `${pct(model.highIntent / model.total)} of selected customers` : "No selected customers", description: "Customers with an intent score of 70 or higher." },
    { id: "login-coverage", title: "Logged in", value: number.format(model.loggedIn), comparison: model.total ? `${pct(model.loggedIn / model.total)} of selected customers` : "No selected customers", description: "Customers with a recorded mobile or desktop login." },
    { id: "avg-engagement", title: "Average engagement", value: number.format(model.avgEngagement), comparison: `${number.format(model.multiDevice)} need multiple devices`, description: "Average latest customer engagement score for the selected population." },
  ];

  const rows = [
    { id: "ipt:metrics", kind: "metrics", label: "Customer snapshot", items: metrics.map(({ id }) => id) },
    { id: "ipt:funnel", className: "ipt-grid ipt-section", label: "Customer mix", items: ["customer-stages", "lead-sources"], header: <SectionHeader id="customer-mix-title" title="Customer mix" /> },
    { id: "ipt:signals", className: "ipt-grid ipt-section", label: "Customer signals", items: ["requirements", "objections"], header: <SectionHeader id="customer-signals-title" title="Needs and friction" /> },
    { id: "ipt:relationship", className: "ipt-section", label: "Intent and engagement", items: ["intent-engagement"], header: <SectionHeader id="intent-engagement-title" title="Intent and engagement" /> },
    { id: "ipt:customers", className: "ipt-section", label: "Customer records", items: ["customer-priority"], header: <SectionHeader id="customer-records-title" title="Customer priority queue" /> },
  ];

  return <>
    <div className="view-heading">
      <div><p className="view-eyebrow">IPT operations</p><h2>Customer intelligence</h2><p>Prioritize customer follow-up using stage, source, intent, engagement, needs, and objections.</p></div>
      <span className="status-pill">Local reviewed data</span>
    </div>
    <Filters sticky filters={snapshot.filters ?? []} queries={queries} values={filters} onChange={setFilter} />
    <div className="ipt-context" aria-label="Dashboard context">
      <p>Explore customer stage, intent, engagement, requirements, objections, and recommended plans.</p>
      <span>{model.total} selected customers</span>
    </div>
    <SortableRegion id="dashboard:ipt:canvas" label="IPT customer dashboard blocks" variant="canvas" columns={12} spacing="standard" authoredRevision={1} rows={rows}>
      {metrics.filter(({ id }) => visible(id)).map((metric) =>
        <SortableItem key={metric.id} id={metric.id} label={metric.title} kind="metric" span={3} minSpan={2}>
          <MetricCard {...metric} queryId="customer_leads" sourceRows={customers} />
        </SortableItem>)}
      {visible("customer-stages") && <SortableItem id="customer-stages" label="Customers by stage" kind="chart" span={6} minSpan={3}>
        <EvidenceChart variant="card" id="customer-stages" title="Customers by stage" queryId="customer_leads" spec={horizontalBars} rows={model.stages} displayRows={model.stages} sourceRows={customers} description="Mutually exclusive stage labels supplied in the attribution dataset." height={260} />
      </SortableItem>}
      {visible("lead-sources") && <SortableItem id="lead-sources" label="Customers by lead source" kind="chart" span={6} minSpan={3}>
        <EvidenceChart variant="card" id="lead-sources" title="Customers by lead source" queryId="customer_leads" spec={horizontalBars} rows={model.sources} displayRows={model.sources} sourceRows={customers} description="Distribution of the selected customers by recorded acquisition source." height={260} />
      </SortableItem>}
      {visible("requirements") && <SortableItem id="requirements" label="Top customer requirements" kind="chart" span={6} minSpan={3}>
        <EvidenceChart variant="card" id="requirements" title="Top customer requirements" queryId="customer_leads" spec={horizontalBars} rows={model.requirements} displayRows={model.requirements} sourceRows={customers} description="A customer can contribute to more than one requirement, so bars are not additive." height={240} />
      </SortableItem>}
      {visible("objections") && <SortableItem id="objections" label="Top customer objections" kind="chart" span={6} minSpan={3}>
        <EvidenceChart variant="card" id="objections" title="Top customer objections" queryId="customer_leads" spec={horizontalBars} rows={model.objections} displayRows={model.objections} sourceRows={customers} description="A customer can have multiple objections; use this view to focus follow-up playbooks." height={240} />
      </SortableItem>}
      {visible("intent-engagement") && <SortableItem id="intent-engagement" label="Intent score versus engagement" kind="chart" span={12} minSpan={4}>
        <EvidenceChart variant="card" padding="spacious" id="intent-engagement" title="Intent score versus engagement" queryId="customer_leads" spec={intentEngagement} rows={customers} sourceRows={customers} description="Each point is one customer. Color distinguishes lead source; upper-right customers combine strong intent with strong recent engagement." height={320} />
      </SortableItem>}
      {visible("customer-priority") && <SortableItem id="customer-priority" label="Customer priority queue" kind="table" span={12} minSpan={5}>
        <DataComponent variant="card" id="customer-priority" title="Customer priority queue" queryId="customer_leads" kind="table" displayRows={model.priority} sourceRows={customers} description="Sorted by intent score, then engagement. Use search to find a customer, plan, stage, or source.">
          <DataTable rows={model.priority} columns={customerColumns} rowKey="leadId" searchable caption="IPT customer priority queue" />
        </DataComponent>
      </SortableItem>}
    </SortableRegion>
  </>;
}
