"""
routes/graph.py
=================
Interactive graph exploration endpoints.
Supports forward/backward tracing and node detail lookup.

Endpoints:
  GET /api/graph/node/{node_id}            → single node details
  GET /api/graph/trace/forward/{node_id}   → all descendants
  GET /api/graph/trace/backward/{node_id}  → all ancestors
  GET /api/graph/path                      → shortest path between two nodes
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/graph", tags=["graph"])

ROOT_DIR = Path(__file__).parent.parent.parent


def _load_report(scenario: int) -> dict:
    path = ROOT_DIR / f"traceability_report_scenario_{scenario}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Report for scenario {scenario} not found.")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _index_nodes(report: dict) -> dict:
    return {n["id"]: n for n in report.get("node_summary", [])}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/node/{node_id}")
def get_node(node_id: str, scenario: int = Query(default=1, ge=1, le=6)):
    """Return full metadata for a single inventory node."""
    report = _load_report(scenario)
    idx = _index_nodes(report)
    if node_id not in idx:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found.")
    node = idx[node_id]
    # Attach edges involving this node
    edges = report.get("edge_summary", [])
    outgoing = [e for e in edges if e["from"] == node_id]
    incoming = [e for e in edges if e["to"] == node_id]
    return {
        "node": node,
        "incoming_edges": incoming,
        "outgoing_edges": outgoing,
    }


@router.get("/trace/forward/{node_id}")
def trace_forward(node_id: str, scenario: int = Query(default=1, ge=1, le=6)):
    """Return all descendants of a node (forward trace)."""
    report = _load_report(scenario)
    insights = report.get("insights", {})
    fwd = insights.get("forward_trace", {})
    # If the pre-computed trace matches the requested node, return it
    if fwd.get("start") == node_id:
        return fwd
    # Otherwise compute on-the-fly using edge adjacency
    edges = report.get("edge_summary", [])
    adj: dict[str, list] = {}
    for e in edges:
        adj.setdefault(e["from"], []).append(e["to"])
    visited, queue = set(), [node_id]
    path_edges = []
    while queue:
        cur = queue.pop(0)
        for nxt in adj.get(cur, []):
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)
                path_edges.append(next((e for e in edges if e["from"] == cur and e["to"] == nxt), {}))
    return {
        "start": node_id,
        "descendants": list(visited),
        "path_edges": path_edges,
        "count": len(visited),
    }


@router.get("/trace/backward/{node_id}")
def trace_backward(node_id: str, scenario: int = Query(default=1, ge=1, le=6)):
    """Return all ancestors of a node (backward trace)."""
    report = _load_report(scenario)
    insights = report.get("insights", {})
    bwd = insights.get("backward_trace", {})
    if bwd.get("end") == node_id:
        return bwd
    edges = report.get("edge_summary", [])
    rev_adj: dict[str, list] = {}
    for e in edges:
        rev_adj.setdefault(e["to"], []).append(e["from"])
    visited, queue = set(), [node_id]
    path_edges = []
    while queue:
        cur = queue.pop(0)
        for prev in rev_adj.get(cur, []):
            if prev not in visited:
                visited.add(prev)
                queue.append(prev)
                path_edges.append(next((e for e in edges if e["from"] == prev and e["to"] == cur), {}))
    return {
        "end": node_id,
        "ancestors": list(visited),
        "path_edges": path_edges,
        "count": len(visited),
    }


@router.get("/path")
def shortest_path(
    source: str = Query(..., description="Start node ID"),
    target: str = Query(..., description="End node ID"),
    scenario: int = Query(default=1, ge=1, le=6),
):
    """BFS shortest path between two nodes."""
    report = _load_report(scenario)
    edges = report.get("edge_summary", [])
    adj: dict[str, list] = {}
    for e in edges:
        adj.setdefault(e["from"], []).append(e["to"])

    # BFS
    queue = [[source]]
    visited = {source}
    while queue:
        path = queue.pop(0)
        node = path[-1]
        if node == target:
            path_edges = []
            for i in range(len(path) - 1):
                edge = next((e for e in edges if e["from"] == path[i] and e["to"] == path[i+1]), {})
                path_edges.append(edge)
            return {"source": source, "target": target, "path": path, "edges": path_edges, "length": len(path) - 1}
        for nxt in adj.get(node, []):
            if nxt not in visited:
                visited.add(nxt)
                queue.append(path + [nxt])

    raise HTTPException(status_code=404, detail=f"No path found from '{source}' to '{target}'.")
