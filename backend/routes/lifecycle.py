"""
routes/lifecycle.py
====================
Provides lifecycle/journey information for a single transaction entry or material node.

Endpoints:
  GET /api/lifecycle/{transaction_id}?scenario=1  → full lifecycle detail for a transaction
  GET /api/lifecycle/node/{node_id}?scenario=1    → complete lifecycle view for a material node
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/lifecycle", tags=["lifecycle"])

ROOT_DIR = Path(__file__).parent.parent.parent


def _load_report(scenario: int) -> dict:
    name = f"traceability_report_scenario_{scenario}.json"
    path = ROOT_DIR / name
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Report for scenario {scenario} not found.")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/{transaction_id}")
def get_lifecycle(
    transaction_id: str,
    scenario: int = Query(default=1, ge=1, le=6)
):
    """
    Return full lifecycle details for a given transaction_id.
    This includes:
      - The edge record itself (source, dest, qty, loss, status, etc.)
      - The full upstream journey chain traced back to root sources
      - The downstream journey traced forward to terminal sinks
      - Node details for each hop
    """
    report = _load_report(scenario)
    edges = report.get("edge_summary", [])
    nodes = report.get("node_summary", [])

    # Build look-up maps
    node_map = {n["id"]: n for n in nodes}

    # Find the target edge
    target_edge = None
    for e in edges:
        if e.get("transaction_id") == transaction_id:
            target_edge = e
            break

    if not target_edge:
        raise HTTPException(status_code=404, detail=f"Transaction '{transaction_id}' not found in scenario {scenario}.")

    # Build adjacency maps for graph traversal
    # edges_by_source: source_node_id -> list of edges leaving that node
    # edges_by_dest:   dest_node_id   -> list of edges arriving at that node
    edges_by_source: dict[str, list] = {}
    edges_by_dest: dict[str, list] = {}
    for e in edges:
        src = e.get("from", "")
        dst = e.get("to", "")
        edges_by_source.setdefault(src, []).append(e)
        edges_by_dest.setdefault(dst, []).append(e)

    def _node_info(node_id: str) -> dict:
        n = node_map.get(node_id, {})
        return {
            "id": node_id,
            "label": n.get("label", node_id),
            "lifecycle_label": n.get("lifecycle_label", "Unknown"),
            "phase": n.get("phase", "UNKNOWN"),
            "warehouse_label": n.get("warehouse_label", "—"),
            "last_known_qty": n.get("last_known_qty", 0),
            "is_root_source": n.get("is_root_source", False),
            "is_terminal_sink": n.get("is_terminal_sink", False),
        }

    def _trace_upstream(start_node: str, depth: int = 0, visited: set = None) -> list:
        """BFS/DFS upstream tracing — returns ordered list of hops."""
        if visited is None:
            visited = set()
        if start_node in visited or depth > 10:
            return []
        visited.add(start_node)
        hops = []
        for e in edges_by_dest.get(start_node, []):
            src = e.get("from", "")
            hops.insert(0, {
                "edge": e,
                "from_node": _node_info(src),
                "to_node": _node_info(start_node),
                "direction": "upstream",
            })
            hops = _trace_upstream(src, depth + 1, visited) + hops
        return hops

    def _trace_downstream(start_node: str, depth: int = 0, visited: set = None) -> list:
        """BFS/DFS downstream tracing — returns ordered list of hops."""
        if visited is None:
            visited = set()
        if start_node in visited or depth > 10:
            return []
        visited.add(start_node)
        hops = []
        for e in edges_by_source.get(start_node, []):
            dst = e.get("to", "")
            hops.append({
                "edge": e,
                "from_node": _node_info(start_node),
                "to_node": _node_info(dst),
                "direction": "downstream",
            })
            hops += _trace_downstream(dst, depth + 1, visited)
        return hops

    from_node_id = target_edge.get("from", "")
    to_node_id = target_edge.get("to", "")

    upstream_chain = _trace_upstream(from_node_id)
    downstream_chain = _trace_downstream(to_node_id)

    # The current transaction as a single hop (the "pivot" event)
    pivot_hop = {
        "edge": target_edge,
        "from_node": _node_info(from_node_id),
        "to_node": _node_info(to_node_id),
        "direction": "pivot",
    }

    # Full journey = upstream + pivot + downstream (deduplicate by transaction_id)
    all_hops = upstream_chain + [pivot_hop] + downstream_chain

    # Unique lifecycle stages encountered
    lifecycle_stages = []
    seen_stages = set()
    for h in all_hops:
        stage = h["to_node"].get("lifecycle_label") or h["from_node"].get("lifecycle_label")
        if stage and stage not in seen_stages:
            lifecycle_stages.append(stage)
            seen_stages.add(stage)

    # Yield summary along the path
    total_input = all_hops[0]["edge"].get("quantity", 0) if all_hops else 0
    total_output = all_hops[-1]["to_node"]["last_known_qty"] if all_hops else 0
    total_loss_qty = sum(h["edge"].get("loss_qty", 0) for h in all_hops)
    cumulative_yield = round((total_output / total_input * 100), 2) if total_input > 0 else 0

    return {
        "transaction_id": transaction_id,
        "scenario": scenario,
        "target_edge": target_edge,
        "lifecycle_stages": lifecycle_stages,
        "journey": {
            "upstream": upstream_chain,
            "pivot": pivot_hop,
            "downstream": downstream_chain,
            "all_hops": all_hops,
        },
        "summary": {
            "total_hops": len(all_hops),
            "total_input_qty": total_input,
            "total_output_qty": total_output,
            "total_loss_qty": round(total_loss_qty, 2),
            "cumulative_yield_pct": cumulative_yield,
            "has_anomaly": target_edge.get("is_anomaly", False),
        }
    }


@router.get("/node/{node_id}")
def get_node_lifecycle(
    node_id: str,
    scenario: int = Query(default=1, ge=1, le=6)
):
    """
    Return complete lifecycle view for a material node.
    Shows all upstream sources and downstream destinations for this node.
    """
    report = _load_report(scenario)
    edges = report.get("edge_summary", [])
    nodes = report.get("node_summary", [])

    # Build look-up maps
    node_map = {n["id"]: n for n in nodes}
    
    # Attempt to find the specific node or resolve it as a batch ID
    # If the UI sends "INV-B1001", we find the latest "INV-B1001-X" node.
    target_node = node_map.get(node_id)
    actual_node_id = node_id
    
    if not target_node:
        search_id = node_id
        if node_id.startswith("INV-"):
            parts = node_id.split("-")
            if len(parts) == 2: # e.g. "INV-B1001"
                search_id = parts[1] # "B1001"
        
        # Find the most recent node belonging to this batch
        latest_match = None
        for n in nodes:
            n_id = n["id"]
            # Extract batch base from node ID
            b_id = n_id
            if n_id.startswith("INV-"):
                p = n_id.split("-")
                if len(p) >= 2:
                    b_id = p[1]
            
            if b_id == search_id or n_id == node_id:
                latest_match = n
                
        if latest_match:
            target_node = latest_match
            actual_node_id = target_node["id"]
        else:
            raise HTTPException(status_code=404, detail=f"Node or Batch '{node_id}' not found in scenario {scenario}.")

    # From here on, use actual_node_id for tracing
    node_id = actual_node_id

    # Build adjacency maps
    edges_by_source: dict[str, list] = {}
    edges_by_dest: dict[str, list] = {}
    for e in edges:
        src = e.get("from", "")
        dst = e.get("to", "")
        edges_by_source.setdefault(src, []).append(e)
        edges_by_dest.setdefault(dst, []).append(e)

    def _node_info(node_id: str) -> dict:
        n = node_map.get(node_id, {})
        return {
            "id": node_id,
            "label": n.get("label", node_id),
            "lifecycle_label": n.get("lifecycle_label", "Unknown"),
            "phase": n.get("phase", "UNKNOWN"),
            "warehouse_label": n.get("warehouse_label", "—"),
            "last_known_qty": n.get("last_known_qty", 0),
            "is_root_source": n.get("is_root_source", False),
            "is_terminal_sink": n.get("is_terminal_sink", False),
        }

    def _trace_upstream(start_node: str, depth: int = 0, visited: set = None) -> list:
        if visited is None:
            visited = set()
        if start_node in visited or depth > 10:
            return []
        visited.add(start_node)
        hops = []
        for e in edges_by_dest.get(start_node, []):
            src = e.get("from", "")
            hops.insert(0, {
                "edge": e,
                "from_node": _node_info(src),
                "to_node": _node_info(start_node),
                "direction": "upstream",
            })
            hops = _trace_upstream(src, depth + 1, visited) + hops
        return hops

    def _trace_downstream(start_node: str, depth: int = 0, visited: set = None) -> list:
        if visited is None:
            visited = set()
        if start_node in visited or depth > 10:
            return []
        visited.add(start_node)
        hops = []
        for e in edges_by_source.get(start_node, []):
            dst = e.get("to", "")
            hops.append({
                "edge": e,
                "from_node": _node_info(start_node),
                "to_node": _node_info(dst),
                "direction": "downstream",
            })
            hops += _trace_downstream(dst, depth + 1, visited)
        return hops

    # Trace full upstream and downstream chains
    upstream_chain = _trace_upstream(node_id)
    downstream_chain = _trace_downstream(node_id)
    all_hops = upstream_chain + downstream_chain

    # Unique lifecycle stages
    lifecycle_stages = []
    seen_stages = set()
    for h in all_hops:
        stage = h["to_node"].get("lifecycle_label") or h["from_node"].get("lifecycle_label")
        if stage and stage not in seen_stages:
            lifecycle_stages.append(stage)
            seen_stages.add(stage)
    
    # Add current node's stage if not already present
    current_stage = target_node.get("lifecycle_label", "Unknown")
    if current_stage and current_stage not in seen_stages:
        lifecycle_stages.append(current_stage)

    # Calculate totals
    total_input = upstream_chain[0]["edge"].get("quantity", 0) if upstream_chain else target_node.get("last_known_qty", 0)
    total_output = downstream_chain[-1]["to_node"]["last_known_qty"] if downstream_chain else target_node.get("last_known_qty", 0)
    total_loss_qty = sum(h["edge"].get("loss_qty", 0) for h in all_hops)
    cumulative_yield = round((total_output / total_input * 100), 2) if total_input > 0 else 0

    return {
        "node_id": node_id,
        "scenario": scenario,
        "target_node": _node_info(node_id),
        "lifecycle_stages": lifecycle_stages,
        "journey": {
            "upstream": upstream_chain,
            "downstream": downstream_chain,
            "all_hops": all_hops,
        },
        "summary": {
            "total_hops": len(all_hops),
            "total_input_qty": total_input,
            "total_output_qty": total_output,
            "total_loss_qty": round(total_loss_qty, 2),
            "cumulative_yield_pct": cumulative_yield,
        }
    }
