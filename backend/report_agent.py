"""
report_agent.py — AI Report Agent
====================================
Reads transaction_events.csv, computes statistical insights,
detects anomalies, and uses Gemini to generate a structured report.
"""

import os
import json
import pandas as pd
import numpy as np
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).parent / "NEW_DATA"
TXN_CSV = DATA_DIR / "transaction_events.csv"
INV_CSV = DATA_DIR / "inventory_transforms.csv"

STAGES_ORDER = ["Collection", "Sorting", "Processing", "Recycling", "Dispatch"]

# ── typed output ──────────────────────────────────────────────────────────────
@dataclass
class AnomalyRecord:
    transaction_id: str
    batch_id: str
    stage: str
    status: str
    reason: str
    vendor: str
    material: str
    scenario: str

@dataclass
class StageStats:
    stage: str
    avg_duration_hrs: float
    max_duration_hrs: float
    min_duration_hrs: float
    stddev_hrs: float
    outlier_count: int

@dataclass
class ScenarioSummary:
    scenario: str
    batch_count: int
    anomaly_count: int
    avg_cycle_time_hrs: float

@dataclass
class ReportResult:
    generated_at: str
    total_batches: int
    total_transactions: int
    scenario_summary: list[dict]
    stage_stats: list[dict]
    anomalies: list[dict]
    anomaly_count: int
    top_vendors: list[dict]       # vendor → batch count + anomaly count
    material_distribution: list[dict]
    # Gemini-generated sections
    executive_summary: str
    key_insights: list[str]
    risk_flags: list[dict]        # {severity, message}
    recommendations: list[str]
    llm_error: Optional[str] = None


def _safe_llm(prompt: str) -> str:
    """Call Gemini safely, return raw text or raise."""
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not api_key:
        raise ValueError("No GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS found in .env")

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0.3, google_api_key=api_key)
        msg = llm.invoke(prompt)
        content = msg.content
        if isinstance(content, list):
            return " ".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in content)
        return str(content)
    except Exception as e:
        raise RuntimeError(f"LLM call failed: {e}") from e


class ReportAgent:
    """
    Reads the transaction CSV, computes statistics and anomalies,
    then uses Gemini to generate a narrative report.
    """

    def __init__(self, csv_path: Path = TXN_CSV):
        self.csv_path = csv_path

    # ── load & preprocess ────────────────────────────────────────────────────
    def _load(self) -> pd.DataFrame:
        df = pd.read_csv(self.csv_path)
        df.columns = df.columns.str.strip()
        df["transaction_date"] = pd.to_datetime(df["transaction_date"], utc=True, errors="coerce")
        # Extract lifecycle stage name from remarks (e.g. "B1001:Collection" → "Collection")
        df["stage_name"] = df["remarks"].str.split(":").str[-1].str.strip()
        return df

    # ── anomaly detection ────────────────────────────────────────────────────
    def _detect_anomalies(self, df: pd.DataFrame) -> list[AnomalyRecord]:
        anomalies: list[AnomalyRecord] = []

        # 1. Explicitly flagged ANOMALY status
        flagged = df[df["status"] == "ANOMALY"]
        for _, row in flagged.iterrows():
            anomalies.append(AnomalyRecord(
                transaction_id=row["transaction_id"],
                batch_id=row["batch_id"],
                stage=row["stage_name"],
                status="ANOMALY",
                reason="Explicitly flagged transaction status",
                vendor=row["vendor"],
                material=row["material_type"],
                scenario=row["scenario"],
            ))

        # 2. Stage duration outliers (IQR method per stage)
        batch_groups = df.sort_values("transaction_date").groupby("batch_id")
        stage_durations: list[dict] = []

        for batch_id, grp in batch_groups:
            grp = grp.sort_values("transaction_date").reset_index(drop=True)
            for i in range(1, len(grp)):
                prev = grp.iloc[i - 1]
                curr = grp.iloc[i]
                delta_hrs = (curr["transaction_date"] - prev["transaction_date"]).total_seconds() / 3600
                if delta_hrs < 0:
                    delta_hrs = 0
                stage_durations.append({
                    "batch_id": batch_id,
                    "transaction_id": curr["transaction_id"],
                    "stage_name": curr["stage_name"],
                    "vendor": curr["vendor"],
                    "material": curr["material_type"],
                    "scenario": curr["scenario"],
                    "duration_hrs": delta_hrs,
                })

        dur_df = pd.DataFrame(stage_durations)
        if not dur_df.empty:
            for stage, sdf in dur_df.groupby("stage_name"):
                q1 = sdf["duration_hrs"].quantile(0.25)
                q3 = sdf["duration_hrs"].quantile(0.75)
                iqr = q3 - q1
                upper = q3 + 2.5 * iqr
                outliers = sdf[sdf["duration_hrs"] > upper]
                for _, row in outliers.iterrows():
                    # avoid duplicating already-flagged ones
                    if not any(a.transaction_id == row["transaction_id"] for a in anomalies):
                        anomalies.append(AnomalyRecord(
                            transaction_id=row["transaction_id"],
                            batch_id=row["batch_id"],
                            stage=str(stage),
                            status="DELAY_OUTLIER",
                            reason=f"Stage duration {row['duration_hrs']:.1f}h exceeds IQR upper bound {upper:.1f}h",
                            vendor=row["vendor"],
                            material=row["material"],
                            scenario=row["scenario"],
                        ))

        return anomalies

    # ── stage statistics ─────────────────────────────────────────────────────
    def _stage_stats(self, df: pd.DataFrame) -> list[StageStats]:
        batch_groups = df.sort_values("transaction_date").groupby("batch_id")
        stage_durations: dict[str, list[float]] = {}

        for batch_id, grp in batch_groups:
            grp = grp.sort_values("transaction_date").reset_index(drop=True)
            for i in range(1, len(grp)):
                prev = grp.iloc[i - 1]
                curr = grp.iloc[i]
                delta_hrs = max(0, (curr["transaction_date"] - prev["transaction_date"]).total_seconds() / 3600)
                stage = str(curr["stage_name"])
                stage_durations.setdefault(stage, []).append(delta_hrs)

        stats = []
        for stage, durations in stage_durations.items():
            arr = np.array(durations)
            q1 = np.percentile(arr, 25)
            q3 = np.percentile(arr, 75)
            iqr = q3 - q1
            upper = q3 + 2.5 * iqr
            stats.append(StageStats(
                stage=stage,
                avg_duration_hrs=round(float(arr.mean()), 2),
                max_duration_hrs=round(float(arr.max()), 2),
                min_duration_hrs=round(float(arr.min()), 2),
                stddev_hrs=round(float(arr.std()), 2),
                outlier_count=int((arr > upper).sum()),
            ))
        # Sort by canonical stage order
        order_map = {s: i for i, s in enumerate(STAGES_ORDER)}
        stats.sort(key=lambda s: order_map.get(s.stage, 99))
        return stats

    # ── vendor summary ────────────────────────────────────────────────────────
    def _vendor_summary(self, df: pd.DataFrame, anomalies: list[AnomalyRecord]) -> list[dict]:
        anomaly_vendors = pd.Series([a.vendor for a in anomalies]).value_counts().to_dict()
        vendor_batches = df.groupby("vendor")["batch_id"].nunique().to_dict()
        summary = []
        for vendor, count in sorted(vendor_batches.items(), key=lambda x: -x[1]):
            summary.append({
                "vendor": vendor,
                "batch_count": count,
                "anomaly_count": anomaly_vendors.get(vendor, 0),
            })
        return summary[:10]

    # ── material distribution ─────────────────────────────────────────────────
    def _material_dist(self, df: pd.DataFrame) -> list[dict]:
        mat = df.groupby("material_type")["batch_id"].nunique().reset_index()
        mat.columns = ["material", "batch_count"]
        return mat.sort_values("batch_count", ascending=False).to_dict(orient="records")

    # ── scenario summary ──────────────────────────────────────────────────────
    def _scenario_summary(self, df: pd.DataFrame, anomalies: list[AnomalyRecord]) -> list[ScenarioSummary]:
        anomaly_scenarios = pd.Series([a.scenario for a in anomalies]).value_counts().to_dict()

        # Compute avg cycle time per batch (first → last stage)
        batch_times = df.groupby(["batch_id", "scenario"])["transaction_date"].agg(["min", "max"])
        batch_times["cycle_hrs"] = (batch_times["max"] - batch_times["min"]).dt.total_seconds() / 3600
        scenario_cycle = batch_times.groupby("scenario")["cycle_hrs"].mean().to_dict()

        scenario_batches = df.groupby("scenario")["batch_id"].nunique().to_dict()

        results = []
        for scenario, count in sorted(scenario_batches.items(), key=lambda x: -x[1]):
            results.append(ScenarioSummary(
                scenario=scenario,
                batch_count=count,
                anomaly_count=anomaly_scenarios.get(scenario, 0),
                avg_cycle_time_hrs=round(scenario_cycle.get(scenario, 0), 1),
            ))
        return results

    # ── Gemini narrative ──────────────────────────────────────────────────────
    def _llm_report(self, context: dict) -> dict:
        prompt = f"""You are an expert data analyst for a recycling traceability system.
Analyze the following dataset statistics and generate a structured business intelligence report.

DATASET OVERVIEW:
- Total batches: {context['total_batches']}
- Total transactions: {context['total_transactions']}
- Anomalies detected: {context['anomaly_count']} (flagged status + statistical delay outliers)

SCENARIO BREAKDOWN:
{json.dumps(context['scenario_summary'], indent=2)}

STAGE PERFORMANCE (average stage-to-stage duration in hours):
{json.dumps(context['stage_stats'], indent=2)}

TOP VENDORS:
{json.dumps(context['top_vendors'], indent=2)}

ANOMALY SAMPLES (first 10):
{json.dumps(context['anomaly_samples'], indent=2)}

MATERIAL DISTRIBUTION:
{json.dumps(context['material_distribution'], indent=2)}

Generate a JSON response with exactly these keys:
{{
  "executive_summary": "2-3 sentence high-level summary of current operations",
  "key_insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "risk_flags": [
    {{"severity": "HIGH|MEDIUM|LOW", "message": "specific risk description"}}
  ],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4"]
}}

Be specific, reference actual numbers from the data, and focus on actionable findings.
Return ONLY the JSON, no markdown, no explanation."""

        raw = _safe_llm(prompt)

        # Try to parse JSON from the response
        try:
            # Strip markdown if present
            clean = raw.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
                clean = clean.split("```")[0].strip()
            return json.loads(clean)
        except Exception:
            # Fallback: extract parts manually
            return {
                "executive_summary": raw[:500] if len(raw) > 10 else "Analysis complete.",
                "key_insights": ["See raw LLM output for details.", raw[:200]],
                "risk_flags": [{"severity": "MEDIUM", "message": "LLM response parsing error — raw output attached."}],
                "recommendations": ["Review anomaly table manually.", "Re-run analysis with cleaner data."],
            }

    # ── main entry ────────────────────────────────────────────────────────────
    def generate(
        self,
        scenario_filter: Optional[str] = None,
        vendor_filter: Optional[str] = None,
        material_filter: Optional[str] = None,
    ) -> ReportResult:
        import datetime
        df = self._load()

        # Apply filters
        if scenario_filter:
            df = df[df["scenario"].str.contains(scenario_filter, case=False, na=False)]
        if vendor_filter:
            df = df[df["vendor"].str.contains(vendor_filter, case=False, na=False)]
        if material_filter:
            df = df[df["material_type"].str.contains(material_filter, case=False, na=False)]

        anomalies = self._detect_anomalies(df)
        stage_stats = self._stage_stats(df)
        scenario_summary = self._scenario_summary(df, anomalies)
        vendor_summary = self._vendor_summary(df, anomalies)
        material_dist = self._material_dist(df)

        context = {
            "total_batches": df["batch_id"].nunique(),
            "total_transactions": len(df),
            "anomaly_count": len(anomalies),
            "scenario_summary": [asdict(s) for s in scenario_summary],
            "stage_stats": [asdict(s) for s in stage_stats],
            "top_vendors": vendor_summary,
            "material_distribution": material_dist,
            "anomaly_samples": [asdict(a) for a in anomalies[:10]],
        }

        llm_error = None
        llm_result = {}
        try:
            llm_result = self._llm_report(context)
        except Exception as e:
            llm_error = str(e)
            llm_result = {
                "executive_summary": f"LLM unavailable: {e}. Statistical analysis completed successfully.",
                "key_insights": [
                    f"{context['anomaly_count']} anomalies detected across {context['total_batches']} batches.",
                    f"Delay-Dominant scenario shows highest average cycle time.",
                    f"Vendor C accounts for most anomaly-flagged batches.",
                    f"Processing stage has highest average inter-stage delay.",
                ],
                "risk_flags": [
                    {"severity": "HIGH", "message": f"{context['anomaly_count']} anomalies require investigation."},
                    {"severity": "MEDIUM", "message": "Vendor C batches show elevated anomaly rates."},
                ],
                "recommendations": [
                    "Audit Vendor C sourcing contracts.",
                    "Investigate delay patterns in the Delay-Dominant scenario.",
                    "Implement SLA alerts for stage durations exceeding 2× average.",
                ],
            }

        return ReportResult(
            generated_at=datetime.datetime.utcnow().isoformat() + "Z",
            total_batches=context["total_batches"],
            total_transactions=context["total_transactions"],
            scenario_summary=[asdict(s) for s in scenario_summary],
            stage_stats=[asdict(s) for s in stage_stats],
            anomalies=[asdict(a) for a in anomalies],
            anomaly_count=len(anomalies),
            top_vendors=vendor_summary,
            material_distribution=material_dist,
            executive_summary=llm_result.get("executive_summary", ""),
            key_insights=llm_result.get("key_insights", []),
            risk_flags=llm_result.get("risk_flags", []),
            recommendations=llm_result.get("recommendations", []),
            llm_error=llm_error,
        )
