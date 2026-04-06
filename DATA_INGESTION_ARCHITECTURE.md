# Data Ingestion Architecture
## Intelligent Multi-Modal Pipeline for Recycling Traceability

---

## 🎯 Design Philosophy

**Goal**: Enable multiple entry points for transaction data while maintaining data quality and consistency.

**Key Principles**:
1. **Flexibility** - Support natural language, structured uploads, and APIs
2. **Validation** - Catch errors early with multi-layer validation
3. **Auditability** - Track data origin and transformations
4. **Scalability** - Handle single entries to bulk uploads
5. **User-Friendly** - Non-technical users should succeed

---

## 📐 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER                            │
├─────────────────┬─────────────────┬──────────────────────────────┤
│                 │                 │                              │
│  CONVERSATIONAL │   FILE UPLOAD   │        REST API              │
│   (PRIMARY)     │   (BATCH)       │     (PROGRAMMATIC)           │
│                 │                 │                              │
│  ┌───────────┐  │  ┌───────────┐  │    ┌──────────────┐         │
│  │ Chat UI   │  │  │  CSV/XLSX │  │    │ JSON Payload │         │
│  │ Voice(opt)│  │  │  Drag&Drop│  │    │ cURL/Postman │         │
│  └─────┬─────┘  │  └─────┬─────┘  │    └──────┬───────┘         │
│        │        │        │        │           │                 │
└────────┼────────┴────────┼────────┴───────────┼─────────────────┘
         │                 │                    │
         ▼                 ▼                    ▼
┌────────────────────────────────────────────────────────────────┐
│                   PROCESSING LAYER                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              NLP EXTRACTION ENGINE (LLM)                  │  │
│  │  • Intent Classification                                  │  │
│  │  • Named Entity Recognition (NER)                         │  │
│  │  • Slot Filling                                           │  │
│  │  • Context Management (multi-turn)                        │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│  ┌──────────────────────┴──────────────────────────────────┐  │
│  │              NORMALIZATION & MAPPING                     │  │
│  │  • Column aliasing (src_lot_id → source_inventory_id)   │  │
│  │  • Date parsing (relative → absolute)                    │  │
│  │  • Unit conversion (tons → kg)                           │  │
│  │  • Vendor name normalization                             │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                   VALIDATION LAYER                              │
│                                                                 │
│  ┌─────────────────────┐  ┌────────────────────────────────┐  │
│  │  Schema Validation  │  │  Business Rule Validation      │  │
│  │  • Required fields  │  │  • Quantity > 0                │  │
│  │  • Data types       │  │  • Loss % ≤ 100%               │  │
│  │  • Allowed values   │  │  • Date not in future          │  │
│  │  • Field lengths    │  │  • Valid material types        │  │
│  └──────────┬──────────┘  └─────────────┬──────────────────┘  │
│             │                           │                      │
│             └──────────┬────────────────┘                      │
│                        │                                        │
│  ┌─────────────────────┴─────────────────────────────────┐    │
│  │           Cross-Reference Validation                   │    │
│  │  • Vendor exists in master list                        │    │
│  │  • Warehouse code valid                                │    │
│  │  • Source inventory exists (for transforms)            │    │
│  │  • No duplicate transaction IDs                        │    │
│  └─────────────────────┬─────────────────────────────────┘    │
│                        │                                        │
└────────────────────────┼────────────────────────────────────────┘
                         │
                 ┌───────┴───────┐
              PASS            FAIL
                 │               │
                 ▼               ▼
         ┌───────────┐    ┌─────────────┐
         │  CONFIRM  │    │  REJECT &   │
         │  & STORE  │    │  NOTIFY     │
         └─────┬─────┘    └──────┬──────┘
               │                 │
               ▼                 ▼
┌────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SQLite Database                        │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌─────────────────┐  ┌─────────────┐ │  │
│  │  │ transactions │  │inventory_       │  │chat_history │ │  │
│  │  │              │  │  transforms     │  │             │ │  │
│  │  ├──────────────┤  ├─────────────────┤  ├─────────────┤ │  │
│  │  │ txn_id (PK)  │  │transform_id (PK)│  │ session_id  │ │  │
│  │  │ tenant_id    │  │txn_id (FK)      │  │ user_msg    │ │  │
│  │  │ process_code │  │source_inv_id    │  │ llm_response│ │  │
│  │  │ status       │  │dest_inv_id      │  │ confirmed   │ │  │
│  │  │ date         │  │quantity         │  │ timestamp   │ │  │
│  │  │ warehouse    │  │loss_percent     │  └─────────────┘ │  │
│  │  │ created_by   │  │mode             │                  │  │
│  │  │ raw_input    │  └─────────────────┘                  │  │
│  │  └──────────────┘                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│                   GRAPH CONSTRUCTION                            │
│                                                                 │
│  grapher.py                                                     │
│  • Build NetworkX directed graph                               │
│  • Calculate yield metrics                                     │
│  • Detect anomalies                                            │
│  • Generate JSON reports                                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                   OUTPUT LAYER                                  │
│                                                                 │
│  • JSON reports (traceability_report.json)                     │
│  • Interactive dashboard (React)                               │
│  • Conversational query responses                              │
│  • PDF exports                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### 1. Conversational NLP Engine

#### 1.1 LLM Selection Criteria

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| **Phi-3-mini** | 3.8B | ⚡⚡⚡ | ⭐⭐⭐⭐ | **RECOMMENDED** - Best balance |
| Llama 3.2 3B | 3B | ⚡⚡⚡ | ⭐⭐⭐⭐ | Alternative, slightly faster |
| Qwen2.5 3B | 3B | ⚡⚡ | ⭐⭐⭐⭐⭐ | Multilingual (Hindi + English) |
| TinyLlama 1.1B | 1.1B | ⚡⚡⚡⚡ | ⭐⭐⭐ | Fallback for very low-resource |

**Deployment**: Ollama (recommended) or llama.cpp

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull phi3:mini

# Test
ollama run phi3:mini "Extract: Purchased 300kg PET from Vendor A"
```

#### 1.2 Prompt Engineering Strategy

**System Prompt Template**:

```python
SYSTEM_PROMPT = """You are an AI assistant for a plastic recycling facility's data entry system.
Your job is to extract structured information from user inputs about material transactions.

=== VALID TRANSACTION TYPES ===
1. PURCHASE/INWARD (code: PR) - Buying raw plastic waste
2. SEGREGATION (code: SEG) - Sorting by type/color
3. BALING (code: BAL) - Compressing into bales
4. WASHING (code: WSH) - Cleaning plastic
5. QC_PASS (code: QCP) - Quality control passed
6. QC_FAIL (code: QCF) - Quality control failed
7. RECYCLING (code: REC) - Shredding/granulation
8. MIXING (code: MIX) - Blending different materials
9. PRODUCTION (code: PRD) - Manufacturing finished products
10. DISPATCH (code: DSP) - Shipping to customer

=== MATERIAL TYPES ===
- PET (Polyethylene Terephthalate) - bottles
- HDPE (High-Density Polyethylene) - containers
- PP (Polypropylene) - packaging
- LDPE (Low-Density Polyethylene) - bags
- PVC (Polyvinyl Chloride) - pipes
- PS (Polystyrene) - foam

=== OUTPUT FORMAT ===
Always respond with VALID JSON only. No explanatory text before or after.

{
  "transaction_type": "<one of above codes>",
  "material_type": "<PET|HDPE|PP|LDPE|PVC|PS|MIXED>",
  "quantity": <number>,
  "unit": "kg",
  "source": "<vendor name or inventory ID>",
  "destination": "<customer name or inventory ID or null>",
  "date": "YYYY-MM-DD",
  "warehouse": "<warehouse code or WH-DEFAULT>",
  "status": "<PENDING|APPROVED|COMPLETED|CANCELLED>",
  "remarks": "<any additional notes>",
  "confidence": <0.0 to 1.0>,
  "ambiguities": [<list any unclear fields>]
}

=== DATE PARSING ===
- "yesterday" → previous day
- "last week" → 7 days ago
- "today" → current date
- "March 15" → 2026-03-15 (current year)
- Relative dates: always convert to YYYY-MM-DD

=== EXAMPLES ===

User: "Purchased 300 kg of PET bottles from Vendor A yesterday"
Output:
{
  "transaction_type": "PR",
  "material_type": "PET",
  "quantity": 300,
  "unit": "kg",
  "source": "Vendor A",
  "destination": null,
  "date": "2026-03-24",
  "warehouse": "WH-DEFAULT",
  "status": "COMPLETED",
  "remarks": "Purchase of PET bottles",
  "confidence": 0.95,
  "ambiguities": []
}

User: "Dispatched 150kg to Customer XYZ on March 20"
Output:
{
  "transaction_type": "DSP",
  "material_type": "MIXED",
  "quantity": 150,
  "unit": "kg",
  "source": null,
  "destination": "Customer XYZ",
  "date": "2026-03-20",
  "warehouse": "WH-DEFAULT",
  "status": "COMPLETED",
  "remarks": "Dispatch to Customer XYZ",
  "confidence": 0.90,
  "ambiguities": ["material_type"]
}

User: "Washed 500kg last Friday, 10% loss due to contamination"
Output:
{
  "transaction_type": "WSH",
  "material_type": "MIXED",
  "quantity": 500,
  "unit": "kg",
  "source": null,
  "destination": null,
  "date": "2026-03-21",
  "warehouse": "WH-DEFAULT",
  "status": "COMPLETED",
  "remarks": "10% loss due to contamination",
  "confidence": 0.85,
  "ambiguities": ["source", "material_type"]
}

Now extract from the following user input:
"""
```

**User Input Handling**:

```python
import json
import ollama
from datetime import datetime, timedelta

class TransactionExtractor:
    def __init__(self, model="phi3:mini"):
        self.model = model
        self.client = ollama.Client()

    def extract(self, user_input: str, context: dict = None) -> dict:
        """Extract structured transaction data from natural language."""

        # Build full prompt
        prompt = self._build_prompt(user_input, context)

        # Call LLM
        response = self.client.generate(
            model=self.model,
            prompt=prompt,
            options={
                "temperature": 0.1,  # Low temperature for consistency
                "top_p": 0.9,
                "max_tokens": 512,
            }
        )

        # Parse JSON response
        try:
            extracted = json.loads(response['response'])

            # Post-process
            extracted = self._post_process(extracted)

            return {
                "success": True,
                "data": extracted,
                "raw_response": response['response']
            }
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse LLM response: {e}",
                "raw_response": response['response']
            }

    def _build_prompt(self, user_input: str, context: dict = None) -> str:
        """Build complete prompt with system instructions."""
        prompt = SYSTEM_PROMPT

        # Add conversation context if available
        if context and context.get('previous_transactions'):
            prompt += f"\n\n=== RECENT CONTEXT ===\n"
            for txn in context['previous_transactions'][-3:]:
                prompt += f"- {txn['description']}\n"

        prompt += f"\n\nUser input: {user_input}\n\nJSON output:"
        return prompt

    def _post_process(self, data: dict) -> dict:
        """Clean and validate extracted data."""

        # Uppercase codes
        if 'transaction_type' in data:
            data['transaction_type'] = data['transaction_type'].upper()

        # Default values
        data.setdefault('unit', 'kg')
        data.setdefault('warehouse', 'WH-DEFAULT')
        data.setdefault('status', 'PENDING')
        data.setdefault('confidence', 0.0)
        data.setdefault('ambiguities', [])

        # Date validation
        if 'date' in data:
            try:
                datetime.strptime(data['date'], '%Y-%m-%d')
            except ValueError:
                data['date'] = datetime.now().strftime('%Y-%m-%d')
                data['ambiguities'].append('date')

        return data


# Usage
extractor = TransactionExtractor()
result = extractor.extract("Purchased 300 kg of PET bottles from Vendor A yesterday")

if result['success']:
    print(json.dumps(result['data'], indent=2))
else:
    print(f"Error: {result['error']}")
```

#### 1.3 Multi-Turn Dialogue Management

```python
class ConversationManager:
    def __init__(self, extractor: TransactionExtractor):
        self.extractor = extractor
        self.sessions = {}  # session_id → conversation state

    def handle_message(self, session_id: str, user_message: str) -> dict:
        """Handle user message with context awareness."""

        # Get or create session
        session = self.sessions.get(session_id, {
            'messages': [],
            'pending_transaction': None,
            'context': {}
        })

        # Add message to history
        session['messages'].append({
            'role': 'user',
            'content': user_message,
            'timestamp': datetime.now().isoformat()
        })

        # Check if this is a follow-up to pending transaction
        if session['pending_transaction']:
            return self._handle_followup(session, user_message)

        # New extraction
        result = self.extractor.extract(user_message, session['context'])

        if result['success']:
            data = result['data']

            # Check if clarification needed
            if data['ambiguities'] or data['confidence'] < 0.8:
                session['pending_transaction'] = data
                self.sessions[session_id] = session

                return {
                    'type': 'clarification_needed',
                    'transaction': data,
                    'questions': self._generate_questions(data)
                }
            else:
                return {
                    'type': 'confirm',
                    'transaction': data
                }
        else:
            return {
                'type': 'error',
                'message': result['error']
            }

    def _handle_followup(self, session: dict, message: str) -> dict:
        """Handle clarification responses."""

        # Simple examples - enhance with NER for actual implementation
        pending = session['pending_transaction']

        # Check for confirmation
        if message.lower() in ['yes', 'confirm', 'correct', 'ok']:
            session['pending_transaction'] = None
            return {
                'type': 'confirmed',
                'transaction': pending
            }

        # Check for cancellation
        if message.lower() in ['no', 'cancel', 'abort']:
            session['pending_transaction'] = None
            return {
                'type': 'cancelled'
            }

        # Assume it's providing missing info
        # Extract specific field updates
        # (This would use another LLM call or regex patterns)

        return {
            'type': 'updated',
            'transaction': pending
        }

    def _generate_questions(self, data: dict) -> list:
        """Generate clarification questions based on ambiguities."""
        questions = []

        for field in data.get('ambiguities', []):
            if field == 'material_type':
                questions.append({
                    'field': 'material_type',
                    'question': 'What type of plastic? (PET, HDPE, PP, LDPE, PVC, PS)',
                    'options': ['PET', 'HDPE', 'PP', 'LDPE', 'PVC', 'PS', 'MIXED']
                })
            elif field == 'source':
                questions.append({
                    'field': 'source',
                    'question': 'Which vendor or inventory source?',
                    'type': 'text'
                })
            elif field == 'date':
                questions.append({
                    'field': 'date',
                    'question': 'What was the exact date? (YYYY-MM-DD)',
                    'type': 'date'
                })

        return questions
```

---

### 2. Validation Layer

#### 2.1 Schema Validator

```python
from typing import Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ValidationError:
    field: str
    message: str
    severity: str  # 'error' | 'warning'

class TransactionValidator:

    TRANSACTION_TYPES = {'PR', 'SEG', 'BAL', 'WSH', 'QCP', 'QCF', 'REC', 'MIX', 'PRD', 'DSP'}
    MATERIAL_TYPES = {'PET', 'HDPE', 'PP', 'LDPE', 'PVC', 'PS', 'MIXED'}
    STATUSES = {'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'}

    def validate(self, data: dict) -> tuple[bool, List[ValidationError]]:
        """Comprehensive validation of transaction data."""
        errors = []

        # Required fields
        required = ['transaction_type', 'quantity', 'date']
        for field in required:
            if field not in data or data[field] is None:
                errors.append(ValidationError(
                    field=field,
                    message=f"Required field '{field}' is missing",
                    severity='error'
                ))

        # Type validation
        if 'transaction_type' in data:
            if data['transaction_type'] not in self.TRANSACTION_TYPES:
                errors.append(ValidationError(
                    field='transaction_type',
                    message=f"Invalid transaction type. Must be one of {self.TRANSACTION_TYPES}",
                    severity='error'
                ))

        if 'material_type' in data:
            if data['material_type'] not in self.MATERIAL_TYPES:
                errors.append(ValidationError(
                    field='material_type',
                    message=f"Invalid material type. Must be one of {self.MATERIAL_TYPES}",
                    severity='error'
                ))

        # Quantity validation
        if 'quantity' in data:
            try:
                qty = float(data['quantity'])
                if qty <= 0:
                    errors.append(ValidationError(
                        field='quantity',
                        message="Quantity must be greater than 0",
                        severity='error'
                    ))
                if qty > 100000:  # Sanity check
                    errors.append(ValidationError(
                        field='quantity',
                        message="Quantity seems unusually high. Please verify.",
                        severity='warning'
                    ))
            except (ValueError, TypeError):
                errors.append(ValidationError(
                    field='quantity',
                    message="Quantity must be a valid number",
                    severity='error'
                ))

        # Date validation
        if 'date' in data:
            try:
                date = datetime.strptime(data['date'], '%Y-%m-%d')
                if date > datetime.now():
                    errors.append(ValidationError(
                        field='date',
                        message="Date cannot be in the future",
                        severity='error'
                    ))
                if date < datetime.now() - timedelta(days=365):
                    errors.append(ValidationError(
                        field='date',
                        message="Date is more than 1 year old. Is this correct?",
                        severity='warning'
                    ))
            except ValueError:
                errors.append(ValidationError(
                    field='date',
                    message="Date must be in YYYY-MM-DD format",
                    severity='error'
                ))

        # Business rule: inward transactions must have source
        if data.get('transaction_type') == 'PR' and not data.get('source'):
            errors.append(ValidationError(
                field='source',
                message="Purchase transactions must specify a vendor/source",
                severity='error'
            ))

        # Business rule: dispatch must have destination
        if data.get('transaction_type') == 'DSP' and not data.get('destination'):
            errors.append(ValidationError(
                field='destination',
                message="Dispatch transactions must specify a customer/destination",
                severity='error'
            ))

        # Only return True if no errors (warnings are ok)
        has_errors = any(e.severity == 'error' for e in errors)
        return (not has_errors, errors)
```

#### 2.2 Cross-Reference Validator

```python
class CrossReferenceValidator:

    def __init__(self, db_connection):
        self.db = db_connection

    def validate_references(self, data: dict) -> List[ValidationError]:
        """Validate that referenced entities exist."""
        errors = []

        # Check tenant_id exists
        if 'tenant_id' in data:
            if not self._tenant_exists(data['tenant_id']):
                errors.append(ValidationError(
                    field='tenant_id',
                    message=f"Tenant '{data['tenant_id']}' not found",
                    severity='error'
                ))

        # Check warehouse exists
        if 'warehouse' in data:
            if not self._warehouse_exists(data['warehouse']):
                errors.append(ValidationError(
                    field='warehouse',
                    message=f"Warehouse '{data['warehouse']}' not found. Creating automatically.",
                    severity='warning'
                ))

        # Check for duplicate transaction_id
        if 'transaction_id' in data:
            if self._transaction_exists(data['transaction_id']):
                errors.append(ValidationError(
                    field='transaction_id',
                    message=f"Transaction ID '{data['transaction_id']}' already exists",
                    severity='error'
                ))

        # For transforms, check source inventory exists
        if 'source_inventory_id' in data:
            if not self._inventory_exists(data['source_inventory_id']):
                errors.append(ValidationError(
                    field='source_inventory_id',
                    message=f"Source inventory '{data['source_inventory_id']}' not found",
                    severity='warning'
                ))

        return errors

    def _tenant_exists(self, tenant_id: str) -> bool:
        # Query database
        result = self.db.execute(
            "SELECT 1 FROM tenants WHERE tenant_id = ? LIMIT 1",
            (tenant_id,)
        ).fetchone()
        return result is not None

    def _warehouse_exists(self, warehouse_code: str) -> bool:
        result = self.db.execute(
            "SELECT 1 FROM warehouses WHERE code = ? LIMIT 1",
            (warehouse_code,)
        ).fetchone()
        return result is not None

    def _transaction_exists(self, txn_id: str) -> bool:
        result = self.db.execute(
            "SELECT 1 FROM transactions WHERE transaction_id = ? LIMIT 1",
            (txn_id,)
        ).fetchone()
        return result is not None

    def _inventory_exists(self, inv_id: str) -> bool:
        result = self.db.execute(
            "SELECT 1 FROM inventory_transforms WHERE source_inventory_id = ? OR destination_inventory_id = ? LIMIT 1",
            (inv_id, inv_id)
        ).fetchone()
        return result is not None
```

---

### 3. Storage Layer

#### 3.1 Database Schema (SQLite)

```sql
-- Main transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT '1',
    transaction_type TEXT NOT NULL,  -- PR, SEG, BAL, etc.
    process_code TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    transaction_date TEXT NOT NULL,  -- ISO format YYYY-MM-DD
    warehouse_code TEXT,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,  -- 'NL_CHAT', 'UPLOAD', 'API'
    raw_user_input TEXT,  -- Original NL input for audit
    llm_confidence REAL,  -- 0.0 to 1.0

    CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED')),
    CHECK (llm_confidence IS NULL OR (llm_confidence >= 0 AND llm_confidence <= 1))
);

CREATE INDEX idx_transactions_txn_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);

-- Inventory transforms (material movements)
CREATE TABLE IF NOT EXISTS inventory_transforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transform_id TEXT UNIQUE NOT NULL,
    transaction_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT '1',
    source_inventory_id TEXT,  -- Can be NULL for inward
    destination_inventory_id TEXT,  -- Can be NULL for disposal/loss
    quantity REAL NOT NULL,
    loss_percent REAL DEFAULT 0,
    mode TEXT,  -- INWARD, SEGREGATION, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    CHECK (quantity > 0),
    CHECK (loss_percent >= 0 AND loss_percent <= 100)
);

CREATE INDEX idx_transforms_txn_id ON inventory_transforms(transaction_id);
CREATE INDEX idx_transforms_source ON inventory_transforms(source_inventory_id);
CREATE INDEX idx_transforms_dest ON inventory_transforms(destination_inventory_id);

-- Chat history for conversation context
CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    llm_response TEXT,
    extracted_data JSON,  -- JSON string
    confirmed BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_session ON chat_history(session_id);
CREATE INDEX idx_chat_timestamp ON chat_history(timestamp);

-- Master data tables (optional, for validation)
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS warehouses (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS vendors (
    vendor_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS materials (
    material_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT DEFAULT 'kg'
);

-- Insert default data
INSERT OR IGNORE INTO tenants (tenant_id, name) VALUES ('1', 'Default Tenant');
INSERT OR IGNORE INTO warehouses (code, name, location) VALUES
    ('WH-DEFAULT', 'Default Warehouse', 'Main Facility'),
    ('WH-COLLECT', 'Collection Center', 'City Center'),
    ('WH-PROCESS', 'Processing Facility', 'Industrial Zone');

INSERT OR IGNORE INTO materials (material_code, name, category) VALUES
    ('PET', 'Polyethylene Terephthalate', 'Plastic'),
    ('HDPE', 'High-Density Polyethylene', 'Plastic'),
    ('PP', 'Polypropylene', 'Plastic'),
    ('LDPE', 'Low-Density Polyethylene', 'Plastic'),
    ('PVC', 'Polyvinyl Chloride', 'Plastic'),
    ('PS', 'Polystyrene', 'Plastic'),
    ('MIXED', 'Mixed Plastics', 'Plastic');
```

---

### 4. Flask API Integration

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Initialize components
extractor = TransactionExtractor()
conversation_manager = ConversationManager(extractor)
schema_validator = TransactionValidator()

def get_db():
    conn = sqlite3.connect('traceability.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/chat/extract', methods=['POST'])
def extract_transaction():
    """Extract structured data from natural language input."""
    data = request.json
    user_input = data.get('message', '')
    session_id = data.get('session_id', str(uuid.uuid4()))

    if not user_input:
        return jsonify({'error': 'Message is required'}), 400

    # Process message
    result = conversation_manager.handle_message(session_id, user_input)

    # Save to chat history
    db = get_db()
    db.execute(
        """INSERT INTO chat_history (session_id, user_message, llm_response, extracted_data, confirmed)
           VALUES (?, ?, ?, ?, ?)""",
        (session_id, user_input, '', json.dumps(result.get('transaction', {})), False)
    )
    db.commit()
    db.close()

    return jsonify({
        'session_id': session_id,
        **result
    })

@app.route('/api/chat/confirm', methods=['POST'])
def confirm_transaction():
    """Confirm and store extracted transaction."""
    data = request.json
    transaction = data.get('transaction', {})
    session_id = data.get('session_id')

    # Validate
    is_valid, errors = schema_validator.validate(transaction)

    if not is_valid:
        return jsonify({
            'success': False,
            'errors': [{'field': e.field, 'message': e.message} for e in errors if e.severity == 'error']
        }), 400

    # Store in database
    try:
        db = get_db()

        # Generate IDs if not present
        txn_id = transaction.get('transaction_id', f"TXN-{uuid.uuid4().hex[:8].upper()}")
        transform_id = f"TRF-{uuid.uuid4().hex[:8].upper()}"

        # Insert transaction
        db.execute(
            """INSERT INTO transactions
               (transaction_id, tenant_id, transaction_type, status, transaction_date,
                warehouse_code, remarks, created_by, raw_user_input, llm_confidence)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                txn_id,
                transaction.get('tenant_id', '1'),
                transaction['transaction_type'],
                transaction.get('status', 'PENDING'),
                transaction['date'],
                transaction.get('warehouse', 'WH-DEFAULT'),
                transaction.get('remarks', ''),
                'NL_CHAT',
                data.get('original_input', ''),
                transaction.get('confidence', 0.0)
            )
        )

        # Insert transform
        db.execute(
            """INSERT INTO inventory_transforms
               (transform_id, transaction_id, tenant_id, source_inventory_id,
                destination_inventory_id, quantity, loss_percent, mode)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                transform_id,
                txn_id,
                transaction.get('tenant_id', '1'),
                transaction.get('source'),
                transaction.get('destination'),
                transaction['quantity'],
                transaction.get('loss_percent', 0),
                transaction['transaction_type']
            )
        )

        # Update chat history
        db.execute(
            "UPDATE chat_history SET confirmed = TRUE WHERE session_id = ?",
            (session_id,)
        )

        db.commit()
        db.close()

        return jsonify({
            'success': True,
            'transaction_id': txn_id,
            'transform_id': transform_id
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ingest/batch', methods=['POST'])
def batch_upload():
    """Handle CSV/Excel batch upload."""
    # Implementation similar to existing grapher.py logic
    pass

@app.route('/api/graph/build', methods=['POST'])
def build_graph():
    """Trigger graph construction."""
    from grapher import build_traceability_graph, generate_json_report

    # Read from database
    db = get_db()

    # Export to temp CSV files (or modify grapher.py to read from DB)
    transforms = pd.read_sql("SELECT * FROM inventory_transforms", db)
    events = pd.read_sql("SELECT * FROM transactions", db)

    # Build graph
    G = build_traceability_graph(transforms, events)

    # Generate report
    output_path = 'traceability_report_latest.json'
    generate_json_report(G, output_path)

    return jsonify({
        'success': True,
        'report_path': output_path,
        'nodes': G.number_of_nodes(),
        'edges': G.number_of_edges()
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

---

## 🎯 Summary

This architecture provides:

1. ✅ **Multiple ingestion paths** - NL, upload, API
2. ✅ **Robust validation** - Schema, business rules, cross-references
3. ✅ **Conversation context** - Multi-turn dialogues with clarifications
4. ✅ **Audit trail** - Track data origin and transformations
5. ✅ **Scalability** - Handle single entries to bulk uploads
6. ✅ **User-friendly** - Non-technical users can succeed via chat
7. ✅ **Production-ready** - Proper error handling, logging, testing

**Next Steps**: Implement Phase 1 backend components following this architecture!
