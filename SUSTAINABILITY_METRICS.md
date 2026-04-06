# Sustainability Metrics Calculation Framework

## Overview

The sustainability metrics are dynamically computed from traceability data using research-based life cycle assessment (LCA) factors and formulas. These calculations ensure that the metrics accurately reflect the actual environmental impact of your recycling operations.

## Symbols and Notation Reference

- $m_i$ = Quantity of material type $i$ (in kg)
- $C_i$ = Carbon factor for material type $i$ (in kg CO₂/kg)
- $W_i$ = Water factor for material type $i$ (in L/kg)
- $E_i$ = Energy factor for material type $i$ (in kWh/kg)
- $r_p$ = Recovery rate for process phase $p$ (as decimal, 0-1)
- $M_{div}$ = Total material diverted to recycling (in kg)
- $L$ = Total material loss (in kg)
- $M_{input}$ = Total input material (in kg)

---

## Metrics Calculated

### 1. **Carbon Offset (CO₂ Saved)**

**Purpose:** Quantifies greenhouse gas emissions avoided by recycling vs. virgin material production.

**Mathematical Formula:**
$$
\text{Carbon Offset (kg CO₂)} = \sum_{i} m_i \times C_i
$$

**Implementation Formula:**
```
Total CO₂ Saved = Σ(Material quantity by type × Material-specific carbon factor)
```

**Step-by-Step Calculation:**
1. For each material type $i$ processed in the system:
   - Identify quantity: $m_i$ (kg)
   - Apply carbon factor: $C_i$ (kg CO₂/kg)
   - Calculate: $m_i \times C_i$
2. Sum all contributions: $\sum (m_i \times C_i)$
3. Convert to metric tons: $\text{Metric Tons} = \frac{\text{kg CO₂}}{1000}$

**Justification:**
- Based on lifecycle assessment studies comparing virgin material production vs. recycled material
- Factors account for avoided emissions from:
  - Extraction and mining
  - Processing and refining
  - Transportation of virgin materials
  - Manufacturing into finished products
- Sources:
  - EPA Waste & Materials Management Database
  - Global Recycling Coalition Research
  - Boucher et al. (2017) - Plastic Debris in the Ocean
  - GaBi Life Cycle Assessment Database

**Material Factors (kg CO₂ saved per kg recycled):**
- **PET Plastics**: 3.2 kg CO₂/kg
  - Explains: Petroleum extraction (2.1 kg CO₂/kg) + polymerization (1.1 kg CO₂/kg)
  - Virgin production: Crude oil to resin requires energy-intensive processes
- **HDPE**: 2.8 kg CO₂/kg  
  - Lower than PET due to different polymer structure and shorter production chain
- **Aluminum**: 12.5 kg CO₂/kg
  - Extremely energy-intensive virgin production; recycling saves 95% energy
  - Virgin: Bauxite mining + refining + electrolysis = ~15 kg CO₂/kg
  - Recycled: Only melting needed = ~0.5 kg CO₂/kg
- **Glass**: 0.5 kg CO₂/kg
  - Relatively small carbon savings (virgin glass production is already efficient)
  - Virgin: Sand melting at 1700°C uses ~0.6 kg CO₂/kg
  - Recycled: Lower melting point = ~0.1 kg CO₂/kg
- **Paper**: 1.2 kg CO₂/kg
  - Includes avoided pulping and bleaching emissions
  - Virgin: Tree harvesting + pulping + bleaching + drying

**Example Calculation:**
If you recycle 1,000 kg of aluminum:
$$CO₂ \text{ saved} = 1,000 \text{ kg} \times 12.5 \text{ kg CO}_2/\text{kg} = 12,500 \text{ kg CO}_2 = \textbf{12.5 \text{ metric tons}}$$

**Real-World Context:**
- 12.5 metric tons CO₂ = Equivalent to driving a car 31,250 miles

---

### 2. **Water Saved (Liters)**

**Purpose:** Quantifies freshwater consumption avoided by recycling vs. virgin material production.

**Mathematical Formula:**
$$
\text{Water Saved (L)} = \sum_{i} m_i \times W_i
$$

**Implementation Formula:**
```
Total Liters Saved = Σ(Material quantity by type × Material-specific water factor)
```

**Step-by-Step Calculation:**
1. For each material type $i$ processed:
   - Identify quantity: $m_i$ (kg)
   - Apply water factor: $W_i$ (L/kg)
   - Calculate: $m_i \times W_i$
2. Sum all contributions: $\sum (m_i \times W_i)$
3. Convert to kiloliters for reporting: $\text{kL} = \frac{\text{L}}{1000}$

**Justification:**
- Reflects water consumed in virgin material production vs. recycled material processing
- Includes:
  - Extraction and mining water (ore processing)
  - Processing and washing water (material cleaning)
  - Cooling water in manufacturing (thermal processes)
- Does NOT include: Groundwater depletion from mining, agricultural water
- Sources:
  - WRAP UK Sustainability Reports
  - Life Cycle Inventory Database (USLCI)
  - Water Footprint Network
  - Ellen MacArthur Foundation

**Material Factors (liters saved per kg recycled):**
- **PET Plastics**: 24 L/kg
  - Petroleum extraction and polymerization require significant water for cooling
- **HDPE**: 18.5 L/kg
  - Lower processing water requirement than PET
- **Aluminum**: 450 L/kg (highest savings!)
  - Bauxite mining: 400-500 L/kg (ore washing, refining)
  - Recycling: <1 L/kg (just melting)
  - This is where aluminum recycling provides maximum value
- **Glass**: 2 L/kg
  - Minimal water savings; virgin glass production is inherently efficient
  - Sand washing: ~2 L/kg; Recycled glass melting: <0.1 L/kg
- **Paper**: 10 L/kg
  - Pulping process requires substantial water for pulp washing and bleaching

**Example Calculation:**
If you recycle 500 kg of PET plastics:
$$\text{Water saved} = 500 \text{ kg} \times 24 \text{ L/kg} = \textbf{12,000 liters}$$

**Real-World Context:**
- 12,000 liters = Approximately 3,170 gallons = Average US household water use for 4 days

---

### 3. **Energy Recovered (kWh)**

**Purpose:** Quantifies electrical energy that can be recovered from thermal processing of recycled materials.

**Mathematical Formula:**
$$
\text{Energy Recovered (kWh)} = \sum_{i,p} m_i \times E_i \times r_p
$$

Where $p$ represents the process phase (PROCESSING, MANUFACTURING, QUALITY).

**Implementation Formula:**
```
Total kWh = Σ(Material qty × Energy factor × Process recovery rate)
```

**Step-by-Step Calculation:**
1. For each material type $i$ and phase $p$:
   - Identify quantity: $m_i$ (kg)
   - Apply energy factor: $E_i$ (kWh/kg)
   - Calculate energy consumed: $E_{consumed} = m_i \times E_i$
   - Apply recovery rate: $r_p$ (depends on process phase)
   - Calculate recovered: $E_{recovered} = E_{consumed} \times r_p$
2. Sum across all phases: $\sum (E_{recovered})$

**Process Recovery Rates by Phase:**
- **PROCESSING**: 95% recovery rate
  - Explanation: At material processing stage, waste heat is at high temperature and can be effectively captured from furnaces, dryers, and thermal processors
  - Applications: Space heating, steam generation, preheating of incoming material
  
- **MANUFACTURING**: 75% recovery rate
  - Explanation: During manufacturing, heat quality is moderate; some losses during recovery
  - Applications: Factory heating, process water heating
  
- **QUALITY**: 40% recovery rate
  - Explanation: At quality control stage, heat sources are limited and dispersed
  - Applications: Space heating only

**Justification:**
- Quantifies the energy that can be recovered from processing activities
- Modern facilities can capture waste heat for:
  - Heating recycled material in furnaces
  - Steam generation for steam tables and processing
  - Facility space heating/cooling
  - Preheating incoming material
- Based on industrial energy recovery standards from:
  - DOE Industrial Efficiency Best Practices
  - EPA Energy Recovery Guidelines
  - ISO 50001 Energy Management Standards

**Material Factors (kWh per kg of material):**
Energy required purely for processing (before recovery efficiency):
- **PET Plastics**: 0.85 kWh/kg
  - Melting (~700°C): 0.50 kWh/kg
  - Extrusion: 0.20 kWh/kg
  - Controls/misc: 0.15 kWh/kg
  
- **HDPE**: 1.1 kWh/kg
  - Slightly higher due to denser polymer
  
- **Aluminum**: 2.8 kWh/kg (highest consumption, highest recovery potential)
  - Virgin aluminum requires ~15 kWh/kg (electrolysis)
  - Recycled: Melting only (~2.8 kWh/kg)
  - Our calculation reflects recycled energy requirement
  
- **Glass**: 0.15 kWh/kg
  - Lower energy requirement; glass melts at 1700°C but heat retention is good
  
- **Paper**: 0.45 kWh/kg
  - Mainly drying energy (moisture removal)

**Example Calculation:**
If you process 2,000 kg of aluminum during PROCESSING phase:
$$E_{consumed} = 2,000 \text{ kg} \times 2.8 \text{ kWh/kg} = 5,600 \text{ kWh}$$
$$E_{recovered} = 5,600 \text{ kWh} \times 0.95 = \textbf{5,320 kWh}$$

**Real-World Context:**
- 5,320 kWh = Average US household electricity consumption for ~6 months

---

### 4. **Landfill Diversion Rate (%)**

**Purpose:** Measures the percentage of input material successfully diverted from landfills through the recycling process.

**Mathematical Formula:**
$$
\text{Landfill Diversion (\%)} = \frac{M_{div} - L}{M_{input}} \times 100
$$

**Implementation Formula:**
```
Landfill diversion % = ((Material diverted - Total Loss) / Total input) × 100
```

**Step-by-Step Calculation:**
1. Identify total input: $M_{input}$ (kg) - All material entering the system
2. Identify material diverted: $M_{div}$ (kg) - Material that entered recycling (usually = $M_{input}$)
3. Calculate total loss: $L$ (kg) - Material lost at any stage (contamination, spillage, unrecoverable waste)
4. Subtract losses: $M_{div} - L$
5. Calculate percentage: $\frac{(M_{div} - L)}{M_{input}} \times 100$
6. Clamp to [0, 100] range for reporting

**Component Definitions:**
- **Material Diverted**: All material that successfully entered the recycling system
  - Tracked from INTAKE through final processing
  - Calculated from: Total Input Quantity (in traceability metadata)
  
- **Material Loss**: Amount lost at any stage due to:
  - Contamination (unusable material mixed in)
  - Spillage/leakage during transport
  - Process inefficiency (material too degraded to recycle)
  - Tracked per transaction in traceability system
  
- **Total Input**: Initial incoming material quantity
  - Measured at INTAKE node
  - Represents 100% baseline for calculation

**Justification:**
- Measures success in diverting waste from landfills
- EPA considers >75% diversion as "excellent" performance for industrial operations
- >90% is considered "best-in-class" for advanced recycling facilities
- Directly calculated from transaction-level loss data in traceability system
- Reflects operational efficiency and process control quality

**Example Calculation:**
```
Scenario: Material intake at warehouse
- Total input received: 10,000 kg
- Material successfully diverted: 9,950 kg
- Total loss during processing: 200 kg

Landfill diversion = ((9,950 - 200) / 10,000) × 100
                   = (9,750 / 10,000) × 100
                   = 97.5%
```

**Performance Benchmarks:**
- **Poor**: <50% (Significant operational issues)
- **Fair**: 50-75% (Standard industry practice)
- **Good**: 75-90% (Above average, approaching EPA standards)
- **Excellent**: 90-98% (Best-in-class operations)
- **Exceptional**: >98% (Near-perfect material recovery)

---

## Material Factor Sources & References

### Comprehensive Factor Table

| Material | Carbon (kg CO₂/kg) | Water (L/kg) | Energy (kWh/kg) | Primary Source | Secondary Sources |
|----------|-------------------|--------------|-----------------|-----------------|-------------------|
| PET | 3.2 | 24 | 0.85 | Boucher et al. (2017) | USDA LCI Database, GaBi |
| HDPE | 2.8 | 18.5 | 1.1 | LCA Database | Ellen MacArthur Foundation |
| Aluminum | 12.5 | 450 | 2.8 | Aluminum Assoc. | DOE, ICC Analysis |
| Glass | 0.5 | 2 | 0.15 | Glass Packaging Inst. | USDA LCI Database |
| Paper | 1.2 | 10 | 0.45 | AFPA Reports | Confederation of European Paper Industries |

### Full Research Citations

1. **Boucher, J., et al. (2017)**
   - "Plastic Debris in the Ocean"
   - Studies on plastic lifecycle and recycling benefits

2. **Aluminum Association**
   - "Recycling Industry Resources"
   - Specific focus: Aluminum recycling saves 95% of virgin production energy

3. **Glass Packaging Institute (GPI)**
   - "Lifecycle Assessment of Glass Containers"
   - Demonstrates minimal environmental benefits of glass recycling due to already-efficient virgin production

4. **American Forest & Paper Association (AFPA)**
   - "Sustainability Reports: Paper Recycling"
   - Water and carbon data for paper and cardboard materials

5. **WRAP (Waste & Resources Action Programme)**
   - "UK Sustainability Reports"
   - European perspective on material recycling factors

6. **USLCI (US Life Cycle Inventory) Database**
   - Peer-reviewed lifecycle data for multiple materials

7. **Global Recycling Coalition**
   - Industry standards and best practices

8. **EPA Waste & Materials Management**
   - https://www.epa.gov/waste/sustainable-materials-management

---

## Data Sources and Flow

### System Architecture

```
Traceability Report JSON
    ↓ (loads data)
Material Type Inference Engine
    ↓ (identifies material types)
LCA Factor Application
    ↓ (applies kg CO₂/kg, L/kg, kWh/kg)
Phase-Specific Processing
    ↓ (accounts for recovery rates and energy factors)
Metric Aggregation
    ↓ (sums across all materials and phases)
Validation & Bounds Checking
    ↓ (clamps percentages to 0-100%)
API Response Formatting
    ↓ (adds formulas and sources)
Frontend Display Layer
    ↓ (renders metric cards with sustainability data)
Dashboard Visualization
```

### Calculation Steps in Detail

1. **Load Report**: Read traceability data from JSON file
   - Source: `/traceability_report_scenario_*.json`
   - Contains: node_summary, edge_summary, metadata

2. **Infer Material Type**: Automatically identify material for each node
   - Rules: Check node label, phase, warehouse_label, and remarks
   - Examples:
     - "PET_PLASTICS" if label contains "PET"
     - "ALUMINUM" if label contains "ALUMINUM" or "METAL"
   - Fallback: DEFAULT factors if no specific match

3. **Apply LCA Factors**: Multiply material quantity by research-based factors
   - Carbon factor: $C_i$ (kg CO₂/kg)
   - Water factor: $W_i$ (L/kg)
   - Energy factor: $E_i$ (kWh/kg)

4. **Recovery Rates**: Account for process efficiency and energy recovery rates
   - Depends on processing phase
   - PROCESSING: 95%, MANUFACTURING: 75%, QUALITY: 40%
   - Applies only to energy calculations

5. **Aggregate**: Sum across all nodes and materials
   - $\sum m_i \times C_i$ for carbon
   - $\sum m_i \times W_i$ for water
   - $\sum m_i \times E_i \times r_p$ for energy

6. **Validate**: Clamp percentages to 0-100% range
   - Ensures no impossible values (>100% or <0%)

7. **Return**: Format with metadata and sources
   - Metrics dict (absolute values)
   - Formulas dict (human-readable)
   - Material factors dict (transparency)
   - Sources dict (citations)

---

## API Endpoints & Usage

### Get Current Scenario Metrics

**Endpoint:** `GET /api/traceability/sustainability?scenario=1`

**Response:**
```json
{
  "scenario": 1,
  "metrics": {
    "carbon_offset_kg_co2": 45230.50,
    "carbon_offset_metric_tons": 45.23,
    "water_saved_liters": 1250000.00,
    "water_saved_kiloliters": 1250.00,
    "energy_recovered_kwh": 52500.00,
    "landfill_diversion_percent": 97.50,
    "material_diverted_kg": 9750.00,
    "total_input_kg": 10000.00,
    "total_loss_kg": 250.00
  },
  "formulas": {
    "carbon_offset": "kg CO2 = Recycled Material (kg) × Material Factor (kg CO2/kg)",
    "water_saved": "Liters = Recycled Material (kg) × Water Factor (L/kg)",
    "energy_recovered": "kWh = Material (kg) × Energy Factor (kWh/kg) × Recovery Rate",
    "landfill_diversion": "% = (Material Diverted / Total Input) × 100"
  },
  "sources": {...},
  "material_factors": {...}
}
```

### Compare Two Scenarios

**Endpoint:** `GET /api/traceability/sustainability/comparison?current_scenario=2&previous_scenario=1`

**Response:**
```json
{
  "current": {
    "scenario": 2,
    "metrics": {...}
  },
  "previous": {
    "scenario": 1,
    "metrics": {...}
  },
  "trends": {
    "carbon_offset_change_percent": 15.5,
    "water_saved_change_percent": 8.2,
    "energy_recovered_change_percent": 22.1,
    "landfill_diversion_change_percent": 2.5
  }
}
```

---

## Interpretation Guide

### Carbon Offset Performance

- **Poor**: < 1 metric ton
- **Good**: 1-5 metric tons (modest recycling operation)
- **Excellent**: 5-20 metric tons (strong recycling program)
- **Exceptional**: > 20 metric tons (large-scale operation)

**Context:** 
- 1 metric ton CO₂ ≈ 2,500 miles driven by average car
- 45 metric tons ≈ Annual carbon footprint of 5 average Americans

### Water Saved Performance

- **Poor**: < 10,000 L
- **Good**: 10,000-50,000 L
- **Excellent**: 50,000-200,000 L  
- **Exceptional**: > 200,000 L

**Note:** Aluminum recycling accounts for most water savings due to 450 L/kg factor

**Context:**
- 50,000 L ≈ Average US household water use for 1 month
- 200,000 L ≈ Olympic swimming pool volume

### Energy Recovered Performance

- **Poor**: < 500 kWh
- **Good**: 500-2,000 kWh
- **Excellent**: 2,000-10,000 kWh
- **Exceptional**: > 10,000 kWh

**Context:**
- 2,000 kWh ≈ Average household monthly electricity use
- 10,000 kWh ≈ Energy from running a small factory for one shift

### Landfill Diversion Performance

- **Poor**: < 50%
- **Fair**: 50-75%
- **Good**: 75-90% (EPA standard starts here)
- **Excellent**: 90-98%
- **Exceptional**: > 98%

**Benchmark:** EPA considers >75% diversion as excellent for municipal waste management

---

## Accuracy and Continuous Improvement

### When Metrics Update

The sustainability metrics are recalculated automatically when:
1. New traceability data is ingested into the system
2. A new scenario report is generated
3. Transaction losses are recorded or updated
4. Material classifications are refined

### Data Quality Considerations

- **Material Inference**: Accuracy depends on metadata quality in traceability system
- **Loss Tracking**: Only accounts for losses tracked in transactions
- **Factor Stability**: Uses fixed LCA factors (updated annually)

### Factor Update Schedule

- **Quarterly Review**: Check for new research from EPA, Aluminum Association, Glass Packaging Institute
- **Annual Update**: Incorporate new lifecycle assessment studies
- **Immediate**: Update if operational standards change (e.g., recovery rate improvements)

---

## Related Metrics & Calculations

### Supporting Calculations (Backend Only)

- **Material-Specific Trends**: Track changes per material type
- **Phase-Specific Yields**: Identify which processing phases have highest losses
- **Recovery Rate Optimization**: Identify opportunities to improve from 75% to 95% recovery
- **Scenario Comparisons**: Compare before/after operational changes

---

## Questions & Support

For questions about formulas, accuracy, or factor updates:

- **EPA Waste & Materials Management**: https://www.epa.gov/waste
- **Global Recycling Coalition**: https://www.globalrecycling.org/
- **Material-Specific Guidance**:
  - Aluminum: https://www.aluminum.org
  - Glass: https://www.gpi.org
  - Paper: https://www.afandpa.org

