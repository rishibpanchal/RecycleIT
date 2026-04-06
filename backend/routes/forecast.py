"""
routes/forecast.py
===================
FastAPI router for Meta Prophet Engine forecasting.

Endpoints
---------
POST /forecast/meta-profit   — Predict future profit trends using Prophet
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from meta_prophet_engine import forecast_profit

router = APIRouter(prefix="/forecast", tags=["forecast"])

class ProfitRecord(BaseModel):
    batch_id: str
    timestamp: str
    meta_profit: float
    
    model_config = {"extra": "allow"}

class ForecastRequest(BaseModel):
    data: list[ProfitRecord] = Field(..., min_length=1)
    days: int = Field(default=14, ge=1, le=90, description="Number of days to forecast into the future")

@router.post("/meta-profit", summary="Forecast Meta Profit Trend")
def predict_meta_profit(request: ForecastRequest) -> dict[str, Any]:
    """
    Analyze historical Meta Profit data over time and predict future values 
    along with trend analysis (increasing/decreasing).
    """
    records = [r.model_dump() for r in request.data]
    
    result = forecast_profit(records, days=request.days)
    
    if "error" in result:
        # If there's an error indicating too little data, return 400
        if "Not enough historical data points" in result["error"]:
             raise HTTPException(status_code=400, detail=result["error"])
        else:
             raise HTTPException(status_code=500, detail=f"Forecasting error: {result['error']}")

    return {
        "status": "success",
        "forecast": result["forecast"],
        "trend": result["trend"],
        "confidence": result["confidence"],
        "days_predicted": len(result["forecast"])
    }
