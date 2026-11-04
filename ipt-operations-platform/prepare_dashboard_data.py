import ast
import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCES = [
    ROOT.parent / "lead_level_attribution_training_dataset.csv",
    ROOT.parent / "lead_level_attribution_training_dataset1.csv",
]


def parse_list(value):
    if not value:
        return []
    try:
        parsed = ast.literal_eval(value)
        return parsed if isinstance(parsed, list) else []
    except (SyntaxError, ValueError):
        return []


rows = []
for source in SOURCES:
    with source.open(encoding="utf-8-sig", newline="") as handle:
        for raw in csv.DictReader(handle):
            rows.append(
                {
                    "leadId": raw["lead_id"],
                    "leadSource": raw["lead_source"],
                    "deviceState": raw["device_state"],
                    "callCount": int(raw["call_count"]),
                    "talkMinutes": round(float(raw["total_duration_sec"]) / 60, 1),
                    "maxIntent": float(raw["max_intent_level"]),
                    "latestIntent": float(raw["latest_intent_level"]),
                    "maxEngagement": float(raw["max_customer_engagement"]),
                    "latestEngagement": float(raw["latest_customer_engagement"]),
                    "agentsSpokenTo": int(raw["agents_spoken_to"]),
                    "mobileLogin": raw["has_mobile_login"].lower() == "true",
                    "desktopLogin": raw["has_desktop_login"].lower() == "true",
                    "needsMultiDevice": raw["needs_multi_device"].lower() == "true",
                    "needsMultiLocation": raw["needs_multi_location"].lower() == "true",
                    "requirements": parse_list(raw["requirements"]),
                    "intentTags": parse_list(raw["intent_tags"]),
                    "objections": parse_list(raw["objections"]),
                    "intentScore": float(raw["intent_score"]),
                    "stage": raw["stage_label"],
                    "recommendedPlan": raw["recommended_plan"],
                }
            )


def breakdown(field):
    counts = Counter(row[field] for row in rows)
    return [{"category": key, "customers": value} for key, value in counts.most_common()]


requirement_counts = Counter(item for row in rows for item in row["requirements"])
objection_counts = Counter(item for row in rows for item in row["objections"])

partner_sources = [
    {"source": "Partner page", "routing": "Business category routes TP vs general stream; TL may correct after call review", "owner": "Onboarding / partner team", "state": "Active", "control": "Track manual reassignment and classification accuracy"},
    {"source": "AI intent / Google Maps", "routing": "Clear yes → direct Hunting; busy/call-later → human follow-up", "owner": "Growth / AI + Hunting", "state": "Testing", "control": "Dedupe, existing-partner check, structured outcome and minimum fields"},
    {"source": "Tally / directory scraping", "routing": "Targeted acquisition; downstream owner depends on relationship", "owner": "Partner team", "state": "Verify", "control": "Confirm exact active feeds and source names"},
    {"source": "Existing customers / CleverTap", "routing": "Interested customers enter partner onboarding", "owner": "Onboarding", "state": "Active", "control": "Retain campaign/source metadata; rejected users are not assigned"},
    {"source": "TP product/report sources", "routing": "Product-linked prospects route to TP stream", "owner": "TP team", "state": "Verify", "control": "Confirm feed list, automation status and owner"},
]

partner_kpis = [
    {"stage": "Acquisition", "kpi": "Qualified partner leads by source and cluster", "decision": "Which channels create scalable supply?", "guardrail": "Duplicate rate and invalid-contact rate", "status": "Recommended"},
    {"stage": "Contact", "kpi": "Contact / connect rate", "decision": "Is source quality or outreach limiting progression?", "guardrail": "Opt-out and failed-contact rate", "status": "Recommended"},
    {"stage": "Intent", "kpi": "Hot / Warm intent distribution", "decision": "How well does AI or human qualification work?", "guardrail": "Manual-review agreement rate", "status": "Needs taxonomy"},
    {"stage": "Onboarding", "kpi": "Onboarding conversion rate", "decision": "Where do proposition and process friction appear?", "guardrail": "KYC drop-off and incomplete minimum fields", "status": "Recommended"},
    {"stage": "Hunting", "kpi": "Time to first partner-generated lead", "decision": "How quickly does relationship-building create activity?", "guardrail": "No-contact and inactive aging", "status": "Recommended"},
    {"stage": "Activation", "kpi": "Share producing eligible business", "decision": "How much onboarding becomes real program value?", "guardrail": "Self-purchase and ineligible-product checks", "status": "Needs definition"},
    {"stage": "Farming", "kpi": "Active productive partners and value per partner", "decision": "Is partner value durable and diversified?", "guardrail": "Concentration risk and dormant-partner rate", "status": "Needs tiers"},
    {"stage": "Economics", "kpi": "Cost per activated partner and revenue per partner", "decision": "Does acquisition cost create downstream value?", "guardrail": "Use fully loaded AI and human cost", "status": "Recommended"},
]

partner_controls = [
    {"risk": "Duplicate partner identities", "stance": "Known issue; not normal design", "control": "Define canonical entity matching and dedupe before ingestion"},
    {"risk": "Account splitting for TDS", "stance": "Not intended", "control": "Flag for compliance and operations review"},
    {"risk": "Self-purchase for commission", "stance": "Not allowed", "control": "Use device and partner identifiers; document eligibility rules"},
    {"risk": "Premature KYC", "stance": "Avoid as first-touch hard gate", "control": "Collect minimum fields first; complete verification after trust begins"},
    {"risk": "Territory conflict", "stance": "Material relationship risk", "control": "Assess geographic and relationship impact before expansion"},
]

partner_open_questions = [
    {"priority": "P0", "question": "Canonical name for the general stream: AP, EP, or another label?", "owner": "Partner Ops / Ishabh"},
    {"priority": "P0", "question": "Current Hunting/Farming tier names and monthly or quarterly thresholds?", "owner": "Partner Ops + Data"},
    {"priority": "P0", "question": "Formal activated-partner definition used in dashboards and assignment?", "owner": "Partner Ops + Data"},
    {"priority": "P0", "question": "Current AI intent taxonomy, routing rules, and minimum ingestion fields?", "owner": "Partner Ops + Growth + Data"},
    {"priority": "P1", "question": "Authoritative identity keys for dedupe and entity resolution?", "owner": "Data / Backend"},
    {"priority": "P1", "question": "Current desktop/mobile commission and product eligibility rules?", "owner": "Partner Ops + Finance"},
    {"priority": "P1", "question": "Can Farming partners return to Hunting, and under what trigger?", "owner": "Partner Ops"},
]

snapshot = {
    "surface": "dashboard",
    "title": "IPT customer intelligence",
    "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "buildStatus": "creating",
    "status": "observed",
    "filters": [
        {"id": "leadSource", "label": "Lead source", "field": "leadSource", "defaultValue": "all", "queryIds": ["customer_leads"]},
        {"id": "stage", "label": "Customer stage", "field": "stage", "defaultValue": "all", "queryIds": ["customer_leads"]},
        {"id": "deviceState", "label": "Device state", "field": "deviceState", "defaultValue": "all", "queryIds": ["customer_leads"]},
    ],
    "queries": {
        "customer_leads": {
            "rows": rows,
            "source": {
                "label": "Local IPT customer attribution datasets",
                "files": [source.name for source in SOURCES],
                "filters": ["All 52 customer-level rows in the two supplied datasets"],
                "executedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "metricDefinitions": [
                    {"label": "Customers", "definition": "Distinct lead_id records in the supplied customer attribution files."},
                    {"label": "High intent", "definition": "Customers with intent_score of 70 or higher; a dashboard analysis threshold, not a source-system status."},
                    {"label": "Logged in", "definition": "Customers with a recorded mobile or desktop login flag."},
                    {"label": "Engagement", "definition": "Latest customer engagement score supplied in the attribution datasets."},
                ],
            },
        },
        "stage_breakdown": {"rows": breakdown("stage"), "source": {"label": "Derived from customer_leads", "derivedFrom": ["customer_leads"]}},
        "source_breakdown": {"rows": breakdown("leadSource"), "source": {"label": "Derived from customer_leads", "derivedFrom": ["customer_leads"]}},
        "requirements": {"rows": [{"category": k, "customers": v} for k, v in requirement_counts.most_common()], "source": {"label": "Derived from customer_leads", "derivedFrom": ["customer_leads"]}},
        "objections": {"rows": [{"category": k, "customers": v} for k, v in objection_counts.most_common()], "source": {"label": "Derived from customer_leads", "derivedFrom": ["customer_leads"]}},
        "partner_metric_schema": {
            "rows": [
                {"group": "Licensing", "metric": "New license count", "definition": "License IDs where lic_flag is New.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Revenue", "metric": "New revenue", "definition": "Revenue from licenses where lic_flag is New.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Revenue", "metric": "Renew revenue", "definition": "Revenue from licenses where lic_flag is Renew.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Productivity", "metric": "Active+ partners", "definition": "Partners with at least one new desktop license in the selected period.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Productivity", "metric": "Key+ partners", "definition": "Partners with at least three new desktop licenses in the selected period.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Productivity", "metric": "Licenses per partner", "definition": "New desktop licenses divided by Active+ partners in the same scope.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Economics", "metric": "ARPL", "definition": "All new revenue divided by new desktop licenses.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Economics", "metric": "Revenue per partner", "definition": "All new revenue divided by Active+ partners.", "businessDate": "payment_date", "status": "Defined"},
                {"group": "Milestones", "metric": "First active", "definition": "Partners whose first_active_date falls in the selected period.", "businessDate": "first_active_date", "status": "Defined"},
                {"group": "Milestones", "metric": "First key", "definition": "Partners whose first_key_date falls in the selected period.", "businessDate": "first_key_date", "status": "Defined"},
                {"group": "Milestones", "metric": "First prime", "definition": "Partners whose first_prime_date falls in the selected period.", "businessDate": "first_prime_date", "status": "Defined"},
                {"group": "Milestones", "metric": "First strategic", "definition": "Partners whose first_strategic_date falls in the selected period.", "businessDate": "first_strategic_date", "status": "Defined"},
            ],
            "source": {
                "label": "IPT QuickSight metric semantics",
                "files": ["IPT Chatbot 3/ipt_agent/metric_context.py", "IPT Chatbot 3/ipt_agent/sql_views.py"],
                "filters": ["Metric definitions only; no partner observations were supplied"],
                "metricDefinitions": [
                    {"label": "Partner metric schema", "definition": "Canonical partner metric intents recovered from the local IPT QuickSight context. Values remain unavailable until a partner dataset is connected."}
                ]
            }
        },
        "partner_sources": {"rows": partner_sources, "source": {"label": "IPT Partner Program KT — lead acquisition and routing", "url": "https://docs.google.com/document/d/1VUWKwzvCGUfde0RDyZC3bYqmhxWomG0M59Rreodp5x0/edit?tab=t.0"}},
        "partner_kpis": {"rows": partner_kpis, "source": {"label": "IPT Partner Program KT — suggested process KPIs", "url": "https://docs.google.com/document/d/1VUWKwzvCGUfde0RDyZC3bYqmhxWomG0M59Rreodp5x0/edit?tab=t.0"}},
        "partner_controls": {"rows": partner_controls, "source": {"label": "IPT Partner Program KT — risks and control points", "url": "https://docs.google.com/document/d/1VUWKwzvCGUfde0RDyZC3bYqmhxWomG0M59Rreodp5x0/edit?tab=t.0"}},
        "partner_open_questions": {"rows": partner_open_questions, "source": {"label": "IPT Partner Program KT — open items and maintenance priorities", "url": "https://docs.google.com/document/d/1VUWKwzvCGUfde0RDyZC3bYqmhxWomG0M59Rreodp5x0/edit?tab=t.0"}},
    },
}

current_snapshot_path = ROOT / "src" / "data.json"
if current_snapshot_path.exists():
    current_snapshot = json.loads(current_snapshot_path.read_text(encoding="utf-8"))
    if current_snapshot.get("id"):
        snapshot["id"] = current_snapshot["id"]
snapshot["buildStatus"] = "complete"
(ROOT / "reviewed.json").write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
if current_snapshot_path.exists():
    current_snapshot_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
print(f"Prepared {len(rows)} customer rows from {len(SOURCES)} files")
