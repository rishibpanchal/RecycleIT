"""
fingerprint/insight_generator.py
==================================
Generate human-readable insights from clustered fingerprint data.

Insights cover:
  1. Cluster-level loss comparison (e.g., "Cluster X shows 15% higher loss in sorting")
  2. Vendor reliability ranking (below / at / above average)
  3. High-loss batch fingerprint similarity note
  4. Per-stage loss hotspot detection
"""

from __future__ import annotations

from typing import Any

from .fingerprint_builder import FINGERPRINT_KEYS


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def generate_insights(
    all_features: list[dict[str, Any]],
    cluster_result: dict[str, Any],
    fingerprint_store: list[dict[str, Any]],
) -> list[str]:
    """
    Generate a list of natural-language insight strings.

    Parameters
    ----------
    all_features : list[dict]
        Output of ``feature_engineering.engineer_features``.
    cluster_result : dict
        Output of ``clustering.cluster_fingerprints``.
    fingerprint_store : list[dict]
        Output of ``fingerprint_builder.build_fingerprints``.

    Returns
    -------
    list[str]
    """
    insights: list[str] = []

    batch_map: dict[str, dict] = {bf["batch_id"]: bf for bf in all_features}
    fp_map: dict[str, list[float]] = {fp["batch_id"]: fp["fingerprint"] for fp in fingerprint_store}
    batch_cluster: dict[str, str] = cluster_result.get("batch_cluster_map", {})

    # ── 1. Per-cluster stats ──────────────────────────────────────────────────
    cluster_batches: dict[str, list[dict]] = {"high_efficiency": [], "medium_efficiency": [], "low_efficiency": []}
    for batch_id, label in batch_cluster.items():
        if batch_id in batch_map:
            cluster_batches[label].append(batch_map[batch_id])

    cluster_avg_loss: dict[str, float | None] = {}
    cluster_stage_loss: dict[str, dict[str, float]] = {}

    for label, batches in cluster_batches.items():
        if not batches:
            cluster_avg_loss[label] = None
            cluster_stage_loss[label] = {}
            continue

        total_losses = [b["total_loss"] for b in batches if b.get("total_loss") is not None]
        cluster_avg_loss[label] = sum(total_losses) / len(total_losses) if total_losses else None

        # Per-stage averages
        stage_sums: dict[str, list[float]] = {}
        for b in batches:
            for stage, sf in b.get("stage_features", {}).items():
                loss = sf.get("loss")
                if loss is not None:
                    stage_sums.setdefault(stage, []).append(loss)
        cluster_stage_loss[label] = {
            stage: sum(vals) / len(vals) for stage, vals in stage_sums.items()
        }

    # Overall avg loss across all batches
    all_losses = [
        b["total_loss"]
        for b in all_features
        if b.get("total_loss") is not None
    ]
    overall_avg_loss = sum(all_losses) / len(all_losses) if all_losses else None

    # Insight: cluster loss vs. overall
    for label, avg in cluster_avg_loss.items():
        if avg is None or overall_avg_loss is None:
            continue
        diff = avg - overall_avg_loss
        readable_label = label.replace("_", " ").title()
        if abs(diff) >= 0.01:
            direction = "higher" if diff > 0 else "lower"
            insights.append(
                f"Batches in the '{readable_label}' cluster show "
                f"{_pct(abs(diff))} {direction} loss than average "
                f"(cluster avg: {_pct(avg)}, overall avg: {_pct(overall_avg_loss)})."
            )

    # Insight: stage loss hotspot per cluster
    for label, stage_avgs in cluster_stage_loss.items():
        if not stage_avgs:
            continue
        hotspot = max(stage_avgs, key=stage_avgs.get)  # type: ignore[arg-type]
        readable_label = label.replace("_", " ").title()
        insights.append(
            f"'{readable_label}' cluster: highest average loss occurs at the "
            f"'{hotspot}' stage ({_pct(stage_avgs[hotspot])})."
        )

    # ── 2. Vendor reliability ─────────────────────────────────────────────────
    vendor_scores: dict[str, float] = {}
    for b in all_features:
        vendor = b.get("vendor")
        score = b.get("vendor_reliability")
        if vendor is not None and score is not None:
            vendor_scores[vendor] = score  # last updated wins (same for same vendor)

    if vendor_scores:
        avg_reliability = sum(vendor_scores.values()) / len(vendor_scores)
        for vendor, score in sorted(vendor_scores.items()):
            diff = score - avg_reliability
            if abs(diff) >= 0.05:
                direction = "above" if diff > 0 else "below"
                insights.append(
                    f"Vendor '{vendor}' has a reliability score of {score:.2f}, "
                    f"which is {_pct(abs(diff))} {direction} the average ({avg_reliability:.2f})."
                )

    # ── 3. High-loss batch cluster note ──────────────────────────────────────
    high_loss_ids = [b["batch_id"] for b in all_features
                     if b.get("total_loss") is not None and b["total_loss"] > 0.25]
    if high_loss_ids:
        low_eff_in_cluster = cluster_batches.get("low_efficiency", [])
        overlap = len([b for b in low_eff_in_cluster if b["batch_id"] in set(high_loss_ids)])
        if overlap > 1:
            insights.append(
                f"{overlap} high-loss batches (>25% total loss) share similar fingerprints "
                f"in the 'Low Efficiency' cluster."
            )

    # ── 4. Material consistency note ──────────────────────────────────────────
    inconsistent = [b["batch_id"] for b in all_features if b.get("material_consistency") == 0]
    if inconsistent:
        insights.append(
            f"{len(inconsistent)} batch(es) show material type changes across stages, "
            f"which may indicate contamination or mislabelling: {', '.join(inconsistent[:5])}{'...' if len(inconsistent) > 5 else ''}."
        )

    # ── 5. Lifecycle time outliers ────────────────────────────────────────────
    times = [(b["batch_id"], b["total_time"]) for b in all_features if b.get("total_time") is not None]
    if len(times) > 2:
        avg_time = sum(t for _, t in times) / len(times)
        slow_batches = [bid for bid, t in times if t > avg_time * 1.5]
        if slow_batches:
            insights.append(
                f"{len(slow_batches)} batch(es) have lifecycle times >50% above average "
                f"({avg_time:.0f} hrs): {', '.join(slow_batches[:5])}{'...' if len(slow_batches) > 5 else ''}."
            )

    # ── 6. Profit Insights ────────────────────────────────────────────────────
    loss_making = [b["batch_id"] for b in all_features if b.get("meta_profit", 0) < 0]
    if loss_making:
        insights.append(
            f"{len(loss_making)} batch(es) operated at a net loss (Meta Profit < 0). "
            f"Review processing costs and raw material loss."
        )

    # ── 7. Dynamic LLM Rewrite ────────────────────────────────────────────────
    try:
        if insights:
            import os
            from langchain_google_genai import ChatGoogleGenerativeAI
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if api_key:
                llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0.7, google_api_key=api_key)
                prompt = (
                    "You are an AI analyst for a recycling traceability dashboard.\n"
                    "Rewrite the following raw statistical insights into 3-4 dynamic, "
                    "insightful, and concise bullet points. Focus on actionable framing.\n\n"
                    f"Raw Insights: {insights}\n\n"
                    "Return ONLY bullet points starting with exactly '- '."
                )
                response = llm.invoke(prompt)
                content = getattr(response, "content", "")
                dynamic_lines = [line.strip("- ").strip() for line in str(content).split("\n") if line.strip().startswith("-")]
                if len(dynamic_lines) > 0:
                    return dynamic_lines
    except Exception as e:
        print(f"[Insights] Failed to generate dynamic insights via LLM: {e}")

    return insights
