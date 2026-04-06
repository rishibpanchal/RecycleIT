"""
backend/meta_prophet_engine.py
==============================
Time-series forecasting module forecasting Meta Profit using Prophet.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pandas as pd
from prophet import Prophet

logger = logging.getLogger(__name__)


def preprocess_timeseries(data: list[dict[str, Any]]) -> pd.DataFrame:
    """
    Convert raw historical batch records into a Prophet-friendly DataFrame.

    Requires: [{"timestamp": "2026-01-01...", "meta_profit": 3200}, ...]
    Aggregates to daily average if multiple batches land on the same day.
    """
    if not data:
        return pd.DataFrame(columns=["ds", "y"])

    records = []
    for item in data:
        # Require both keys to exist and be valid
        ts_raw = item.get("timestamp")
        profit = item.get("meta_profit")

        if profit is None or not ts_raw:
            continue

        try:
            # Parse timestamp and normalize to daily resolution (strip time)
            dt = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            date_only = datetime(dt.year, dt.month, dt.day)
            
            records.append({
                "ds": date_only,
                "y": float(profit)
            })
        except (ValueError, TypeError):
            pass

    df = pd.DataFrame(records)
    if df.empty:
        return df

    # Aggregate by date (mean profit per day)
    df = df.groupby("ds").mean().reset_index()
    return df


def determine_trend(forecast_df: pd.DataFrame, historical_df: pd.DataFrame) -> tuple[str, float]:
    """
    Analyze the forecast data to determine if the trend is increasing, decreasing, or stable.
    Returns (trend_label, confidence_score [0.0 - 1.0]).
    """
    if forecast_df.empty or historical_df.empty:
        return "stable", 0.0

    # Calculate average historical profit (last 7 days of history if possible, else all)
    hist_sorted = historical_df.sort_values(by="ds")
    recent_hist = hist_sorted.tail(7)
    recent_avg = recent_hist["y"].mean()

    # Calculate average predicted profit (future horizon)
    # The forecast dataframe contains historical dates as well. Let's isolate the future dates.
    last_hist_date = hist_sorted["ds"].max()
    future_only = forecast_df[forecast_df["ds"] > last_hist_date]
    
    if future_only.empty:
        return "stable", 0.0
        
    future_avg = future_only["yhat"].mean()

    # Determine trend
    diff = future_avg - recent_avg
    # If change is > 5% of recent average, call it increasing/decreasing
    threshold = abs(recent_avg) * 0.05 if recent_avg != 0 else 100.0

    if diff > threshold:
        trend = "increasing"
    elif diff < -threshold:
        trend = "decreasing"
    else:
        trend = "stable"

    # Rough heuristic for confidence based on Uncertainty Intervals length vs actual values
    # Closer bounds = higher confidence
    mean_lower = future_only["yhat_lower"].mean()
    mean_upper = future_only["yhat_upper"].mean()
    spread = abs(mean_upper - mean_lower)
    
    # if spread is twice the prediction, confidence is low (~0%)
    # if spread is 0, confidence is high (100%)
    if abs(future_avg) == 0:
        confidence = 0.5
    else:
        spread_ratio = spread / abs(future_avg)
        confidence = max(0.0, min(1.0, 1.0 - (spread_ratio / 2.0)))

    return trend, round(confidence, 2)


def forecast_profit(data: list[dict[str, Any]], days: int = 14) -> dict[str, Any]:
    """
    Fits a Prophet model and forecasts 'days' into the future.
    """
    df = preprocess_timeseries(data)
    
    if len(df) < 2:
        # Not enough data for Prophet to fit properly
        # Return graceful empty forecast
        return {
            "forecast": [],
            "trend": "stable",
            "confidence": 0.0,
            "error": "Not enough historical data points to generate forecast. Need at least 2 distinct days."
        }

    # Initialize model
    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False
    )
    
    try:
        model.fit(df)
        
        # Make future dataframe
        future = model.make_future_dataframe(periods=days, freq="D")
        forecast = model.predict(future)
        
        # Filter strictly to the forecasted periods
        last_date = df["ds"].max()
        future_forecast = forecast[forecast["ds"] > last_date]
        
        forecast_results = []
        for _, row in future_forecast.iterrows():
            forecast_results.append({
                "date": row["ds"].strftime("%Y-%m-%d"),
                "predicted_profit": round(row["yhat"], 2),
                "lower_bound": round(row["yhat_lower"], 2),
                "upper_bound": round(row["yhat_upper"], 2)
            })
            
        trend, confidence = determine_trend(forecast, df)

        return {
            "forecast": forecast_results,
            "trend": trend,
            "confidence": confidence
        }
        
    except Exception as e:
        logger.error(f"Prophet forecasting failed: {e}")
        return {
            "forecast": [],
            "trend": "stable",
            "confidence": 0.0,
            "error": str(e)
        }
