import csv
from collections import defaultdict
from datetime import datetime

PATH = "backend/fingerprint/lifecycle_data_scenarios.csv"

def verify():
    with open(PATH, "r") as f:
        reader = csv.DictReader(f)
        records = list(reader)
    
    print(f"Total records: {len(records)}")
    
    # Group by batch
    batches = defaultdict(list)
    for r in records:
        batches[r['batch_id']].append(r)
    
    print(f"Total batches: {len(batches)}")
    
    # Basic statistics
    for batch_id, recs in list(batches.items())[:5]:
        print(f"Batch {batch_id}: {len(recs)} stages, Vendor: {recs[0]['vendor']}, Mat: {recs[0]['material_type']}")
        
    # Check for variance in loss
    # We can't easily map back to scenario name without metadata, 
    # but we can check the ranges of total loss.
    
    loss_stats = []
    for batch_id, recs in batches.items():
        qty_start = float(recs[0]['quantity_in'])
        qty_end = float(recs[-1]['quantity_out'])
        total_loss_pct = (1 - (qty_end / qty_start)) * 100
        
        # Calculate time delta
        t_start = datetime.strptime(recs[0]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
        t_end = datetime.strptime(recs[-1]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
        duration_hours = (t_end - t_start).total_seconds() / 3600
        
        loss_stats.append({
            "batch_id": batch_id,
            "loss": total_loss_pct,
            "duration": duration_hours,
            "vendor": recs[0]['vendor']
        })
    
    # Sort by loss to see ranges
    loss_stats.sort(key=lambda x: x['loss'])
    
    print("\nLoss Ranges (Top 5 lowest):")
    for s in loss_stats[:5]:
        print(f"  {s['batch_id']}: {s['loss']:.2f}% loss, {s['duration']:.2f}h duration, {s['vendor']}")
        
    print("\nLoss Ranges (Top 5 highest):")
    for s in loss_stats[-5:]:
        print(f"  {s['batch_id']}: {s['loss']:.2f}% loss, {s['duration']:.2f}h duration, {s['vendor']}")

    # Sort by duration
    loss_stats.sort(key=lambda x: x['duration'])
    print("\nDuration Ranges (Top 5 longest):")
    for s in loss_stats[-5:]:
        print(f"  {s['batch_id']}: {s['loss']:.2f}% loss, {s['duration']:.2f}h duration, {s['vendor']}")

if __name__ == "__main__":
    verify()
