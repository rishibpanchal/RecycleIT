# HACKNICHE 4.0 - Implementation Plan
## Intelligent Traceability Management System for Recycled Materials

---

## 🎯 Project Overview

**Goal**: Build an integrated traceability system combining conversational AI, visual dashboards, and intelligent insights for plastic recycling workflows.

**Current Status**:
- ✅ Graph-based traceability engine (grapher.py)
- ✅ Frontend scaffolding (Next.js + React)
- ✅ Database layer (SQLite)
- ✅ Basic data processing pipeline
- ✅ 0% yield calculation issue (fixed in grapher.py)
- ✅ Conversational interface (nlp_agent.py)
- ✅ AI-driven insights (nlp_agent.py)
- ❌ Interactive dashboard

---

## 📊 Data Ingestion Strategy

### **Multi-Modal Ingestion Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA INGESTION LAYER                      │
├──────────────────┬──────────────────┬───────────────────────┤
│  CONVERSATIONAL  │   TRADITIONAL    │      REST API         │
│   NL Interface   │  Batch Upload    │   JSON Endpoints      │
│   (PRIMARY)      │  (CSV/Excel)     │   (Programmatic)      │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
    ┌─────────────────────────────────────────────────┐
    │         VALIDATION & NORMALIZATION LAYER        │
    │  - Schema validation                            │
    │  - Business rule enforcement                    │
    │  - Duplicate detection                          │
    └─────────────────────┬───────────────────────────┘
                          ▼
    ┌─────────────────────────────────────────────────┐
    │            STORAGE LAYER (SQLite)               │
    │  Tables: transactions, inventory_transforms     │
    └─────────────────────┬───────────────────────────┘
                          ▼
    ┌─────────────────────────────────────────────────┐
    │         GRAPH CONSTRUCTION (grapher.py)         │
    │  - NetworkX graph building                      │
    │  - Yield analytics                              │
    │  - Anomaly detection                            │
    └─────────────────────┬───────────────────────────┘
                          ▼
    ┌─────────────────────────────────────────────────┐
    │        REPORTING & VISUALIZATION LAYER          │
    │  - Interactive dashboard                        │
    │  - Conversational querying                      │
    │  - AI-generated insights                        │
    └─────────────────────────────────────────────────┘
```

### **1. Conversational Data Entry (Primary Innovation)**

**Technology Stack:**
- **LLM**: Phi-3-mini (3.8B) or Llama 3.2 3B
- **Deployment**: Ollama (lightweight, CPU-friendly)
- **Framework**: LangChain or direct prompting
- **Backend**: Flask API endpoints

**User Flow:**
```
User: "Purchased 300 kg of PET bottles from Vendor A yesterday"
  ↓
LLM Processing (Intent Classification + NER)
  ↓
Structured Output: {
  "intent": "PURCHASE",
  "material_type": "PET bottles",
  "quantity": 300,
  "unit": "kg",
  "vendor": "Vendor A",
  "date": "2026-03-24",
  "process_code": "PR"
}
  ↓
Validation Layer (confirm with user if ambiguous)
  ↓
Database Storage
```

**Entity Extraction Template:**
- **Intent**: Purchase/Inward, Segregation, Baling, Washing, Production, Dispatch, QC Pass/Fail
- **Entities**:
  - Material type (PET, HDPE, PP, etc.)
  - Quantity + Unit
  - Vendor/Source
  - Date/Time
  - Location/Warehouse
  - Status
  - Remarks

**Prompt Engineering Strategy:**
```python
SYSTEM_PROMPT = """
You are a data extraction assistant for a plastic recycling facility.
Extract structured information from user inputs about material transactions.

Valid transaction types:
1. INWARD/PURCHASE (PR) - Raw material collection
2. SEGREGATION (SEG) - Sorting by type
3. BALING (BAL) - Compressing into bales
4. WASHING (WSH) - Cleaning plastic
5. QC_PASS (QCP) / QC_FAIL (QCF) - Quality control
6. RECYCLING (REC) - Granulation/processing
7. PRODUCTION (PRD) - Manufacturing finished goods
8. DISPATCH (DSP) - Shipping to customer

Output ONLY valid JSON matching this schema:
{
  "transaction_type": "...",
  "material_type": "...",
  "quantity": <number>,
  "unit": "kg",
  "source": "...",
  "destination": "...",
  "date": "YYYY-MM-DD",
  "warehouse": "...",
  "remarks": "..."
}
"""
```

### **2. Traditional Batch Upload**
- Keep existing CSV/Excel functionality
- Enhance with auto-correction suggestions from LLM
- Real-time validation feedback

### **3. REST API**
```
POST /api/ingest/transaction
POST /api/ingest/batch
GET  /api/validate/schema
```

---

## 🚀 Phase-wise Implementation

### **PHASE 0: Foundation Fixes (Day 1)** ⚡ CRITICAL

**Priority**: Fix existing issues before building new features

**Tasks:**
1. ✅ Fix file swap detection (DONE)
2. ✅ Fix `dest_qty` → `loss_percent` calculation (DONE)
3. ✅ **Fix yield calculation logic** (DONE)
   - ✅ Make input calculation more flexible (root sources)
   - ✅ Make output calculation recognize all terminal products
   - ✅ Add rules for what counts as "finished product"
4. [ ] Add comprehensive logging to grapher.py
5. [ ] Write unit tests for critical functions

**Deliverables:**
- Properly working yield analytics across all scenarios
- Robust error handling
- Test coverage for edge cases

**Estimated Time**: 4-6 hours

---

### **PHASE 1: Backend - Conversational Data Ingestion** (Day 1-2)

**Goal**: Build NLP pipeline for natural language → structured data

**Tasks:**

#### 1.1 LLM Setup
- ✅ LLM Integration (Gemini Flash via LangChain)
- ✅ Inference & routing logic
- ✅ System prompt & templates

#### 1.2 Intent Classification & NER Pipeline
- ✅ Implemented `QueryProcessor` in `nlp_agent.py`
- ✅ SQL & Cypher query generation logic
- ✅ Kùzu embedded graph integration
- ✅ Conversation context handling

#### 1.3 Validation Layer
- [ ] Create `validator.py`:
  ```python
  class TransactionValidator:
      def validate_schema(self, data: dict) -> ValidationResult
      def check_business_rules(self, data: dict) -> ValidationResult
      def suggest_corrections(self, data: dict) -> List[Suggestion]
  ```

- [ ] Validation rules:
  - Quantity > 0
  - Valid material types (enum)
  - Valid warehouse codes
  - Date not in future
  - Loss percent ≤ 100%

#### 1.4 API Endpoints
- ✅ Implemented reasoning logic in `nlp_agent.py`
- ✅ Integrated with `grapher.py` logic
- [ ] Formalize as separate Flask/FastAPI service

#### 1.5 Database Schema
- ✅ Implemented in `grapher.py` and `nlp_agent.py`
- ✅ `transactions` & `inventory_transforms` tables
- ✅ `graph_nodes` & `graph_edges` tables
- ✅ Kùzu graph schema (Entity, Rel)
- [ ] Explicit `chat_history` table creation

**Deliverables:**
- Working NLP extraction pipeline
- Flask API with endpoints
- Database integration
- Test suite with 20+ example inputs

**Estimated Time**: 10-12 hours

---

### **PHASE 2: Frontend - Conversational Interface** (Day 2-3)

**Goal**: Build chat UI for data entry and querying

**Tasks:**

#### 2.1 Chat UI Component
- [ ] Create `components/ChatInterface.tsx`:
  - Message history display
  - Input field with autocomplete
  - Typing indicators
  - Confirmation cards for extracted data
  - Edit functionality for corrections

#### 2.2 Data Confirmation UI
- [ ] Create `components/TransactionConfirmation.tsx`:
  ```tsx
  interface ExtractedTransaction {
    transaction_type: string;
    material_type: string;
    quantity: number;
    // ... other fields
  }

  // Display extracted data in editable form
  // Allow user to confirm or correct
  // Show validation errors
  ```

#### 2.3 API Integration
- [ ] Create API client (`lib/api.ts`)
- [ ] WebSocket for real-time chat (optional, use polling initially)
- [ ] State management (React Context or Zustand)

#### 2.4 Example Prompts & Onboarding
- [ ] Add quick-start examples:
  - "Received 500 kg PET bottles from Delhi Vendor"
  - "Segregated 200 kg into HDPE and PET"
  - "Dispatched 100 kg to Customer XYZ"
- [ ] Add help modal with syntax guide
- [ ] Add voice input (optional, bonus feature)

**Deliverables:**
- Working chat interface
- Real-time data extraction visualization
- User-friendly error messages
- Mobile-responsive design

**Estimated Time**: 8-10 hours

---

### **PHASE 3: Visual Dashboard - Interactive Traceability** (Day 3-4)

**Goal**: Build comprehensive visual reporting dashboard

**Tasks:**

#### 3.1 Graph Visualization
- [ ] Library selection: D3.js, Cytoscape.js, or React Flow
- [ ] Components to build:
  - `GraphView.tsx` - Interactive node-edge graph
  - `SankeyDiagram.tsx` - Material flow visualization
  - `TimelineView.tsx` - Chronological event flow

#### 3.2 Analytics Dashboard
- [ ] Create `pages/dashboard.tsx`:
  ```tsx
  // Layout sections:
  - Overview metrics (total input, output, yield %)
  - Loss hotspots (bar chart)
  - Stage-wise breakdown (pie chart)
  - Recent transactions (table)
  - Anomaly alerts (cards)
  ```

- [ ] Charts to implement:
  - Overall yield gauge chart
  - Loss by stage (bar chart)
  - Material flow Sankey diagram
  - Node centrality scatter plot
  - Timeline with process milestones

#### 3.3 Data Integration
- [ ] Load traceability report JSON
- [ ] Real-time updates (poll backend every 5s or WebSocket)
- [ ] Filter controls:
  - Date range
  - Material type
  - Warehouse
  - Transaction type

#### 3.4 Interactive Features
- [ ] Click node → show detailed info
- [ ] Hover → tooltip with metrics
- [ ] Trace path: select start node → highlight full path
- [ ] Export report as PDF/PNG

#### 3.5 Chart Libraries
- [ ] Install dependencies:
  ```bash
  npm install recharts d3 @visx/visx react-flow-renderer
  ```

**Deliverables:**
- Interactive dashboard with 6+ visualizations
- Real-time data updates
- Export functionality
- Responsive design (desktop + tablet)

**Estimated Time**: 12-14 hours

---

### **PHASE 4: AI-Driven Insights & Conversational Querying** (Day 4-5)

**Goal**: Add intelligent interpretation and natural language reporting

**Tasks:**

#### 4.1 Conversational Querying
- [ ] Query intent classifier:
  - "Show me last week's dispatches" → Date filter query
  - "What was the loss in washing stage?" → Stage filter
  - "Which batch had highest yield?" → Ranking query

- [ ] Create `query_processor.py`:
  ```python
  class QueryProcessor:
      def parse_query(self, nl_query: str) -> QuerySpec
      def execute_query(self, spec: QuerySpec) -> QueryResult
      def format_response(self, result: QueryResult) -> str
  ```

#### 4.2 Automated Insight Generation
- [ ] Create `insight_generator.py`:
  ```python
  class InsightGenerator:
      def analyze_batch(self, batch_id: str) -> List[Insight]
      def detect_anomalies(self, graph: nx.DiGraph) -> List[Anomaly]
      def summarize_journey(self, path: List[str]) -> str
  ```

- [ ] Insight types:
  - **Loss hotspots**: "Washing stage shows 15% loss - 3x higher than benchmark"
  - **Efficiency**: "Overall yield 72% - below target of 80%"
  - **Anomalies**: "INV-123 shows negative loss - possible data error"
  - **Recommendations**: "Consider reviewing Batch-X process - high rejection rate"

#### 4.3 Natural Language Summarization
- [ ] Generate narrative reports:
  ```
  Batch INV-101 Journey Summary:

  Started with 1000 kg of PET bottles from Vendor A on 2026-03-01.
  After segregation, 950 kg passed to washing (5% loss from contamination).
  Washing completed on 2026-03-03 with 900 kg output (5.3% loss).
  Final granulation yielded 850 kg recycled pellets (5.6% loss).

  Overall yield: 85% (Above target ✓)
  Total processing time: 7 days
  Status: Dispatched to Customer B on 2026-03-08
  ```

- [ ] Use LLM to generate human-readable explanations

#### 4.4 Data Quality Assessment
- [ ] Add credibility scoring:
  ```python
  def assess_data_quality(graph: nx.DiGraph) -> QualityReport:
      return {
          "completeness": 0.95,  # % of required fields filled
          "consistency": 0.88,   # No contradictory data
          "timeliness": 0.92,    # Recent data
          "anomalies": 2,        # Count of detected issues
          "confidence": "HIGH"   # Overall rating
      }
  ```

#### 4.5 Integration with Dashboard
- [ ] Add "Insights" section to dashboard
- [ ] Display AI-generated summary at top
- [ ] Highlight anomalies with visual indicators
- [ ] Add "Ask a Question" search bar

**Deliverables:**
- Natural language query interface
- Automated insight generation
- Batch journey narratives
- Data quality assessment
- Integration with main dashboard

**Estimated Time**: 10-12 hours

---

### **PHASE 5: Testing, Optimization & Documentation** (Day 5-6)

**Goal**: Ensure robustness, performance, and usability

**Tasks:**

#### 5.1 Backend Testing
- [ ] Unit tests for all critical functions:
  - NLP extraction accuracy (95%+ on test cases)
  - Validation logic
  - Graph construction
  - Yield calculation

- [ ] Integration tests:
  - End-to-end data flow (NL input → graph → report)
  - Multi-scenario testing (all 6 scenarios)

- [ ] Performance testing:
  - LLM inference time (<2s per request)
  - Graph construction time (<5s for 100 nodes)
  - API response time (<500ms)

#### 5.2 Frontend Testing
- [ ] Component testing (Jest + React Testing Library)
- [ ] E2E testing (Playwright):
  - Chat interaction flow
  - Dashboard navigation
  - Report generation

- [ ] Accessibility testing:
  - Keyboard navigation
  - Screen reader compatibility
  - Color contrast (WCAG AA)

#### 5.3 Performance Optimization
- [ ] Backend:
  - Add caching for LLM responses
  - Database indexing
  - Query optimization

- [ ] Frontend:
  - Code splitting
  - Lazy loading for charts
  - Memoization for expensive computations

#### 5.4 User Experience Polish
- [ ] Loading states for all async operations
- [ ] Error boundaries
- [ ] Toast notifications for actions
- [ ] Smooth animations
- [ ] Dark mode support

#### 5.5 Documentation
- [ ] User guide:
  - How to use chat interface
  - Query syntax examples
  - Dashboard walkthrough

- [ ] Developer docs:
  - API reference
  - Database schema
  - Deployment guide

- [ ] Video demo (2-3 minutes):
  - Show conversational data entry
  - Show query examples
  - Show dashboard interactions

**Deliverables:**
- Comprehensive test suite (80%+ coverage)
- Performance benchmarks
- User & developer documentation
- Demo video

**Estimated Time**: 8-10 hours

---

### **PHASE 6: Advanced Features (Bonus/If Time Permits)** (Day 6-7)

**Goal**: Differentiate your solution with innovative features

#### 6.1 Multi-language Support
- [ ] Hindi + English conversational interface
- [ ] Use multilingual LLM (Qwen2.5 3B)

#### 6.2 Offline Mode
- [ ] ServiceWorker for PWA
- [ ] Local SQLite in browser (sql.js)
- [ ] Sync when online

#### 6.3 Voice Interface
- [ ] Web Speech API for voice input
- [ ] Text-to-speech for responses

#### 6.4 Smart Suggestions
- [ ] Autocomplete for vendors, materials
- [ ] Anomaly prediction (warn before submission)
- [ ] Optimal routing suggestions

#### 6.5 Integration Capabilities
- [ ] Export to Excel/PDF
- [ ] Blockchain anchoring for immutability
- [ ] QR code generation for batches
- [ ] WhatsApp/SMS notifications

#### 6.6 Advanced Analytics
- [ ] Predictive loss forecasting
- [ ] Trend analysis
- [ ] Comparative batch analysis
- [ ] Carbon footprint estimation

**Estimated Time**: Variable (pick 2-3 features)

---

## 🛠️ Technology Stack Summary

### Backend
```
Language: Python 3.13
Framework: Flask
LLM: Phi-3-mini (3.8B) or Llama 3.2 3B via Ollama
Libraries:
  - NetworkX (graph processing)
  - Pandas (data manipulation)
  - SQLAlchemy (ORM)
  - LangChain (optional, for LLM orchestration)
Database: SQLite
Deployment: Gunicorn + Nginx (or Uvicorn for async)
```

### Frontend
```
Framework: Next.js 16 + React 19
Language: TypeScript
Styling: Tailwind CSS
Charts: Recharts, D3.js, React Flow
State: React Context / Zustand
API: REST (fetch) or SWR for caching
```

### LLM Deployment
```
Runtime: Ollama (local) or llama.cpp
Model: Phi-3-mini (3.8B) or Llama 3.2 3B
Inference: CPU (optimized with quantization)
Context: 4K tokens
```

---

## 📦 Deliverables Checklist

### Core Requirements (Must Have)
- [x] Fix yield calculation issues
- [ ] Conversational data entry (NL → JSON)
- [ ] Conversational querying (questions → answers)
- [ ] Visual traceability dashboard
- [ ] AI-generated insights
- [ ] Complete material lifecycle visualization
- [ ] Anomaly detection
- [ ] Data quality assessment

### Technical Requirements
- [ ] Small LLM (≤3B parameters) ✓
- [ ] Deployable on student hardware ✓
- [ ] Structured JSON outputs ✓
- [ ] Mock/real backend integration ✓
- [ ] Sample realistic datasets ✓

### Visualizations
- [ ] Sankey diagram (material flow)
- [ ] Bar charts (losses by stage)
- [ ] Line graphs (trends over time)
- [ ] Pie charts (material composition)
- [ ] Timeline (process milestones)
- [ ] Flow diagrams (traceability graph)

### Documentation
- [ ] User guide
- [ ] API reference
- [ ] Deployment instructions
- [ ] Demo video

---

## ⏱️ Time Estimates

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 0: Foundation Fixes | 4-6 hours | CRITICAL |
| Phase 1: Backend NLP | 10-12 hours | HIGH |
| Phase 2: Frontend Chat UI | 8-10 hours | HIGH |
| Phase 3: Visual Dashboard | 12-14 hours | HIGH |
| Phase 4: AI Insights | 10-12 hours | MEDIUM |
| Phase 5: Testing & Polish | 8-10 hours | HIGH |
| Phase 6: Bonus Features | Variable | LOW |
| **TOTAL** | **52-64 hours** | **~6-8 days** |

---

## 🎯 Success Metrics

### Functional
- [ ] 95%+ accuracy in NL entity extraction
- [ ] <2s LLM response time
- [ ] Correct yield calculation for all scenarios
- [ ] Zero data loss during ingestion
- [ ] All 6+ visualizations working

### User Experience
- [ ] <3 clicks to submit transaction via chat
- [ ] <5s dashboard load time
- [ ] Mobile-responsive (works on 360px width)
- [ ] Intuitive navigation (no tutorial needed)

### Innovation
- [ ] Truly conversational (handles follow-ups)
- [ ] Contextual insights (not just static charts)
- [ ] Accessible to non-technical users
- [ ] Unique features (voice input, multilingual, etc.)

---

## 🚀 Quick Start Commands

```bash
# Backend setup
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Windows
pip install -r requirements.txt

# Install Ollama and model
curl -fsSL https://ollama.com/install.sh | sh
ollama pull phi3:mini

# Run backend
python app.py

# Frontend setup
cd frontend
npm install
npm run dev

# Run both (use concurrently)
npm install -g concurrently
concurrently "cd backend && python app.py" "cd frontend && npm run dev"
```

---

## 📝 Notes

### Why This Approach?
1. **Conversational NLP** - Biggest differentiator, addresses "manual data entry" pain point
2. **Small LLM** - Meets constraint, proves you can build efficiently
3. **Graph-based backend** - Already built, leverage existing work
4. **Visual richness** - Charts + Sankey + Timeline = comprehensive reporting
5. **AI insights** - Transforms data into actionable intelligence

### Risk Mitigation
- **LLM accuracy**: Start with template-based extraction, fall back to forms
- **Performance**: Optimize prompts, cache responses, use quantization
- **Scope creep**: Follow phases strictly, bonus features only if ahead of schedule

### Focus Areas for Hackathon Judging
1. **Innovation**: Conversational interface is unique
2. **Completeness**: All 4 core features (Entry, Query, Visual, Insights)
3. **Usability**: Non-technical users can operate
4. **Technical depth**: Small LLM + graph analytics + React dashboard
5. **Real-world applicability**: Addresses actual recycling industry problems

---

## 🏆 Competitive Advantages

1. **Truly Conversational** - Not just NER, but multi-turn dialogue
2. **Lightweight AI** - Runs on laptop, no cloud dependency
3. **Graph-based Insights** - NetworkX enables advanced analytics
4. **Beautiful UI** - Modern React + Tailwind = professional look
5. **Production-ready** - Proper error handling, validation, testing

---

**Last Updated**: 2026-03-25
**Version**: 1.0
**Author**: Team Hackniche
