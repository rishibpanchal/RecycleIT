"""
routes/traceability.py
========================
Serves pre-computed traceability report JSON files for the dashboard.

Endpoints:
  GET /api/traceability/report            → full report (scenario 1 by default)
  GET /api/traceability/report/{scenario} → specific scenario (1-6)
  GET /api/traceability/scenarios         → list available scenarios
  GET /api/traceability/summary           → metadata + yield summary only
  GET /api/traceability/nodes             → node list
  GET /api/traceability/edges             → edge list
  GET /api/traceability/analytics         → yield + graph analytics
  GET /api/traceability/anomalies         → anomalies list
  GET /api/traceability/sankey            → sankey diagram data
"""

import json
from pathlib import Path
from functools import lru_cache
from datetime import datetime
import uuid
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/traceability", tags=["traceability"])

class MaterialCreate(BaseModel):
    material: str
    quantity: float
    location: str
    phase: str

# Root of repository (two levels up from routes/)
ROOT_DIR = Path(__file__).parent.parent.parent


def _report_path(scenario: int) -> Path:
    name = f"traceability_report_scenario_{scenario}.json"
    return ROOT_DIR / name


def _load_report(scenario: int) -> dict:
    path = _report_path(scenario)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Report for scenario {scenario} not found.")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/scenarios")
def list_scenarios():
    """Return which scenario reports exist on disk."""
    available = []
    for i in range(1, 7):
        p = _report_path(i)
        if p.exists():
            available.append({
                "scenario": i,
                "label": f"Scenario {i}",
                "file": p.name,
                "size_kb": round(p.stat().st_size / 1024, 1),
            })
    return {"scenarios": available, "count": len(available)}


@router.get("/report")
def get_report(scenario: int = Query(default=1, ge=1, le=6)):
    """Full traceability report for a given scenario (default: 1)."""
    return _load_report(scenario)


@router.get("/report/{scenario}")
def get_report_by_path(scenario: int):
    """Full traceability report via path param."""
    return _load_report(scenario)


@router.get("/summary")
def get_summary(scenario: int = Query(default=1, ge=1, le=6)):
    """High-level summary: metadata + yield only (lightweight)."""
    report = _load_report(scenario)
    return {
        "metadata": report.get("metadata", {}),
        "yield_analytics": {
            "overall_input_qty":     report.get("yield_analytics", {}).get("overall_input_qty"),
            "overall_output_qty":    report.get("yield_analytics", {}).get("overall_output_qty"),
            "overall_yield_percent": report.get("yield_analytics", {}).get("overall_yield_percent"),
            "loss_hotspots":         report.get("yield_analytics", {}).get("loss_hotspots", []),
        },
    }


@router.get("/nodes")
def get_nodes(scenario: int = Query(default=1, ge=1, le=6)):
    """All nodes with their attributes."""
    report = _load_report(scenario)
    return {"nodes": report.get("node_summary", []), "count": len(report.get("node_summary", []))}


@router.get("/edges")
def get_edges(scenario: int = Query(default=1, ge=1, le=6)):
    """All edges with their attributes."""
    report = _load_report(scenario)
    return {"edges": report.get("edge_summary", []), "count": len(report.get("edge_summary", []))}


@router.get("/analytics")
def get_analytics(scenario: int = Query(default=1, ge=1, le=6)):
    """Yield analytics + graph analytics (centrality, critical path)."""
    report = _load_report(scenario)
    return {
        "yield_analytics":  report.get("yield_analytics", {}),
        "graph_analytics":  report.get("graph_analytics", {}),
    }


@router.get("/anomalies")
def get_anomalies(scenario: int = Query(default=1, ge=1, le=6)):
    """Detected anomalies (ghost inventory, correctly rejected lots)."""
    report = _load_report(scenario)
    return {
        "anomalies": report.get("insights", {}).get("anomalies", []),
        "count": report.get("metadata", {}).get("anomalies_detected", 0),
    }

@router.get("/inventory")
def get_inventory(scenario: int = Query(default=1, ge=1, le=6)):
    """Fetch structured inventory data for the inventory page."""
    report = _load_report(scenario)
    nodes = report.get("node_summary", [])
    
    # Metrics to aggregate
    total_qty = 0
    
    # Map to track the latest state of each unique batch
    batch_map = {}
    
    for node in nodes:
        node_id = node.get("id", "")
        # Get quantity with fallback keys
        qty = node.get("last_known_qty") or node.get("quantity", 0)
        is_root = node.get("is_root_source", False)
        
        # Total Inventory counts every material entrance into the system
        if is_root:
            total_qty += qty
            
        # Exclude virtual/source nodes from the displayed list
        if node_id == "COLLECTION_SOURCE" or not node_id:
            continue
            
        # Extract Batch ID (e.g. INV-B1001-1 -> B1001)
        batch_id = node_id
        if node_id.startswith("INV-"):
            parts = node_id.split("-")
            if len(parts) >= 2:
                batch_id = parts[1]
                
        # In a chronological report, the last node for a batch represents its current status
        batch_map[batch_id] = node

    inventory_items = []
    # Stock status metrics calculated from the current state (latest stage) of each batch
    available_qty = 0
    processing_qty = 0
    quality_pending_qty = 0
    
    for b_id in sorted(batch_map.keys()):
        node = batch_map[b_id]
        qty = node.get("last_known_qty") or node.get("quantity", 0)
        label = node.get("label", "Unknown")
        if label == "NULL":
            label = node.get("lifecycle_label", "Batch")
            
        phase = node.get("phase", "UNKNOWN")
        is_root = node.get("is_root_source", False)
        is_terminal = node.get("is_terminal_sink", False)
        
        # Status derivation
        status = "Available"
        if phase in ["PRE-PROCESS", "WASHING", "PROCESSING"]:
            status = "Processing"
            processing_qty += qty
        elif phase == "QUALITY":
            status = "Quality Check"
            quality_pending_qty += qty
        elif phase == "LOGISTICS":
            status = "In Transit"
        elif is_terminal:
            status = "Processed"
            available_qty += qty # Finished goods available
        elif is_root:
            available_qty += qty # Raw material available
            
        # Display material label: group INV-B1001-1, INV-B1001-2 -> INV-B1001
        display_id = f"INV-{b_id}" if not b_id.startswith("INV") else b_id
        display_label = label
        if "-" in display_label and display_label.startswith("INV-"):
            p = display_label.split("-")
            if len(p) >= 2:
                display_label = f"{p[0]}-{p[1]}"
                
        # Trend indicators
        trend = "up" if hash(b_id) % 3 == 0 else "down" if hash(b_id) % 3 == 1 else "stable"
        change = abs(hash(b_id)) % 15
        
        inventory_items.append({
            "id": display_id,
            "material": display_label,
            "quantity": qty,
            "unit": "KG",
            "location": node.get("warehouse_label", "Unknown Facility"),
            "status": status,
            "trend": trend,
            "change": change
        })
        
    return {
        "nodes": inventory_items,
        "metrics": {
            "total_inventory": f"{total_qty:,.0f} KG",
            "available_stock": f"{available_qty:,.0f} KG",
            "in_processing": f"{processing_qty:,.0f} KG",
            "quality_pending": f"{quality_pending_qty:,.2f} KG" if quality_pending_qty > 0 else "0 KG",
        }
    }





@router.get("/sankey")
def get_sankey(scenario: int = Query(default=1, ge=1, le=6)):
    """Sankey diagram nodes and links for material flow visualization."""
    report = _load_report(scenario)
    return report.get("yield_analytics", {}).get("sankey", {"nodes": [], "links": []})

@router.get("/sankey/hover")
def get_sankey_hover(
    type: str = Query(..., description="'link' or 'node'"),
    source: str = Query(None),
    target: str = Query(None),
    node_id: str = Query(None),
    scenario: int = Query(default=1, ge=1, le=6)
):
    """Fetch specific details for Sankey hover interactions to offload frontend computation."""
    report = _load_report(scenario)
    sankey_data = report.get("yield_analytics", {}).get("sankey", {"nodes": [], "links": []})
    links = sankey_data.get("links", [])
    
    if type == "link":
        if not source or not target:
            raise HTTPException(400, detail="Missing source or target for link hover")
        
        # Find the specific link
        link_val = 0
        for l in links:
            if l.get("source") == source and l.get("target") == target:
                link_val = l.get("value", 0)
                break
                
        # Calculate percentage change for the source node
        in_flow = sum(l.get("value", 0) for l in links if l.get("target") == source)
        out_flow = sum(l.get("value", 0) for l in links if l.get("source") == source)
        
        is_lossy = in_flow > 0 and out_flow < in_flow * 0.95
        pct = ((out_flow - in_flow) / in_flow * 100) if in_flow > 0 else None
        
        return {
            "type": "link",
            "source": source,
            "target": target,
            "value": link_val,
            "pct": pct,
            "isLossy": is_lossy
        }
        
    elif type == "node":
        if not node_id:
            raise HTTPException(400, detail="Missing node_id for node hover")
            
        in_flow = sum(l.get("value", 0) for l in links if l.get("target") == node_id)
        out_flow = sum(l.get("value", 0) for l in links if l.get("source") == node_id)
        batch_count = sum(1 for l in links if l.get("target") == node_id or l.get("source") == node_id)
        
        return {
            "type": "node",
            "id": node_id,
            "inFlow": in_flow,
            "outFlow": out_flow,
            "batchCount": batch_count
        }
        
    raise HTTPException(400, detail="Invalid hover type")

@router.post("/material")
def add_material(data: MaterialCreate, scenario: int = Query(default=1, ge=1, le=6)):
    """Manually add a new material batch to the inventory (persists to JSON)."""
    report = _load_report(scenario)
    nodes = report.get("node_summary", [])
    
    # Generate unique ID
    new_id = f"MAT-{uuid.uuid4().hex[:6].upper()}"
    
    new_node = {
        "id": new_id,
        "label": data.material,
        "lifecycle_label": data.phase.capitalize(),
        "phase": data.phase.upper(),
        "warehouse_label": data.location,
        "last_known_qty": data.quantity,
        "is_root_source": True,  # Manually added materials are treated as sources
        "is_terminal_sink": False,
        "built_at": datetime.now().isoformat()
    }
    
    nodes.append(new_node)
    report["node_summary"] = nodes
    
    # Save back to disk
    path = _report_path(scenario)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to save report: {e}")
        
    return {"status": "success", "node": new_node}

class NaturalLanguageQuery(BaseModel):
    text: str

@router.post("/extract-material")
def extract_material(query: NaturalLanguageQuery):
    """Parses natural language input to extract material details using Gemini."""
    import os
    import json
    
    # Prioritize plain API Keys (which must be strings)
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    
    # If no API key, check for GOOGLE_APPLICATION_CREDENTIALS
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    
    # Logic for initializing Gemini reliably
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        # If we have an API key, use it directly
        if api_key:
            llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0.0, google_api_key=api_key)
        # If no key but we have creds_path, and it looks like a path/JSON, let the SDK discover it
        elif creds_path:
            # Langchain Google GenAI will automatically pick up GOOGLE_APPLICATION_CREDENTIALS 
            # from the environment if no google_api_key is provided
            llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0.0)
        else:
            raise HTTPException(500, detail="No Gemini API Key or Google Credentials found in environment.")

        prompt = f"""
        Extract the following information from the user's natural language material entry.
        Return ONLY a valid JSON object with the exact keys below, and no markdown formatting or backticks.
        
        Keys:
        - "material": string (e.g., "HDPE", "PET Flakes", "Unknown Material")
        - "quantity": number (e.g., 500)
        - "location": string (e.g., "Warehouse A", "Bay 4", "Facility")
        - "phase": string (MUST be one of: "PRE-PROCESS", "WASHING", "PROCESSING", "QUALITY", "LOGISTICS") 
                 
        User Entry: "{query.text}"
        """
        
        msg = llm.invoke(prompt)
        # Handle cases where msg.content might be a list or complex object
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        
        # Robust extraction: find the first { and last }
        clean_content = content.strip()
        start = clean_content.find("{")
        end = clean_content.rfind("}")
        
        if start != -1 and end != -1:
            clean_content = clean_content[start:end+1]
            
        try:
            data = json.loads(clean_content)
        except Exception:
            try:
                # Fallback if Gemini returns Python dict syntax (single quotes)
                import ast
                data = ast.literal_eval(clean_content)
            except Exception:
                print(f"RAW GEMINI OUTPUT FAILED PARSING: {content}")
                raise ValueError("Could not parse AI response into a structured dictionary.")
                
        # Ensure correct types
        return {
            "material": str(data.get("material", "Unknown")),
            "quantity": float(data.get("quantity", 0)),
            "location": str(data.get("location", "Unknown")),
            "phase": str(data.get("phase", "PRE-PROCESS")).upper()
        }
    except Exception as e:
        # Log the full error to stdout for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=f"Extraction failed: {str(e)}")
