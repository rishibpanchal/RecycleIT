"""
routes/sustainability.py
========================
Computes sustainability metrics from traceability data using research-based formulas.

Metrics calculated:
  - Carbon Offset: kg CO2 saved by recycling vs. virgin production
  - Water Saved: liters saved by recycling vs. virgin production
  - Energy Recovered: kWh recovered from processing activities
  - Landfill Diversion: percentage of waste diverted from landfill

Sources:
  - EPA Waste & Materials (https://www.epa.gov/waste/sustainable-materials-management)
  - Global Recycling Coalition (https://www.globalrecycling.org/)
  - WRAP UK Sustainability Reports

Formulas:
  1. Carbon Offset = Recycled material (kg) * Carbon savings factor (kg CO2/kg)
  2. Water Saved = Recycled material (kg) * Water savings factor (L/kg)
  3. Energy Recovered = Total energy consumed in processing (kWh)
  4. Landfill Diversion = (Material diverted / Total input) * 100
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List

router = APIRouter(prefix="/api/traceability", tags=["sustainability"])

ROOT_DIR = Path(__file__).parent.parent.parent

# ── Research-based sustainability factors ────────────────────────────────────
# All factors are based on life cycle assessment (LCA) studies and EPA data

MATERIAL_FACTORS = {
    # PET Plastics: kg material → kg CO2 saved, L water saved
    # Source: Boucher et al. (2017) - Plastic Debris in the Ocean
    "PET_PLASTICS": {
        "carbon_factor": 3.2,  # kg CO2 saved per kg recycled vs virgin
        "water_factor": 24.0,  # liters saved per kg recycled
        "energy_factor": 0.85,  # kWh per kg for recycling process
    },
    # HDPE: High-Density Polyethylene
    "HDPE": {
        "carbon_factor": 2.8,
        "water_factor": 18.5,
        "energy_factor": 1.1,
    },
    # Aluminum: Most energy-intensive but highest recycling benefit
    # Source: Aluminum Association - Recycling saves 95% energy vs virgin
    "ALUMINUM": {
        "carbon_factor": 12.5,  # kg CO2 saved per kg recycled (95% energy reduction)
        "water_factor": 450.0,  # liters saved per kg recycled
        "energy_factor": 2.8,
    },
    # Glass: 100% recyclable with no quality loss
    # Source: Glass Packaging Institute
    "GLASS": {
        "carbon_factor": 0.5,  # kg CO2 saved per kg recycled
        "water_factor": 2.0,  # liters saved per kg recycled
        "energy_factor": 0.15,
    },
    # Paper & Cardboard
    # Source: American Forest & Paper Association
    "PAPER": {
        "carbon_factor": 1.2,
        "water_factor": 10.0,
        "energy_factor": 0.45,
    },
    # Generic default for unknown materials
    "DEFAULT": {
        "carbon_factor": 2.0,
        "water_factor": 15.0,
        "energy_factor": 0.8,
    }
}

# Energy recovery factors by process stage
ENERGY_RECOVERY_FACTORS = {
    "PROCESSING": 0.95,  # 95% energy recovery from heat processes
    "MANUFACTURING": 0.75,  # 75% recovery from manufacturing
    "QUALITY": 0.40,  # 40% recovery from quality checks
}


def _load_report(scenario: int) -> dict:
    """Load traceability report from disk."""
    path = ROOT_DIR / f"traceability_report_scenario_{scenario}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Report for scenario {scenario} not found.")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _infer_material_type(node: dict) -> str:
    """
    Infer material type from node attributes.

    Looks at:
    - Node phase (INTAKE, PROCESSING, MANUFACTURING, etc.)
    - Warehouse code and label
    - Node remarks/metadata

    Returns a key from MATERIAL_FACTORS, defaulting to "DEFAULT"
    """
    node_id = node.get("id", "")
    label = node.get("label", "").upper()
    phase = node.get("phase", "").upper()
    warehouse = node.get("warehouse_label", "").upper()
    remarks = node.get("remarks", "").upper() if "remarks" in node else ""

    # Rule-based material detection
    if any(x in label + remarks for x in ["PET", "POLYETHYLENE_TEREPHTHALATE"]):
        return "PET_PLASTICS"
    elif any(x in label + remarks for x in ["HDPE", "HIGH_DENSITY", "POLYETHYLENE"]):
        return "HDPE"
    elif any(x in label + remarks for x in ["ALUMINUM", "ALUMINIUM", "METAL"]):
        return "ALUMINUM"
    elif any(x in label + remarks for x in ["GLASS", "GLASS_BOTTLE"]):
        return "GLASS"
    elif any(x in label + remarks for x in ["PAPER", "CARDBOARD", "CARDBOARD_BOX"]):
        return "PAPER"

    return "DEFAULT"


def _calculate_sustainability_metrics(report: dict) -> Dict:
    """
    Compute sustainability metrics from the traceability report.

    Returns:
        Dict with carbon_offset, water_saved, energy_recovered, landfill_diversion
    """
    nodes = report.get("node_summary", [])
    edges = report.get("edge_summary", [])
    metadata = report.get("metadata", {})

    # Aggregate metrics
    total_carbon_offset = 0.0  # kg CO2
    total_water_saved = 0.0    # liters
    total_energy_recovered = 0.0  # kWh
    total_input_qty = 0.0      # kg
    total_diverted_qty = 0.0   # kg

    # Process each node to calculate metrics
    for node in nodes:
        # Only process inventory and processing nodes (skip external sources)
        if node.get("node_type") == "EXTERNAL_SOURCE" and node.get("is_root_source"):
            # Root sources represent total input
            total_input_qty += node.get("last_known_qty", 0)
            total_diverted_qty += node.get("last_known_qty", 0)
            continue

        # Get material type for this node
        material_type = _infer_material_type(node)
        factors = MATERIAL_FACTORS.get(material_type, MATERIAL_FACTORS["DEFAULT"])

        # Get the actual quantity processed at this node
        qty = node.get("last_known_qty", 0)

        if qty > 0:
            # Calculate carbon offset
            total_carbon_offset += qty * factors["carbon_factor"]

            # Calculate water saved
            total_water_saved += qty * factors["water_factor"]

            # Calculate energy recovered based on node phase
            phase = node.get("phase", "").upper()
            if phase in ENERGY_RECOVERY_FACTORS:
                energy_consumed = qty * factors["energy_factor"]
                recovery_rate = ENERGY_RECOVERY_FACTORS[phase]
                total_energy_recovered += energy_consumed * recovery_rate

    # Calculate total loss (waste to landfill)
    total_loss_qty = metadata.get("total_loss_qty", 0)
    if total_input_qty > 0:
        landfill_diversion_percent = ((total_diverted_qty - total_loss_qty) / total_input_qty) * 100
    else:
        landfill_diversion_percent = 0.0

    # Apply rounding and validation
    metrics = {
        "carbon_offset_kg_co2": round(total_carbon_offset, 2),
        "carbon_offset_metric_tons": round(total_carbon_offset / 1000, 3),
        "water_saved_liters": round(total_water_saved, 2),
        "water_saved_kiloliters": round(total_water_saved / 1000, 3),
        "energy_recovered_kwh": round(total_energy_recovered, 2),
        "landfill_diversion_percent": max(0, min(100, round(landfill_diversion_percent, 2))),
        "material_diverted_kg": round(total_diverted_qty - total_loss_qty, 2),
        "total_input_kg": round(total_input_qty, 2),
        "total_loss_kg": round(total_loss_qty, 2),
    }

    return metrics


def _calculate_trends(report: dict, previous_report: dict = None) -> Dict:
    """
    Calculate trends and comparisons.

    Args:
        report: Current report
        previous_report: Previous report for comparison (optional)

    Returns:
        Dict with changes and trends
    """
    current = _calculate_sustainability_metrics(report)

    trends = {
        "carbon_offset_change_percent": 0.0,
        "water_saved_change_percent": 0.0,
        "energy_recovered_change_percent": 0.0,
        "landfill_diversion_change_percent": 0.0,
    }

    if previous_report:
        previous = _calculate_sustainability_metrics(previous_report)

        # Calculate percentage changes
        if previous["carbon_offset_kg_co2"] > 0:
            trends["carbon_offset_change_percent"] = (
                (current["carbon_offset_kg_co2"] - previous["carbon_offset_kg_co2"])
                / previous["carbon_offset_kg_co2"] * 100
            )

        if previous["water_saved_liters"] > 0:
            trends["water_saved_change_percent"] = (
                (current["water_saved_liters"] - previous["water_saved_liters"])
                / previous["water_saved_liters"] * 100
            )

        if previous["energy_recovered_kwh"] > 0:
            trends["energy_recovered_change_percent"] = (
                (current["energy_recovered_kwh"] - previous["energy_recovered_kwh"])
                / previous["energy_recovered_kwh"] * 100
            )

        if previous["landfill_diversion_percent"] > 0:
            trends["landfill_diversion_change_percent"] = (
                current["landfill_diversion_percent"] - previous["landfill_diversion_percent"]
            )

    return trends


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/sustainability")
def get_sustainability_metrics(scenario: int = Query(default=1, ge=1, le=6)):
    """
    Compute sustainability metrics from traceability data.

    Returns:
        {
            "metrics": {
                "carbon_offset_kg_co2": float,
                "carbon_offset_metric_tons": float,
                "water_saved_liters": float,
                "water_saved_kiloliters": float,
                "energy_recovered_kwh": float,
                "landfill_diversion_percent": float,
                "material_diverted_kg": float,
                "total_input_kg": float,
                "total_loss_kg": float,
            },
            "formulas": {
                "carbon_offset": "kg CO2 = Recycled Material (kg) × Material Factor (kg CO2/kg)",
                "water_saved": "Liters = Recycled Material (kg) × Water Factor (L/kg)",
                "energy_recovered": "kWh = Material (kg) × Energy Factor (kWh/kg) × Recovery Rate",
                "landfill_diversion": "% = (Material Diverted / Total Input) × 100",
            },
            "material_factors": MATERIAL_FACTORS,
        }
    """
    report = _load_report(scenario)
    metrics = _calculate_sustainability_metrics(report)

    return {
        "scenario": scenario,
        "metrics": metrics,
        "formulas": {
            "carbon_offset": "kg CO2 = Recycled Material (kg) × Material Factor (kg CO2/kg)",
            "water_saved": "Liters = Recycled Material (kg) × Water Factor (L/kg)",
            "energy_recovered": "kWh = Material (kg) × Energy Factor (kWh/kg) × Recovery Rate",
            "landfill_diversion": "% = (Material Diverted / Total Input) × 100",
        },
        "sources": {
            "carbon": "EPA Waste & Materials Management + Global Recycling Coalition",
            "water": "WRAP UK + Life Cycle Assessment Studies",
            "energy": "Material-specific energy recovery factors",
            "landfill": "Calculated from traceability data",
        },
        "material_factors": MATERIAL_FACTORS,
    }


@router.get("/sustainability/comparison")
def get_sustainability_comparison(
    current_scenario: int = Query(default=1, ge=1, le=6),
    previous_scenario: int = Query(default=None, ge=1, le=6),
):
    """
    Compare sustainability metrics between two scenarios.

    Returns:
        Current metrics, previous metrics, and calculated trends/changes.
    """
    current_report = _load_report(current_scenario)
    current_metrics = _calculate_sustainability_metrics(current_report)

    previous_metrics = None
    trends = None

    if previous_scenario:
        previous_report = _load_report(previous_scenario)
        previous_metrics = _calculate_sustainability_metrics(previous_report)
        trends = _calculate_trends(current_report, previous_report)

    return {
        "current": {
            "scenario": current_scenario,
            "metrics": current_metrics,
        },
        "previous": {
            "scenario": previous_scenario,
            "metrics": previous_metrics,
        } if previous_scenario else None,
        "trends": trends,
    }
