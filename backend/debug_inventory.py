import json
import os

report_path = '../traceability_report.json'
with open(report_path) as f:
    report = json.load(f)

nodes = report.get("node_summary", [])
batch_states = {}

for node in nodes:
    node_id = node["id"]
    qty = node.get("last_known_qty", 0)
    phase = node.get("phase", "UNKNOWN")
    
    batch_id = node_id
    if node_id.startswith("INV-"):
        parts = node_id.split("-")
        if len(parts) >= 2:
            batch_id = parts[1]
            
    status = "Available"
    if phase in ["INTAKE", "PRE-PROCESS", "WASHING", "PROCESSING"]:
        status = "Processing"
    elif phase == "QUALITY":
        status = "Quality Check"
    elif phase == "LOGISTICS":
        status = "In Transit"
        
    batch_states[batch_id] = {"qty": qty, "status": status}

print(f"Batch states count: {len(batch_states)}")
print(f"Sample keys: {list(batch_states.keys())[:5]}")

processing_qty = sum(s["qty"] for bid, s in batch_states.items() if bid != "COLLECTION_SOURCE" and s["status"] == "Processing")
print(f"Processing Qty: {processing_qty}")

statuses = [s["status"] for s in batch_states.values()]
from collections import Counter
print(f"Status distribution: {Counter(statuses)}")
