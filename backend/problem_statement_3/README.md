# 📌 Project Overview

This dataset simulates a complete **Circular Economy supply chain** for plastic recycling. Participants are challenged to build algorithms that trace material movement through various physical and chemical transformations.

---

## 🔄 The 13-Step Lifecycle

Material in this dataset moves through the following stages:

| Step | Code | Description |
|------|------|-------------|
| 1 | `PR` | **Inward** — Collection of raw plastic waste |
| 2 | `SEG` | **Segregation** — Sorting waste by grade or color |
| 3 | `MB` | **Baling** — Compacting sorted waste into bales |
| 4 | `WT` | **Transfer** — Shipping bales to a washing facility |
| 5 | `WTR` | **Receipt** — Receiving the shipment at the facility |
| 6 | `MB` | **Washing** — Processing waste into clean plastic flakes |
| 7 | `QC` | **Quality Control** — Testing for purity and moisture levels |
| 8 | `WT` | **Transfer** — Shipping flakes to a recycling plant |
| 9 | `WTR` | **Receipt** — Receiving flakes for granulation |
| 10 | `MB` | **Recycling** — Melting flakes into plastic granules (pellets) |
| 11 | `SD` | **Dispatch** — Shipping granules to a manufacturing factory |
| 12 | `PR` | **Receipt** — Factory receiving the raw material |
| 13 | `MB` | **Production** — Creating final products (e.g., Plastic Tubing) |

---

## 📂 File Structure

### 1. `transaction_events.csv`
The **Header** file. It records every event that happens at a warehouse.

| Field | Description |
|-------|-------------|
| `transaction_id` | The unique reference for the event |
| `process_code` | The type of action (e.g., `PR`, `SEG`, `MB`, `QC`) |
| `status` | The validity of the event (`APPROVED`, `REJECTED`, or `CANCELLED`) |

### 2. `inventory_transforms.csv`
The **Lineage** file. It maps the connection between parent and child lots.

| Field | Description |
|-------|-------------|
| `source_inventory_id` | The material that went **IN** |
| `destination_inventory_id` | The material that came **OUT** |
| `loss_percent` | The amount of waste generated during that specific step |

---

## 🎯 Challenge Goals

- **Backward Trace** — Start with a finished product (e.g., a Plastic Pipe) and find every original collection source that contributed to it.
- **Forward Trace** — Start with a specific waste collection lot and find all finished products it ended up in.
- **Yield Analysis** — Calculate the total material loss across a specific chain of events.
- **Anomaly Detection** — Identify "Broken Traces" where a transaction was rejected but the material was still used.

---

## ⚠️ Key Rules

- If a transaction `status` is `REJECTED`, the material should generally **not** progress *(unless a rework scenario is specified)*.
- One parent can have **multiple children** *(Split)*.
- Multiple parents can have **one child** *(Merge)*.
