import sqlite3
import os

db_path = '../traceability.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

batch = 'B1039'
print(f"Checking data for {batch}")
query = "SELECT source, target, quantity, loss_qty FROM graph_edges WHERE target LIKE 'INV-B1039-%' ORDER BY target"
c.execute(query)
rows = c.fetchall()

for r in rows:
    print(f"{r[0]} -> {r[1]} | Qty: {r[2]} | Loss: {r[3]}")
