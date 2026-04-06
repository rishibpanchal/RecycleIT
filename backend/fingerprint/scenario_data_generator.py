"""
backend/fingerprint/scenario_data_generator.py
=============================================
Generates synthetic lifecycle data for 6 distinct behavioral scenarios.
Outputs two files for traceability lineage:
1. transaction_events.csv
2. inventory_transforms.csv
"""

import random
import csv
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

STAGES = ["Collection", "Sorting", "Processing", "Recycling", "Dispatch"]

MODE_MAP = {
    "Collection": "INWARD",
    "Sorting": "SEGREGATION",
    "Processing": "WASHING",
    "Recycling": "RECYCLING",
    "Dispatch": "DISPATCH"
}

PROCESS_MAP = {
    "Collection": "PR",
    "Sorting": "SEG",
    "Processing": "MB",
    "Recycling": "MB",
    "Dispatch": "SD"
}

WAREHOUSE_MAP = {
    "Collection": "WH-COLLECT",
    "Sorting": "WH-COLLECT",
    "Processing": "WH-WASH",
    "Recycling": "WH-RECY",
    "Dispatch": "WH-FACT",
}

MATERIAL_TYPES = ["PET", "HDPE", "PVC", "LDPE", "PP", "PS"]

SCENARIOS = {
    "High Efficiency": {
        "efficiency_range": (0.95, 0.98),
        "delay_range": (1, 8),
        "vendor": "Vendor A",
    },
    "Moderate Efficiency": {
        "efficiency_range": (0.93, 0.96),
        "delay_range": (4, 32),
        "vendor": "Vendor B",
    },
    "High Loss": {
        "efficiency_range": (0.85, 0.92),
        "delay_range": (8, 36),
        "vendor": "Vendor C",
    },
    "Delay-Dominant": {
        "efficiency_range": (0.94, 0.97),
        "delay_range": (36, 120),
        "vendor": "Vendor B",
    },
    "Vendor-Issue": {
        "efficiency_range": (0.88, 0.95),
        "delay_range": (8, 64),
        "vendor": "Vendor C",
    },
    "Anomalous": {
        "efficiency_range": (0.50, 0.99),
        "delay_range": (0.5, 150),
        "vendor": "Vendor C",
    }
}

def generate_dataset(batches_per_scenario: int = 20):
    all_events = []
    all_transforms = []
    start_dt = datetime(2025, 1, 1, 9, 0, 0)
    batch_counter = 1001
    
    base_data_path = "NEW_DATA/"
    os.makedirs(base_data_path, exist_ok=True)
    
    for scenario_name, scenario in SCENARIOS.items():
        for _ in range(batches_per_scenario):
            batch_id = f"B{batch_counter}"
            batch_start = start_dt + timedelta(days=random.uniform(0, 60), hours=random.uniform(0, 24))
            current_qty = random.uniform(400, 2500)
            current_dt = batch_start
            mat_type = random.choice(MATERIAL_TYPES)
            vendor = f"{scenario['vendor']} - {random.randint(1, 5)}" # Add vendor variance
            
            # 20% of batches are incomplete (in processing/stock)
            num_stages = len(STAGES)
            if random.random() < 0.2:
                num_stages = random.randint(1, len(STAGES) - 1)
                
            prev_inv_id = None
            
            for i in range(num_stages):
                stage = STAGES[i]
                # Calculate metrics
                eff_min, eff_max = scenario["efficiency_range"]
                if scenario_name == "High Loss" and stage == "Sorting":
                    eff = random.uniform(0.80, 0.88)
                else:
                    eff = random.uniform(eff_min, eff_max)
                
                qty_in = round(current_qty, 2)
                qty_out = round(qty_in * eff, 2)
                loss_pct = round((1 - eff) * 100, 2)
                
                txn_id = f"TXN-{batch_id}-{i+1}"
                inv_id = f"INV-{batch_id}-{i+1}"
                
                # Event record
                all_events.append({
                    "transaction_id": txn_id,
                    "batch_id": batch_id,
                    "scenario": scenario_name,  # Keep track of scenario
                    "process_code": PROCESS_MAP[stage],
                    "status": "APPROVED" if (scenario_name != "Anomalous" or random.random() > 0.1) else "ANOMALY",
                    "transaction_date": current_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "warehouse_code": WAREHOUSE_MAP[stage],
                    "vendor": vendor,
                    "material_type": mat_type,
                    "remarks": f"{batch_id}:{stage}"
                })
                
                # Transform record
                all_transforms.append({
                    "transaction_id": txn_id, # Link back to event
                    "source_inventory_id": prev_inv_id if prev_inv_id else "COLLECTION_SOURCE",
                    "destination_inventory_id": inv_id,
                    "quantity": qty_in,
                    "dest_qty": qty_out,
                    "loss_percent": loss_pct,
                    "mode": MODE_MAP[stage]
                })
                
                # Advance for next stage
                delay_min, delay_max = scenario["delay_range"]
                current_dt += timedelta(hours=random.uniform(delay_min, delay_max))
                current_qty = qty_out
                prev_inv_id = inv_id
                
            batch_counter += 1
            
    # Save combined files
    with open(os.path.join(base_data_path, "transaction_events.csv"), "w", newline='') as f:
        if all_events:
            writer = csv.DictWriter(f, fieldnames=all_events[0].keys())
            writer.writeheader()
            writer.writerows(all_events)
        
    with open(os.path.join(base_data_path, "inventory_transforms.csv"), "w", newline='') as f:
        if all_transforms:
            writer = csv.DictWriter(f, fieldnames=all_transforms[0].keys())
            writer.writeheader()
            writer.writerows(all_transforms)
            
    print(f"Generated {len(all_events)} events and {len(all_transforms)} transforms across {len(SCENARIOS)} scenarios.")
    print(f"Combined data saved to {base_data_path}")



if __name__ == "__main__":
    generate_dataset(20)
