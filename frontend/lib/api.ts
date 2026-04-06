const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
    return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
    return res.json() as Promise<T>
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TraceabilitySummary {
    metadata: {
        total_nodes: number
        total_edges: number
        anomalies_detected: number
        ghost_inventory_count: number
        overall_yield_percent: number
        built_at: string
    }
    yield_analytics: {
        overall_input_qty: number
        overall_output_qty: number
        overall_yield_percent: number
        loss_hotspots: LossHotspot[]
    }
}

export interface LossHotspot {
    label: string
    stage: number
    phase: string
    total_qty_in: number
    total_loss_qty: number
    yield_percent: number
    transaction_count: number
    anomaly_count: number
}

export interface SankeyData {
    nodes: { name: string; phase: string }[]
    links: { source: string; target: string; value: number; phase: string }[]
}

export interface Edge {
    from: string
    to: string
    label: string
    mode: string
    lifecycle_label: string
    quantity: number
    loss_percent: number
    loss_qty: number
    status: string
    is_anomaly: boolean
    transaction_id: string
    transaction_date: string
    warehouse_label: string
    remarks: string
}

export interface ChatResponse {
    question: string
    route: string
    answer: string
    scenario: number
}

export interface SustainabilityMetrics {
    scenario: number
    metrics: {
        carbon_offset_kg_co2: number
        carbon_offset_metric_tons: number
        water_saved_liters: number
        water_saved_kiloliters: number
        energy_recovered_kwh: number
        landfill_diversion_percent: number
        material_diverted_kg: number
        total_input_kg: number
        total_loss_kg: number
    }
    formulas: {
        carbon_offset: string
        water_saved: string
        energy_recovered: string
        landfill_diversion: string
    }
    sources: {
        carbon: string
        water: string
        energy: string
        landfill: string
    }
    material_factors: Record<string, Record<string, number>>
}

export interface LifecycleHop {
    edge: Edge
    from_node: {
        id: string
        label: string
        lifecycle_label: string
        phase: string
        warehouse_label: string
        last_known_qty: number
        is_root_source: boolean
        is_terminal_sink: boolean
    }
    to_node: {
        id: string
        label: string
        lifecycle_label: string
        phase: string
        warehouse_label: string
        last_known_qty: number
        is_root_source: boolean
        is_terminal_sink: boolean
    }
    direction: "upstream" | "downstream" | "pivot"
}

export interface LifecycleData {
    transaction_id: string
    scenario: number
    target_edge: Edge
    lifecycle_stages: string[]
    journey: {
        upstream: LifecycleHop[]
        pivot: LifecycleHop
        downstream: LifecycleHop[]
        all_hops: LifecycleHop[]
    }
    summary: {
        total_hops: number
        total_input_qty: number
        total_output_qty: number
        total_loss_qty: number
        cumulative_yield_pct: number
        has_anomaly: boolean
    }
}

// ── Fingerprint Types ──────────────────────────────────────────────────────────

export interface LifecycleRecord {
    batch_id: string
    material_type?: string
    vendor?: string
    stage: string
    quantity_in: number
    quantity_out: number
    timestamp: string
}

export interface FingerprintEntry {
    batch_id: string
    fingerprint: number[]
    raw_fingerprint?: number[]
    cluster: string
    feature_labels?: string[]
}

export interface FingerprintComputeResponse {
    status: string
    batch_count: number
    fingerprints: FingerprintEntry[]
    insights: string[]
}

export interface SimilarBatch {
    batch_id: string
    similarity: number
}

export interface SimilarBatchesResponse {
    batch_id: string
    k: number
    similar_batches: SimilarBatch[]
}

export interface ClustersResponse {
    k: number
    clusters: Record<string, string[]>
    centroids: number[][]
    insights: string[]
}

export interface BatchFingerprintResponse {
    batch_id: string
    fingerprint: number[]
    raw_fingerprint: number[]
    cluster: string
    feature_labels: string[]
}

export interface ComplianceData {
    fiscal_year: string
    pwp_registration: string
    sections: {
        id: string
        label: string
        field: string
        value: number
        unit: string
        subtext: string
        strategy: string
    }[]
    compliance_score: number
    anomalies: number
    audit_ready: boolean
}

// ── Meta Profit Types ──────────────────────────────────────────────────────────

export interface BatchEventRecord {
    batch_id: string
    material_type?: string
    vendor?: string
    stage: string
    quantity_in: number
    quantity_out: number
    timestamp: string
}

export interface MetaProfitResult {
    batch_id: string
    meta_profit: number
    profit_margin: number
    revenue: number
    raw_cost: number
    processing_cost: number
    loss_cost: number
    loss_percentage: number
    profit_category: "High Profit" | "Moderate" | "Loss-making"
}

export interface MetaProfitResponse {
    status: string
    batch_count: number
    results: MetaProfitResult[]
    overall_insights: string[]
}

export interface ForecastPoint {
    date: string
    predicted_profit: number
    lower_bound: number
    upper_bound: number
}

export interface ForecastResponse {
    status: string
    forecast: ForecastPoint[]
    trend: "increasing" | "decreasing" | "stable"
    confidence: number
    days_predicted: number
}

export interface ProfitRecord {
    batch_id: string
    timestamp: string
    meta_profit: number
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const api = {
    getSummary: (scenario = 1) =>
        get<TraceabilitySummary>(`/api/traceability/summary?scenario=${scenario}`),

    getSankey: (scenario = 1) =>
        get<SankeyData>(`/api/traceability/sankey?scenario=${scenario}`),

    getSankeyHover: (params: { type: string, source?: string, target?: string, node_id?: string, scenario?: number }) => {
        const query = new URLSearchParams()
        query.append("type", params.type)
        if (params.source) query.append("source", params.source)
        if (params.target) query.append("target", params.target)
        if (params.node_id) query.append("node_id", params.node_id)
        query.append("scenario", (params.scenario || 1).toString())
        return get<any>(`/api/traceability/sankey/hover?${query.toString()}`)
    },

    getEdges: (scenario = 1) =>
        get<{ edges: Edge[]; count: number }>(`/api/traceability/edges?scenario=${scenario}`),

    getAnalytics: (scenario = 1) =>
        get<{ yield_analytics: TraceabilitySummary["yield_analytics"] }>(
            `/api/traceability/analytics?scenario=${scenario}`
        ),

    getAnomalies: (scenario = 1) =>
        get<{ anomalies: unknown[]; count: number }>(
            `/api/traceability/anomalies?scenario=${scenario}`
        ),

    getInventory: (scenario = 1) =>
        get<{ nodes: any[]; metrics: any }>(`/api/traceability/inventory?scenario=${scenario}`),

    getSustainability: (scenario = 1) =>
        get<SustainabilityMetrics>(`/api/traceability/sustainability?scenario=${scenario}`),

    getLifecycle: (transactionId: string, scenario = 1) =>
        get<LifecycleData>(`/api/lifecycle/${encodeURIComponent(transactionId)}?scenario=${scenario}`),

    getNodeLifecycle: (nodeId: string, scenario = 1) =>
        get<LifecycleData>(`/api/lifecycle/node/${encodeURIComponent(nodeId)}?scenario=${scenario}`),

    chat: (question: string, scenario = 1) =>
        post<ChatResponse>("/api/chat/ask", { question, scenario }),

    // ── Fingerprint API ────────────────────────────────────────────────────────
    fingerprintDemo: (n_batches = 20, k = 3) =>
        post<FingerprintComputeResponse>(`/fingerprint/demo?n_batches=${n_batches}&k=${k}`, {}),

    fingerprintCompute: (data: LifecycleRecord[], k = 3) =>
        post<FingerprintComputeResponse>("/fingerprint/compute", { data, k }),

    fingerprintSimilar: (batchId: string, k = 5) =>
        get<SimilarBatchesResponse>(`/fingerprint/similar/${batchId}?k=${k}`),

    fingerprintClusters: () =>
        get<ClustersResponse>("/fingerprint/clusters"),

    fingerprintBatch: (batchId: string) =>
        get<BatchFingerprintResponse>(`/fingerprint/batch/${batchId}`),

    fingerprintComputeReal: (scenario = 1, k = 3) =>
        post<FingerprintComputeResponse>(`/fingerprint/compute_from_report?scenario=${scenario}&k=${k}`, {}),

    fingerprintComputeSynthetic: (k = 3) =>
        post<FingerprintComputeResponse>(`/fingerprint/compute_synthetic?k=${k}`, {}),

    addMaterial: (data: { material: string; quantity: number; location: string; phase: string }, scenario = 1) =>
        post<any>(`/api/traceability/material?scenario=${scenario}`, data),

    getForm4: (scenario = 1) =>
        get<ComplianceData>(`/api/compliance/form4?scenario=${scenario}`),

    downloadForm4: (scenario = 1) =>
        get<any>(`/api/compliance/download/form4?scenario=${scenario}`),

    // ── Meta Profit API ────────────────────────────────────────────────────────
    computeMetaProfit: (batch_data: BatchEventRecord[]) =>
        post<MetaProfitResponse>("/meta-profit/compute", { batch_data }),

    getBatchProfit: (batch_id: string) =>
        get<{ batch_id: string; metrics: MetaProfitResult; insights: string[] }>(`/meta-profit/${batch_id}`),

    // ── Forecast API ────────────────────────────────────────────────────────────
    forecastMetaProfit: (data: ProfitRecord[], days = 14) =>
        post<ForecastResponse>("/forecast/meta-profit", { data, days }),

    // ── Report Agent API ────────────────────────────────────────────────────────
    generateReport: (filters?: { scenario?: string; vendor?: string; material?: string }) => {
        const params = new URLSearchParams()
        if (filters?.scenario) params.set("scenario", filters.scenario)
        if (filters?.vendor) params.set("vendor", filters.vendor)
        if (filters?.material) params.set("material", filters.material)
        const qs = params.toString()
        return get<ReportResult>(`/report/generate${qs ? `?${qs}` : ""}`)
    },
    
    extractMaterial: (text: string) =>
        post<{ material: string; quantity: number; location: string; phase: string }>("/api/traceability/extract-material", { text }),
}

// ── Report Agent Types ─────────────────────────────────────────────────────────
export interface AnomalyRecord {
    transaction_id: string
    batch_id: string
    stage: string
    status: string
    reason: string
    vendor: string
    material: string
    scenario: string
}

export interface StageStats {
    stage: string
    avg_duration_hrs: number
    max_duration_hrs: number
    min_duration_hrs: number
    stddev_hrs: number
    outlier_count: number
}

export interface ScenarioSummary {
    scenario: string
    batch_count: number
    anomaly_count: number
    avg_cycle_time_hrs: number
}

export interface RiskFlag {
    severity: "HIGH" | "MEDIUM" | "LOW"
    message: string
}

export interface ReportResult {
    generated_at: string
    total_batches: number
    total_transactions: number
    scenario_summary: ScenarioSummary[]
    stage_stats: StageStats[]
    anomalies: AnomalyRecord[]
    anomaly_count: number
    top_vendors: { vendor: string; batch_count: number; anomaly_count: number }[]
    material_distribution: { material: string; batch_count: number }[]
    executive_summary: string
    key_insights: string[]
    risk_flags: RiskFlag[]
    recommendations: string[]
    llm_error?: string | null
}
