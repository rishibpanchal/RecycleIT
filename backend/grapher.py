import pandas as pd
import networkx as nx
import json
import numpy as np
import os
from datetime import datetime, timezone

# ============================================================
#  CONSTANTS: Lifecycle Stage Definitions
#  Maps each processing mode to a canonical lifecycle stage
#  number and a human-readable label. This drives timelines
#  and Sankey position ordering on the frontend.
# ============================================================
LIFECYCLE_STAGES = {
    "INWARD":       {"stage": 1,  "label": "Collection / Inward",   "phase": "INTAKE"},
    "SEGREGATION":  {"stage": 2,  "label": "Segregation / Sorting",  "phase": "PRE-PROCESS"},
    "BALING":       {"stage": 3,  "label": "Baling",                 "phase": "PRE-PROCESS"},
    "TRANSFER":     {"stage": 4,  "label": "Transfer / Shipment",    "phase": "LOGISTICS"},
    "RECEIPT":      {"stage": 5,  "label": "Receipt at Facility",    "phase": "LOGISTICS"},
    "WASHING":      {"stage": 6,  "label": "Washing",                "phase": "PROCESSING"},
    "QC_PASS":      {"stage": 7,  "label": "QC – Passed",            "phase": "QUALITY"},
    "QC_FAIL":      {"stage": 7,  "label": "QC – Failed",            "phase": "QUALITY"},
    "RECYCLING":    {"stage": 8,  "label": "Recycling / Granulation", "phase": "PROCESSING"},
    "MIXING":       {"stage": 9,  "label": "Mixing / Blending",      "phase": "PROCESSING"},
    "PRODUCTION":   {"stage": 10, "label": "Production",             "phase": "MANUFACTURING"},
    "DISPATCH":     {"stage": 11, "label": "Dispatch",               "phase": "LOGISTICS"},
    "UNKNOWN":      {"stage": 0,  "label": "Unknown",                "phase": "UNKNOWN"},
}

# Process codes → human labels (from transaction_events)
PROCESS_CODE_LABELS = {
    "PR":  "Purchase / Inward",
    "SEG": "Segregation",
    "MB":  "Material Batch",
    "WT":  "Weight Transfer",
    "WTR": "Weight Transfer Receipt",
    "QC":  "Quality Control",
    "SD":  "Dispatch",
}

# Warehouse → human-readable location labels
WAREHOUSE_LABELS = {
    "WH-COLLECT": "Collection Center",
    "WH-WASH":    "Washing Plant",
    "WH-RECY":    "Recycling Plant",
    "WH-FACT":    "Manufacturing Factory",
}

# Node type classification based on inventory ID prefix patterns
def _classify_node(inv_id: str) -> dict:
    """Return a type & color hint for a node based on its ID."""
    inv_id_upper = inv_id.upper()
    if inv_id_upper == "NULL":
        return {"node_type": "EXTERNAL_SOURCE", "color_hint": "#94a3b8"}
    if "REJECT" in inv_id_upper:
        return {"node_type": "REJECTED_LOT",    "color_hint": "#ef4444"}
    if "GRAN" in inv_id_upper:
        return {"node_type": "GRANULES",         "color_hint": "#a855f7"}
    if "PIPE" in inv_id_upper or "PROD" in inv_id_upper:
        return {"node_type": "FINISHED_PRODUCT", "color_hint": "#22c55e"}
    if "WASH" in inv_id_upper:
        return {"node_type": "WASHED_MATERIAL",  "color_hint": "#38bdf8"}
    if "SHIP" in inv_id_upper or "RECV" in inv_id_upper:
        return {"node_type": "IN_TRANSIT",       "color_hint": "#fb923c"}
    if "BALE" in inv_id_upper or inv_id_upper.endswith("A") or inv_id_upper.endswith("B"):
        return {"node_type": "BALED_LOT",        "color_hint": "#facc15"}
    return {"node_type": "INVENTORY_LOT",        "color_hint": "#6366f1"}


# ============================================================
#  CORE: Graph Builder
# ============================================================
def standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Intelligently map various vendor column names to a standard schema."""
    aliases = {
        "transaction_id": ["transaction_id", "txn_id", "tx_id", "eventid", "event_id"],
        "tenant_id": ["tenant_id", "tenant", "org_id", "company_id"],
        "source_inventory_id": ["source_inventory_id", "src_lot_id", "source_lot_id", "source_lot", "input_lot", "source_inv"],
        "destination_inventory_id": ["destination_inventory_id", "dest_lot_id", "dest_lot", "output_lot", "target_inv"],
        "quantity": ["quantity", "source_qty", "qty", "weight", "mass"],
        "loss_percent": ["loss_percent", "loss_pct", "shrinkage_pct", "loss", "wastage_pct"],
        "mode": ["mode", "operation_mode", "action", "type", "event_mode"],
        "transform_id": ["transform_id", "txn_transform_id", "trf_id", "lineage_id"],
        "process_code": ["process_code", "process", "proc_code"],
        "status": ["status", "state", "event_status", "txn_status"],
        "transaction_date": ["transaction_date", "event_date", "date", "timestamp"],
        "warehouse_code": ["warehouse_code", "location_code", "facility", "warehouse", "warehouse_id"],
        "remarks": ["remarks", "notes", "comments", "description"]
    }

    # lower and strip for matching
    df.columns = [str(c).lower().strip() for c in df.columns]

    # Keep dest_qty if it exists before standardization
    has_dest_qty = 'dest_qty' in df.columns

    for standard_col, possible_names in aliases.items():
        if standard_col not in df.columns:
            for possible in possible_names:
                if possible in df.columns:
                    df = df.rename(columns={possible: standard_col})
                    break

    # If we have both quantity (from source_qty) and dest_qty, calculate loss_percent
    if has_dest_qty and 'dest_qty' in df.columns and 'quantity' in df.columns and 'loss_percent' not in df.columns:
        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0.0)
        df['dest_qty'] = pd.to_numeric(df['dest_qty'], errors='coerce').fillna(0.0)
        # Calculate loss_percent where source_qty > 0
        df['loss_percent'] = 0.0
        mask = df['quantity'] > 0
        df.loc[mask, 'loss_percent'] = ((df.loc[mask, 'quantity'] - df.loc[mask, 'dest_qty']) / df.loc[mask, 'quantity'] * 100)
        df['loss_percent'] = df['loss_percent'].clip(lower=0)  # No negative losses

    # Synthesize tenant_id if missing (always need it for merging)
    if "tenant_id" not in df.columns:
        df["tenant_id"] = "1"

    return df

def _load_df(filepath: str) -> pd.DataFrame:
    """Helper to load data from either .csv or .xlsx (using openpyxl)."""
    if not os.path.exists(filepath):
        base, ext = os.path.splitext(filepath)
        alt_ext = ".xlsx" if ext.lower() == ".csv" else ".csv"
        alt_path = base + alt_ext
        if os.path.exists(alt_path):
            filepath = alt_path
        else:
            raise FileNotFoundError(f"Could not find {filepath} or {alt_path}")

    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".csv":
        # Prevent pandas from converting "NULL" string to NaN
        df = pd.read_csv(filepath, keep_default_na=False, na_values=[''])
    elif ext == ".xlsx":
        # Same fix for Excel files
        df = pd.read_excel(filepath, keep_default_na=False, na_values=[''])
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    # Don't standardize here - do it after swap detection in build_traceability_graph()
    return df

def _detect_file_swap(df1: pd.DataFrame, df2: pd.DataFrame) -> tuple:
    """
    Detect if transforms and events DataFrames are swapped.
    Returns (transforms, events) in correct order.

    Transform files should have: source_inventory_id/src_lot_id/source_lot, destination_inventory_id/dest_lot_id
    Event files should have: process_code, status, event_date
    """
    df1_cols = set(str(c).lower() for c in df1.columns)
    df2_cols = set(str(c).lower() for c in df2.columns)

    # Check which DataFrame has transform-related columns
    transform_indicators = {'source_inventory_id', 'src_lot_id', 'source_lot', 'input_lot',
                           'destination_inventory_id', 'dest_lot_id', 'dest_lot', 'output_lot'}
    event_indicators = {'process_code', 'proc_code', 'process', 'status', 'state'}

    df1_has_transforms = bool(transform_indicators & df1_cols)
    df1_has_events = bool(event_indicators & df1_cols)
    df2_has_transforms = bool(transform_indicators & df2_cols)
    df2_has_events = bool(event_indicators & df2_cols)

    # If files are swapped, return them in correct order
    if df1_has_events and not df1_has_transforms and df2_has_transforms and not df2_has_events:
        print("  [INFO] Detected swapped files - auto-correcting...")
        return df2, df1  # Swap them

    return df1, df2  # Already in correct order

def build_traceability_graph(transforms_path: str, events_path: str) -> nx.DiGraph:
    """
    Reads inventory_transforms.csv/xlsx + transaction_events.csv/xlsx, merges them,
    and builds a semantically-rich Directed Graph.

    Node attributes:
        - id, label, node_type, color_hint
        - lifecycle_stage (int), lifecycle_label, phase
        - warehouse_code, warehouse_label
        - last_known_qty (float)
        - is_terminal_sink (bool) — no outgoing edges in final graph
        - is_root_source (bool)   — no incoming edges in final graph
        - transactions []         — list of dicts for all transactions touching this node

    Edge attributes:
        - transform_id, transaction_id
        - mode, mode_label, phase
        - lifecycle_stage (int), lifecycle_label
        - quantity (float), loss_percent (float), loss_qty (float)
        - process_code, process_label
        - status, transaction_date
        - warehouse_code, warehouse_label
        - is_anomaly (bool) — edge itself is REJECTED/CANCELLED
        - edge_weight       — normalized 0-1 for Sankey thickness
        - remarks
        - label (for tooltip on frontend)
    """
    print(f"Loading datasets (checking {transforms_path} & {events_path})...")
    transforms = _load_df(transforms_path)
    events = _load_df(events_path)

    # Auto-detect and fix swapped files
    transforms, events = _detect_file_swap(transforms, events)

    # Standardize column names AFTER swap detection (so aliases work correctly)
    transforms = standardize_columns(transforms)
    events = standardize_columns(events)

    # Merge on transaction_id + tenant_id
    df = transforms.merge(events, on=["transaction_id", "tenant_id"], how="left")

    # ---- Normalise / fill defaults ----
    for col in ["loss_percent", "quantity"]:
        if col not in df.columns:
            df[col] = 0.0

    df["loss_percent"]     = pd.to_numeric(df["loss_percent"], errors="coerce").fillna(0.0)
    df["quantity"]         = pd.to_numeric(df["quantity"],     errors="coerce").fillna(0.0)

    for col in ["remarks", "process_code", "status", "transaction_date", "warehouse_code", "mode", "transform_id"]:
        if col not in df.columns:
            df[col] = "UNKNOWN" if col != "remarks" and col != "transaction_date" else ""

    df["remarks"]          = df["remarks"].fillna("")
    df["process_code"]     = df["process_code"].fillna("UNKNOWN")
    df["status"]           = df["status"].fillna("UNKNOWN")
    df["transaction_date"] = df["transaction_date"].fillna("")
    df["warehouse_code"]   = df["warehouse_code"].fillna("UNKNOWN")
    df["mode"]             = df["mode"].fillna("UNKNOWN").str.upper()
    df["transform_id"]     = df["transform_id"].fillna("UNKNOWN")

    # Compute absolute loss quantity
    if "quantity" in df.columns and "loss_percent" in df.columns:
        df["loss_qty"] = (df["quantity"] * df["loss_percent"] / 100.0).round(2)
    else:
        df["loss_qty"] = 0.0

    # Lifecycle lookup: uses process_code + warehouse_code to disambiguate MB
    def _resolve_lifecycle_stage(process_code, warehouse_code, mode):
        if process_code == "MB":
            if warehouse_code == "WH-COLLECT":
                return LIFECYCLE_STAGES.get("BALING")
            elif warehouse_code == "WH-WASH":
                return LIFECYCLE_STAGES.get("WASHING")
            elif warehouse_code == "WH-RECY":
                return LIFECYCLE_STAGES.get("RECYCLING")
            elif warehouse_code == "WH-FACT":
                return LIFECYCLE_STAGES.get("PRODUCTION")
        return LIFECYCLE_STAGES.get(mode, LIFECYCLE_STAGES["UNKNOWN"])

    df["lifecycle_info"] = df.apply(
        lambda row: _resolve_lifecycle_stage(row["process_code"], row["warehouse_code"], row["mode"]), axis=1
    )
    df["lifecycle_stage"] = df["lifecycle_info"].apply(lambda x: x["stage"])
    df["lifecycle_label"] = df["lifecycle_info"].apply(lambda x: x["label"])
    df["phase"]           = df["lifecycle_info"].apply(lambda x: x["phase"])

    # Human-readable process code and warehouse labels
    df["process_label"]   = df["process_code"].apply(
        lambda c: PROCESS_CODE_LABELS.get(str(c), str(c))
    )
    df["warehouse_label"] = df["warehouse_code"].apply(
        lambda w: WAREHOUSE_LABELS.get(str(w), str(w))
    )

    # ---- Init Graph ----
    G = nx.DiGraph()
    G.graph["name"]     = "Plastic Recycling Traceability Graph"
    G.graph["version"]  = "2.0"
    G.graph["built_at"] = datetime.now(timezone.utc).isoformat() + "Z"

    # Track per-node cumulative quantity and transactions
    node_qty_map = {}   # inv_id -> latest quantity seen
    node_txn_map = {}   # inv_id -> list of transaction dicts

    print("Constructing enriched graph...")

    max_qty = float(df["quantity"].max()) if not df["quantity"].empty else 1.0

    for _, row in df.iterrows():
        source = str(row["source_inventory_id"]).strip()
        dest   = str(row["destination_inventory_id"]).strip()

        # --- SOURCE NODE ---
        if not G.has_node(source):
            cls = _classify_node(source)
            G.add_node(
                source,
                id=source,
                label=source,
                **cls,
                lifecycle_stage=int(row["lifecycle_stage"]),
                lifecycle_label=str(row["lifecycle_label"]),
                phase=str(row["phase"]),
                warehouse_code=str(row["warehouse_code"]),
                warehouse_label=str(row["warehouse_label"]),
                last_known_qty=0.0,
                is_root_source=True,
                is_terminal_sink=False,
                transactions=[],
            )
        node_qty_map[source] = float(row["quantity"])

        txn_entry = {
            "transaction_id": str(row["transaction_id"]),
            "date": str(row["transaction_date"]),
            "process_code": str(row["process_code"]),
            "process_label": str(row["process_label"]),
            "mode": str(row["mode"]),
            "lifecycle_label": str(row["lifecycle_label"]),
            "status": str(row["status"]),
            "quantity": float(row["quantity"]),
            "loss_percent": float(row["loss_percent"]),
            "loss_qty": float(row["loss_qty"]),
            "warehouse": str(row["warehouse_label"]),
            "remarks": str(row["remarks"]),
        }
        node_txn_map.setdefault(source, []).append(txn_entry)

        # --- DESTINATION NODE ---
        if not G.has_node(dest):
            cls = _classify_node(dest)
            G.add_node(
                dest,
                id=dest,
                label=dest,
                **cls,
                lifecycle_stage=int(row["lifecycle_stage"]),
                lifecycle_label=str(row["lifecycle_label"]),
                phase=str(row["phase"]),
                warehouse_code=str(row["warehouse_code"]),
                warehouse_label=str(row["warehouse_label"]),
                last_known_qty=float(row["quantity"]),
                is_root_source=False,
                is_terminal_sink=True,
                transactions=[],
            )
        # Update quantity when we see the node as a destination
        node_qty_map[dest] = float(row["quantity"])

        # --- ANOMALY DETECTION LOGIC ---
        # 1. Status based: Rejected or Cancelled
        is_rejected = str(row["status"]).upper() in ["REJECTED", "CANCELLED"]
        
        # 2. Yield based: Logic-based threshold (e.g., > 20% loss is anomalous for this process)
        # Some processes might naturally have higher loss, but 20% is a good general threshold for recycled plastics
        is_high_loss = float(row["loss_percent"]) > 20.0
        
        # 3. Quantity check: Quantity out cannot be 0 if status is APPROVED
        is_ghost_txn = float(row["quantity"]) <= 0 and str(row["status"]).upper() == "APPROVED"

        is_anomaly = is_rejected or is_high_loss or is_ghost_txn

        edge_label = (
            f"{row['lifecycle_label']} | {row['quantity']}kg"
            + (f" | ⚠ {row['status']}" if is_rejected else "")
            + (f" | ⚠ High Loss: {row['loss_percent']}%" if is_high_loss else "")
            + (f" | Loss: {row['loss_percent']}%" if (row["loss_percent"] > 0 and not is_high_loss) else "")
        )

        G.add_edge(
            source,
            dest,
            transform_id=str(row["transform_id"]),
            transaction_id=str(row["transaction_id"]),
            mode=str(row["mode"]),
            mode_label=str(row["lifecycle_label"]),
            phase=str(row["phase"]),
            lifecycle_stage=int(row["lifecycle_stage"]),
            lifecycle_label=str(row["lifecycle_label"]),
            quantity=float(row["quantity"]),
            loss_percent=float(row["loss_percent"]),
            loss_qty=float(row["loss_qty"]),
            process_code=str(row["process_code"]),
            process_label=str(row["process_label"]),
            status=str(row["status"]),
            transaction_date=str(row["transaction_date"]),
            warehouse_code=str(row["warehouse_code"]),
            warehouse_label=str(row["warehouse_label"]),
            remarks=str(row["remarks"]),
            is_anomaly=is_anomaly,
            edge_weight=round(float(row["quantity"]) / max_qty, 4),
            label=edge_label,
        )

    # ---- Post-pass: fix flags, attach quantities ----
    for node in G.nodes():
        G.nodes[node]["transactions"]     = node_txn_map.get(node, [])
        G.nodes[node]["in_degree"]        = G.in_degree(node)
        G.nodes[node]["out_degree"]       = G.out_degree(node)
        G.nodes[node]["is_root_source"]   = G.in_degree(node) == 0
        G.nodes[node]["is_terminal_sink"] = G.out_degree(node) == 0

        if G.nodes[node]["is_root_source"]:
            total_out = sum(d.get("quantity", 0.0) for _, _, d in G.out_edges(node, data=True))
            G.nodes[node]["last_known_qty"] = round(total_out, 2)
        else:
            total_in = sum(d.get("quantity", 0.0) - d.get("loss_qty", 0.0) for _, _, d in G.in_edges(node, data=True))
            G.nodes[node]["last_known_qty"] = round(total_in, 2)

        anomaly_in = sum(
            1 for _, _, d in G.in_edges(node, data=True) if d.get("is_anomaly", False)
        )
        G.nodes[node]["anomaly_incoming_count"] = anomaly_in

    print(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")
    return G


# ============================================================
#  TRACEABILITY: Forward / Backward Trace
# ============================================================
def forward_trace(G: nx.DiGraph, start_id: str) -> dict:
    if start_id not in G:
        return {"start": start_id, "descendants": [], "path_edges": []}

    descendants = list(nx.descendants(G, start_id))
    sub = G.subgraph([start_id] + descendants)
    path_edges = [
        {"from": u, "to": v, **{k: v2 for k, v2 in d.items()}}
        for u, v, d in sub.edges(data=True)
    ]
    return {
        "start": start_id,
        "descendants": descendants,
        "path_edges": path_edges,
        "count": len(descendants),
    }


def backward_trace(G: nx.DiGraph, final_id: str) -> dict:
    if final_id not in G:
        return {"end": final_id, "ancestors": [], "path_edges": []}

    ancestors = list(nx.ancestors(G, final_id))
    sub = G.subgraph([final_id] + ancestors)
    path_edges = [
        {"from": u, "to": v, **{k: v2 for k, v2 in d.items()}}
        for u, v, d in sub.edges(data=True)
    ]
    return {
        "end": final_id,
        "ancestors": ancestors,
        "path_edges": path_edges,
        "count": len(ancestors),
    }


# ============================================================
#  ANOMALY DETECTION: Broken Traces (Ghost Inventory)
# ============================================================
def find_anomalies(G: nx.DiGraph) -> list:
    """
    Finds and categorizes anomalies in the traceability graph:
    1. GHOST_INVENTORY: Material continues flowing from a REJECTED/CANCELLED lot.
    2. HIGH_LOSS_ANOMALY: Material loss percentage exceeds 20% threshold.
    3. GHOST_TRANSACTION: 0kg produced from an APPROVED status transaction.
    4. CORRECTLY_REJECTED: A transaction was rejected and correctly stopped (no downstream flow).
    """
    anomalies = []

    for u, v, data in G.edges(data=True):
        status = data.get("status", "").upper()
        is_anomaly = data.get("is_anomaly", False)
        
        # If the edge is not marked as an anomaly, skip it for these specific checks
        if not is_anomaly:
            continue

        # Check for High Loss
        # Note: The `is_anomaly` flag already incorporates `is_high_loss`.
        # We check `loss_percent > 20.0` again here to ensure it's the specific reason for this anomaly type.
        if data.get("loss_percent", 0.0) > 20.0:
            anomalies.append({
                "type": "HIGH_LOSS_ANOMALY",
                "severity": "MEDIUM" if data.get("loss_percent", 0.0) < 40.0 else "HIGH",
                "description": (
                    f"Anomalous loss of {data.get('loss_percent')}% detected at stage '{data.get('lifecycle_label')}' "
                    f"(TX-{data.get('transaction_id')}). Typical thresholds are < 20%."
                ),
                "edge": {"from": u, "to": v, "transaction_id": data.get("transaction_id"), "loss": data.get("loss_percent")}
            })
            # Continue to avoid double-counting if it's also rejected/cancelled
            continue

        # Check for Ghost Transaction (0 quantity output)
        # The `is_anomaly` flag already incorporates `is_ghost_txn`.
        if data.get("quantity", 0.0) <= 0 and status == "APPROVED":
            anomalies.append({
                "type": "GHOST_TRANSACTION",
                "severity": "HIGH",
                "description": (
                    f"Zero-quantity output detected for APPROVED transaction (TX-{data.get('transaction_id')}) "
                    f"at '{data.get('lifecycle_label')}'. Possible record error or ghost inventory creation."
                ),
                "edge": {"from": u, "to": v, "transaction_id": data.get("transaction_id")}
            })
            # Continue to avoid double-counting if it's also rejected/cancelled
            continue

        # Handle Rejected/Cancelled
        # The `is_anomaly` flag already incorporates `is_rejected`.
        if status in ["REJECTED", "CANCELLED"]:
            out_edges = list(G.out_edges(v, data=True))

            if out_edges:
                downstream_nodes = list(nx.descendants(G, v))
                anomalies.append({
                    "type": "GHOST_INVENTORY",
                    "severity": "CRITICAL",
                    "description": (
                        f"Inventory lot '{v}' was produced from a {status} transaction "
                        f"(TX-{data.get('transaction_id')}) but continued into {len(out_edges)} "
                        f"downstream step(s), contaminating {len(downstream_nodes)} node(s)."
                    ),
                    "rejected_edge": {
                        "from": u,
                        "to": v,
                        "transaction_id": data.get("transaction_id"),
                        "process": data.get("lifecycle_label"),
                        "status": status,
                    },
                    "contaminated_downstream_nodes": downstream_nodes,
                })
            else:
                anomalies.append({
                    "type": "CORRECTLY_REJECTED",
                    "rejected_edge": {
                        "from": u,
                        "to": v,
                        "transaction_id": data.get("transaction_id"),
                        "process": data.get("lifecycle_label"),
                        "status": status,
                    },
                })

    return anomalies


# ============================================================
#  YIELD ANALYTICS: Per-Stage Losses for Sankey
# ============================================================
def compute_yield_analytics(G: nx.DiGraph) -> dict:
    """
    Aggregates quantity and loss data per lifecycle stage.

    Overall yield formula (FIXED):
      total_in  = sum of quantities on all edges leaving NULL
                  (i.e. raw material actually entering the system)
      total_out = sum of last_known_qty for FINISHED_PRODUCT terminal sinks only
                  (PIPE-*, PROD-* nodes with no outgoing edges)

    This correctly excludes:
      - Intermediate nodes accidentally classified as terminal sinks
      - Cancelled/rejected lots that stopped mid-chain
      - IN_TRANSIT, BALED_LOT, WASHED_MATERIAL etc. that are genuinely terminal
        only because they were anomalously abandoned
    """
    stage_stats = {}

    for u, v, data in G.edges(data=True):
        stage_key = (data.get("lifecycle_stage", 0), data.get("lifecycle_label", "Unknown"))
        if stage_key not in stage_stats:
            stage_stats[stage_key] = {
                "stage": stage_key[0],
                "label": stage_key[1],
                "phase": data.get("phase", "UNKNOWN"),
                "total_qty_in": 0.0,
                "total_loss_qty": 0.0,
                "transaction_count": 0,
                "anomaly_count": 0,
            }
        s = stage_stats[stage_key]
        s["total_qty_in"]      += data.get("quantity", 0.0)
        s["total_loss_qty"]    += data.get("loss_qty", 0.0)
        s["transaction_count"] += 1
        if data.get("is_anomaly", False):
            s["anomaly_count"] += 1

    # Compute yield% per stage
    for s in stage_stats.values():
        if s["total_qty_in"] > 0:
            s["yield_percent"] = round(
                100.0 * (s["total_qty_in"] - s["total_loss_qty"]) / s["total_qty_in"], 2
            )
        else:
            s["yield_percent"] = 100.0
        s["total_qty_in"]   = round(s["total_qty_in"], 2)
        s["total_loss_qty"] = round(s["total_loss_qty"], 2)

    sorted_stages = sorted(stage_stats.values(), key=lambda x: x["stage"])

    hotspots = sorted(
        [s for s in sorted_stages if s["total_loss_qty"] > 0],
        key=lambda x: x["total_loss_qty"],
        reverse=True,
    )

    # Sankey nodes & links
    sankey_nodes = {s["label"]: {"name": s["label"], "phase": s["phase"]} for s in sorted_stages}
    sankey_nodes["Material Loss"] = {"name": "Material Loss", "phase": "LOSS"}

    sankey_links = []
    for i in range(len(sorted_stages)):
        s = sorted_stages[i]
        if s["total_qty_in"] > 0 and s["total_loss_qty"] > 0:
            sankey_links.append({
                "source": s["label"],
                "target": "Material Loss",
                "value": s["total_loss_qty"],
                "phase": "LOSS",
            })
        
        # Link to next stage if it's not the last stage
        if i < len(sorted_stages) - 1:
            next_s = sorted_stages[i + 1]
            flow = s["total_qty_in"] - s["total_loss_qty"]
            if flow > 0:
                sankey_links.append({
                    "source": s["label"],
                    "target": next_s["label"],
                    "value": round(flow, 2),
                    "phase": s["phase"],
                })

    # ── IMPROVED: Overall yield calculation ────────────────────────
    #
    # total_in: sum of qty on all edges leaving ROOT SOURCE nodes.
    #   Root sources = nodes with in_degree == 0 (no incoming edges)
    #   This includes:
    #     - NULL (external raw material purchases)
    #     - Starting inventory (e.g., INV-MIX-RAW in Scenario 5)
    #   This handles scenarios that start with existing inventory.
    #
    # total_out: sum of last_known_qty for PRODUCTIVE terminal sinks.
    #   Productive terminals = terminal nodes (out_degree == 0) that are NOT:
    #     - REJECTED_LOT (quality failures)
    #     - EXTERNAL_SOURCE (virtual nodes)
    #     - IDs containing: REJECT, WASTE, LOSS, GHOST (non-productive)
    #   This includes:
    #     - FINISHED_PRODUCT (pipes, products)
    #     - BALED_LOT (ready for shipment)
    #     - INVENTORY_LOT ending in good state (e.g., INV-GOOD-28)
    #

    # Calculate input: all material entering from root sources
    root_sources = [n for n in G.nodes() if G.in_degree(n) == 0]

    total_in = sum(
        d.get("quantity", 0.0)
        for u, v, d in G.edges(data=True)
        if u in root_sources
    )

    # Calculate output: productive terminal nodes only
    def is_productive_terminal(node_id: str, node_data: dict) -> bool:
        """Check if a terminal node represents productive output."""
        if not node_data.get("is_terminal_sink"):
            return False

        # Exclude rejected/waste nodes
        node_type = node_data.get("node_type", "")
        if node_type in ["REJECTED_LOT", "EXTERNAL_SOURCE"]:
            return False

        # Exclude nodes with non-productive keywords in ID
        node_id_upper = node_id.upper()
        non_productive_keywords = ["REJECT", "WASTE", "LOSS", "GHOST"]
        if any(kw in node_id_upper for kw in non_productive_keywords):
            return False

        return True

    total_out = sum(
        G.nodes[n].get("last_known_qty", 0.0)
        for n in G.nodes()
        if is_productive_terminal(n, G.nodes[n])
    )

    overall_yield = round(100.0 * total_out / total_in, 2) if total_in > 0 else 0.0

    return {
        "overall_input_qty":    round(total_in, 2),
        "overall_output_qty":   round(total_out, 2),
        "overall_yield_percent": overall_yield,
        "per_stage":   sorted_stages,
        "loss_hotspots": hotspots,
        "sankey": {
            "nodes": list(sankey_nodes.values()),
            "links": sankey_links,
        },
    }


# ============================================================
#  GRAPH ANALYTICS: Centrality & Critical Path
# ============================================================
def compute_graph_analytics(G: nx.DiGraph) -> dict:
    bc = nx.betweenness_centrality(G, normalized=True)

    degree_summary = [
        {
            "node": n,
            "label": G.nodes[n].get("label", n),
            "in_degree": G.in_degree(n),
            "out_degree": G.out_degree(n),
            "betweenness": round(bc.get(n, 0.0), 4),
            "node_type": G.nodes[n].get("node_type", "UNKNOWN"),
        }
        for n in G.nodes()
    ]
    degree_summary.sort(key=lambda x: x["betweenness"], reverse=True)

    try:
        longest_path        = nx.dag_longest_path(G)
        longest_path_length = nx.dag_longest_path_length(G)
    except nx.NetworkXUnfeasible:
        longest_path        = []
        longest_path_length = 0

    components = [list(c) for c in nx.weakly_connected_components(G)]

    return {
        "node_metrics": degree_summary,
        "top_bottleneck_nodes": degree_summary[:5],
        "longest_critical_path": {
            "nodes": longest_path,
            "length": longest_path_length,
        },
        "connected_components": {
            "count": len(components),
            "components": components,
        },
    }


# ============================================================
#  EXPORT: JSON Report
# ============================================================
def generate_json_report(
    G: nx.DiGraph,
    output_filepath: str,
    sample_forward_id: str = None,
    sample_backward_id: str = None,
) -> dict:

    print("Generating insights...")

    graph_data      = nx.node_link_data(G)
    anomalies       = find_anomalies(G)
    yield_analytics = compute_yield_analytics(G)
    graph_analytics = compute_graph_analytics(G)

    fwd = forward_trace(G, sample_forward_id)   if sample_forward_id  else {}
    bwd = backward_trace(G, sample_backward_id) if sample_backward_id else {}

    node_summary = [
        {
            "id": n,
            "label": data.get("label", n),
            "node_type": data.get("node_type", "UNKNOWN"),
            "color_hint": data.get("color_hint", "#ffffff"),
            "lifecycle_stage": data.get("lifecycle_stage", 0),
            "lifecycle_label": data.get("lifecycle_label", "Unknown"),
            "phase": data.get("phase", "UNKNOWN"),
            "warehouse_label": data.get("warehouse_label", "Unknown"),
            "last_known_qty": data.get("last_known_qty", 0.0),
            "is_root_source": data.get("is_root_source", False),
            "is_terminal_sink": data.get("is_terminal_sink", False),
            "anomaly_incoming_count": data.get("anomaly_incoming_count", 0),
            "in_degree": data.get("in_degree", 0),
            "out_degree": data.get("out_degree", 0),
            "transactions": data.get("transactions", []),
        }
        for n, data in G.nodes(data=True)
    ]

    edge_summary = [
        {
            "from": u,
            "to": v,
            "label": d.get("label", ""),
            "mode": d.get("mode", ""),
            "lifecycle_stage": d.get("lifecycle_stage", 0),
            "lifecycle_label": d.get("lifecycle_label", ""),
            "quantity": d.get("quantity", 0.0),
            "loss_percent": d.get("loss_percent", 0.0),
            "loss_qty": d.get("loss_qty", 0.0),
            "status": d.get("status", ""),
            "is_anomaly": d.get("is_anomaly", False),
            "edge_weight": d.get("edge_weight", 0.0),
            "transaction_id": d.get("transaction_id", ""),
            "transaction_date": d.get("transaction_date", ""),
            "warehouse_label": d.get("warehouse_label", ""),
            "remarks": d.get("remarks", ""),
        }
        for u, v, d in G.edges(data=True)
    ]

    report = {
        "metadata": {
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "anomalies_detected": len([a for a in anomalies if a["type"] != "CORRECTLY_REJECTED"]),
            "ghost_inventory_count": len([a for a in anomalies if a["type"] == "GHOST_INVENTORY"]),
            "correctly_rejected_count": len([a for a in anomalies if a["type"] == "CORRECTLY_REJECTED"]),
            "overall_yield_percent": yield_analytics.get("overall_yield_percent", 0.0),
            "built_at": G.graph.get("built_at", ""),
        },
        "graph_data":    graph_data,
        "node_summary":  node_summary,
        "edge_summary":  edge_summary,
        "insights": {
            "anomalies":      anomalies,
            "forward_trace":  fwd,
            "backward_trace": bwd,
        },
        "yield_analytics":  yield_analytics,
        "graph_analytics":  graph_analytics,
    }

    with open(output_filepath, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=4, default=str)

    print(f"\n[OK] Report saved -> {output_filepath}")
    print(f"   Nodes: {G.number_of_nodes()}  |  Edges: {G.number_of_edges()}")
    print(f"   Anomalies: {report['metadata']['anomalies_detected']}")
    print(f"   Overall Yield: {report['metadata']['overall_yield_percent']}%")
    return report


import glob
import shutil
from sqlalchemy import create_engine

# ============================================================
#  EXPORT: SQLite Database
# ============================================================
def export_to_sqlite(G: nx.DiGraph, db_path: str, scenario_id: str, report: dict):
    engine = create_engine(f"sqlite:///{db_path}")

    nodes_data = []
    for n, data in G.nodes(data=True):
        row = data.copy()
        row["id"] = n
        row["scenario_id"] = scenario_id
        if "transactions" in row:
            row["transactions"] = json.dumps(row["transactions"])
        nodes_data.append(row)

    df_nodes = pd.DataFrame(nodes_data)

    edges_data = []
    for u, v, data in G.edges(data=True):
        row = data.copy()
        row["source"] = u
        row["target"] = v
        row["scenario_id"] = scenario_id
        edges_data.append(row)

    df_edges = pd.DataFrame(edges_data)

    if not df_nodes.empty:
        df_nodes.to_sql("graph_nodes", con=engine, if_exists="append", index=False)
    if not df_edges.empty:
        df_edges.to_sql("graph_edges", con=engine, if_exists="append", index=False)

    metrics_data = [{
        "scenario_id": scenario_id,
        "total_nodes": report["metadata"]["total_nodes"],
        "total_edges": report["metadata"]["total_edges"],
        "anomalies_detected": report["metadata"]["anomalies_detected"],
        "ghost_inventory_count": report["metadata"]["ghost_inventory_count"],
        "overall_input_qty": report["yield_analytics"].get("overall_input_qty", 0.0),
        "overall_output_qty": report["yield_analytics"].get("overall_output_qty", 0.0),
        "overall_yield_percent": report["metadata"]["overall_yield_percent"],
    }]
    pd.DataFrame(metrics_data).to_sql("scenario_metrics", con=engine, if_exists="append", index=False)

    print(f"   [SQLite] Nodes, edges, and metrics appended to {db_path} for {scenario_id}")

def dump_raw_data_to_sqlite(transforms_path: str, events_path: str, db_path: str, scenario_id: str):
    """Dump raw event and transform CSVs into SQLite tables aligning with the planned schema."""
    engine = create_engine(f"sqlite:///{db_path}")
    
    transforms = _load_df(transforms_path)
    events = _load_df(events_path)
    transforms, events = _detect_file_swap(transforms, events)
    transforms = standardize_columns(transforms)
    events = standardize_columns(events)
    
    transforms["scenario_id"] = scenario_id
    events["scenario_id"] = scenario_id
    
    if not events.empty:
        events.to_sql("transactions", con=engine, if_exists="append", index=False)
    
    if not transforms.empty:
        transforms.to_sql("inventory_transforms", con=engine, if_exists="append", index=False)
        
    print(f"   [SQLite] Raw transactions & inventory_transforms appended to {db_path} for {scenario_id}")


# ============================================================
#  ENTRYPOINT
# ============================================================
if __name__ == "__main__":
    BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
    PROBLEM_DIR = os.path.join(BASE_DIR, "NEW_DATA")
    ROOT_DIR    = os.path.dirname(BASE_DIR)

    DB_PATH = os.path.join(ROOT_DIR, "traceability.db")

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Cleared existing database at {DB_PATH}")

    scenario_dirs = sorted(glob.glob(os.path.join(PROBLEM_DIR, "Scenario *")))
    
    # If no Scenario dirs, check if files exist directly in NEW_DATA
    if not scenario_dirs:
        if os.path.exists(os.path.join(PROBLEM_DIR, "inventory_transforms.csv")) and \
           os.path.exists(os.path.join(PROBLEM_DIR, "transaction_events.csv")):
            scenario_dirs = [PROBLEM_DIR]
            print(f"[INFO] Found aggregated data in {PROBLEM_DIR}")

    if not scenario_dirs:
        print(f"[ERROR] No scenario directories or aggregated files found in {PROBLEM_DIR}")
        exit(1)

    for scenario_dir in scenario_dirs:
        scenario_name   = os.path.basename(scenario_dir)
        if scenario_name == "NEW_DATA":
            scenario_name = "All_Scenarios"
            
        transforms_path = os.path.join(scenario_dir, "inventory_transforms.csv")
        events_path     = os.path.join(scenario_dir, "transaction_events.csv")

        print(f"\n{'='*50}")
        print(f" Processing: {scenario_name}")
        print(f"{'='*50}")

        report_name = f"traceability_report_{scenario_name.replace(' ', '_').lower()}.json"
        output_json = os.path.join(ROOT_DIR, report_name)

        try:
            dump_raw_data_to_sqlite(transforms_path, events_path, DB_PATH, scenario_name)
            G = build_traceability_graph(transforms_path, events_path)

            sample_start = "INV-1001-1" if "INV-1001-1" in G else (list(G.nodes())[0] if G.number_of_nodes() > 0 else None)
            terminal_nodes = [
                n for n in G.nodes()
                if G.nodes[n].get("is_terminal_sink")
                and G.nodes[n].get("node_type") not in ["REJECTED_LOT", "EXTERNAL_SOURCE"]
            ]
            sample_end = terminal_nodes[0] if terminal_nodes else sample_start

            report = generate_json_report(
                G,
                output_json,
                sample_forward_id=sample_start,
                sample_backward_id=sample_end,
            )

            # Link the most relevant report as the main one
            main_json = os.path.join(ROOT_DIR, "traceability_report.json")
            shutil.copy(output_json, main_json)

            export_to_sqlite(G, DB_PATH, scenario_id=scenario_name, report=report)

        except FileNotFoundError as e:
            print(f"[ERROR] Could not find files for {scenario_name}.\n   {e}")
        except Exception as e:
            import traceback
            print(f"[ERROR] Unexpected error processing {scenario_name}: {e}")
            traceback.print_exc()

    print("\n[OK] All data processed. SQLite database populated.")