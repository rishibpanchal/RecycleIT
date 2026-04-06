import sqlite3

db_path = '../traceability.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Get all batches
c.execute("SELECT DISTINCT target FROM graph_edges WHERE target LIKE 'INV-%'")
node_ids = [r[0] for r in c.fetchall()]
batches = set(nid.split('-')[1] for nid in node_ids)

print(f"Checking {len(batches)} batches...")
found = 0
for batch in sorted(list(batches)):
    # Get stage 1 input
    c.execute(f"SELECT quantity FROM graph_edges WHERE target = 'INV-{batch}-1'")
    s1 = c.fetchone()
    # Get stage 5 input
    c.execute(f"SELECT quantity FROM graph_edges WHERE target = 'INV-{batch}-5'")
    s5 = c.fetchone()
    
    if s1 and s5:
        if abs(s1[0] - s5[0]) < 0.01:
            print(f"Batch {batch} has SAME weight at stage 1 and 5: {s1[0]}")
            found += 1

if found == 0:
    print("No batches found with identical weight at start and end.")
