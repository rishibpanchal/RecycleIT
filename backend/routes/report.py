"""
routes/report.py — AI Report Generator route
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from dataclasses import asdict
from typing import Optional

from report_agent import ReportAgent

router = APIRouter(prefix="/report", tags=["Report"])


@router.post("/generate")
@router.get("/generate")
async def generate_report(
    scenario: Optional[str] = Query(None, description="Filter by scenario (partial match)"),
    vendor: Optional[str] = Query(None, description="Filter by vendor (partial match)"),
    material: Optional[str] = Query(None, description="Filter by material type"),
):
    """
    Run the AI Report Agent on the transaction dataset and return a structured report.
    All analysis is computed fresh from disk each time.
    Includes statistical anomaly detection + Gemini-generated narrative.
    """
    try:
        agent = ReportAgent()
        result = agent.generate(
            scenario_filter=scenario,
            vendor_filter=vendor,
            material_filter=material,
        )
        return JSONResponse(content=asdict(result))
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"error": f"Dataset not found: {e}"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
