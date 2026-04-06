"""
backend/meta_profit_engine.py
==============================
Computes the true economic value of each material batch using lifecycle data.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

# Economic Parameters (Configurable)
SELL_PRICE_PER_UNIT = 120.0
BUY_PRICE_PER_UNIT = 80.0

STAGE_COST_PER_HOUR = {
    "collection": 3.0,
    "sorting": 5.0,
    "processing": 10.0,
    "recycling": 8.0,
    "dispatch": 2.0
}


def preprocess_batch_data(batch_data: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """
    Group records by batch_id and sort by timestamp.
    """
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in batch_data:
        grouped[row["batch_id"]].append(row)

    for batch_id, events in grouped.items():
        # Sort by timestamp
        # Handle cases where timestamp might be missing or malformed by treating missing as very old
        def parse_ts(ts: str) -> datetime:
            try:
                # typically "2026-01-01T10:00:00" or similar ISO format
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except (ValueError, TypeError, AttributeError):
                return datetime.min

        events.sort(key=lambda r: parse_ts(r.get("timestamp", "")))

    return grouped


def _parse_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def compute_meta_profit(batch_events: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Compute Meta Profit for a single batch of events.
    Events should already be sorted chronologically for this batch.
    """
    if not batch_events:
        return {}
    
    batch_id = batch_events[0].get("batch_id", "Unknown")
    
    # 1. Extract Q_collection and Q_dispatch
    first_event = batch_events[0]
    last_event = batch_events[-1]

    q_collection = float(first_event.get("quantity_in", 0.0))
    q_dispatch = float(last_event.get("quantity_out", last_event.get("quantity_in", 0.0)))
    
    # Cost metrics
    # Revenue = Q_dispatch × SELL_PRICE_PER_UNIT
    revenue = q_dispatch * SELL_PRICE_PER_UNIT
    
    # Raw Cost = Q_collection × BUY_PRICE_PER_UNIT
    raw_cost = q_collection * BUY_PRICE_PER_UNIT
    
    # Processing Cost
    processing_cost = 0.0
    
    for i in range(len(batch_events)):
        current_event = batch_events[i]
        
        # Determine time spent at this stage
        if i < len(batch_events) - 1:
            next_event = batch_events[i+1]
            ts_current = _parse_ts(current_event.get("timestamp"))
            ts_next = _parse_ts(next_event.get("timestamp"))
            
            if ts_current and ts_next:
                time_diff_hours = max(0.0, (ts_next - ts_current).total_seconds() / 3600.0)
            else:
                time_diff_hours = 0.0
        else:
            # Last stage, we don't have a next timestamp. For simplicity, we assume 0 additional time.
            time_diff_hours = 0.0
            
        stage_name = str(current_event.get("stage", "")).lower()
        stage_rate = STAGE_COST_PER_HOUR.get(stage_name, 0.0)
        
        processing_cost += time_diff_hours * stage_rate

    # Loss Cost = Loss Quantity × SELL_PRICE_PER_UNIT
    loss_quantity = max(0.0, q_collection - q_dispatch)
    loss_cost = loss_quantity * SELL_PRICE_PER_UNIT
    
    # Meta Profit = Revenue - (Raw Cost + Processing Cost + Loss Cost)
    meta_profit = revenue - (raw_cost + processing_cost + loss_cost)
    
    # Profit Margin
    profit_margin = 0.0
    if revenue > 0:
        profit_margin = (meta_profit / revenue) * 100.0
        
    loss_percentage = 0.0
    if q_collection > 0:
        loss_percentage = (loss_quantity / q_collection) * 100.0
        
    # Optional advanced: Profit Categorization
    if meta_profit < 0:
        category = "Loss-making"
    elif profit_margin > 20: 
        category = "High Profit"
    else:
        category = "Moderate"

    return {
        "batch_id": batch_id,
        "meta_profit": round(meta_profit, 2),
        "profit_margin": round(profit_margin, 2),
        "revenue": round(revenue, 2),
        "raw_cost": round(raw_cost, 2),
        "processing_cost": round(processing_cost, 2),
        "loss_cost": round(loss_cost, 2),
        "loss_percentage": round(loss_percentage, 2),
        "profit_category": category,
    }


def generate_profit_insights(profit_metrics: dict[str, Any]) -> list[str]:
    """
    Generate human-readable insights based on the profit metrics of a batch.
    """
    insights = []
    
    loss_pct = profit_metrics.get("loss_percentage", 0.0)
    if loss_pct > 10.0:
        insights.append(f"High loss ({loss_pct}%) heavily reduced profitability.")
        
    margin = profit_metrics.get("profit_margin", 0.0)
    category = profit_metrics.get("profit_category")
    
    if category == "High Profit":
        insights.append(f"Efficient processing maintained a high profit margin ({margin}%).")
    elif category == "Loss-making":
        insights.append("Batch resulted in a net loss. Investigate high processing times or material loss.")
        
    processing_ratio = 0.0
    rev = profit_metrics.get("revenue", 0.0)
    if rev > 0:
        processing_ratio = profit_metrics.get("processing_cost", 0.0) / rev
        
    if processing_ratio > 0.15: # if processing cost is more than 15% of revenue
        insights.append("Processing costs are unusually high compared to generated revenue. Check queue times between stages.")
        
    return insights

def process_all_batches(batch_data: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """
    High level function for endpoints to compute meta profit for all given batches and compile insights.
    """
    grouped = preprocess_batch_data(batch_data)
    results = []
    
    # aggregate metric insights
    neg_profit_count = 0
    total_batches = len(grouped)
    
    for batch_id, events in grouped.items():
        metrics = compute_meta_profit(events)
        results.append(metrics)
        if metrics["meta_profit"] < 0:
            neg_profit_count += 1

    overall_insights = []
    if total_batches > 0:
        loss_pct = (neg_profit_count / total_batches) * 100
        if loss_pct > 0:
            overall_insights.append(f"{neg_profit_count} out of {total_batches} batches are loss-making.")
            
    return results, overall_insights
