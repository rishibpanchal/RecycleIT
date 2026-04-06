"use client"

import { useState, useRef, useCallback } from "react"
import {
  api, type ReportResult, type AnomalyRecord, type StageStats,
  type ScenarioSummary, type RiskFlag
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BrainCircuit, Download, RefreshCw, AlertTriangle, CheckCircle2,
  Lightbulb, ChevronRight, FileBarChart, ShieldAlert, Zap, Info,
  BarChart3, TrendingUp, Clock,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts"

// ── Color palette ─────────────────────────────────────────────────────────────
const CHART_COLORS = ["#000000", "#FFD600", "#374151", "#6B7280", "#D1D5DB", "#1D4ED8"]
const SEVERITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-50 border-red-300 text-red-800",
  MEDIUM: "bg-orange-50 border-orange-300 text-orange-800",
  LOW: "bg-yellow-50 border-yellow-300 text-yellow-800",
}
const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  HIGH: <ShieldAlert className="h-4 w-4 text-red-500 flex-shrink-0" />,
  MEDIUM: <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />,
  LOW: <Info className="h-4 w-4 text-yellow-500 flex-shrink-0" />,
}

const SCENARIOS = ["", "High Efficiency", "Moderate Efficiency", "High Loss", "Delay-Dominant", "Vendor-Issue", "Anomalous"]
const MATERIALS = ["", "PET", "HDPE", "PVC", "LDPE", "PP", "PS"]

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[#FFD600]">{icon}</div>
        <h2 className="text-sm font-black uppercase tracking-tight text-black">{title}</h2>
      </div>
      {children}
    </section>
  )
}

// ── Loading steps display ─────────────────────────────────────────────────────
const LOAD_STEPS = [
  "Reading transaction dataset…",
  "Computing stage statistics…",
  "Running IQR anomaly detection…",
  "Calling Gemma AI for insights…",
  "Compiling report…",
]

export default function ReportPage() {
  const [report, setReport] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [scenario, setScenario] = useState("")
  const [material, setMaterial] = useState("")
  const [pdfLoading, setPdfLoading] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  // ── Generate report ───────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setReport(null)
    setLoadStep(0)

    // Animate through steps
    for (let i = 0; i < LOAD_STEPS.length - 1; i++) {
      await new Promise(r => setTimeout(r, 900))
      setLoadStep(i + 1)
    }

    try {
      const result = await api.generateReport({
        scenario: scenario || undefined,
        material: material || undefined,
      })
      setReport(result)
    } catch (e: any) {
      setError(e.message ?? "Failed to generate report.")
    } finally {
      setLoading(false)
    }
  }, [scenario, material])

  // ── PDF export ────────────────────────────────────────────────────────────
  const downloadPDF = useCallback(() => {
    if (!report) return
    window.print()
  }, [report])

  // ── Chart data derivations ────────────────────────────────────────────────
  const scenarioChartData = report?.scenario_summary.map(s => ({
    name: s.scenario.replace(" Efficiency", "").replace("-", " "),
    batches: s.batch_count,
    anomalies: s.anomaly_count,
    cycle: s.avg_cycle_time_hrs,
  })) ?? []

  const stageChartData = report?.stage_stats.map(s => ({
    stage: s.stage.slice(0, 4),
    avg: s.avg_duration_hrs,
    stddev: s.stddev_hrs,
    outliers: s.outlier_count,
  })) ?? []

  const vendorChartData = (report?.top_vendors ?? [])
    .filter(v => v.anomaly_count > 0)
    .slice(0, 8)
    .map(v => ({
      vendor: v.vendor.length > 14 ? v.vendor.slice(0, 14) + "…" : v.vendor,
      anomalies: v.anomaly_count,
      batches: v.batch_count,
    }))

  const anomalyStatusGroups = report ? (() => {
    const g: Record<string, number> = {}
    report.anomalies.forEach(a => { g[a.status] = (g[a.status] ?? 0) + 1 })
    return Object.entries(g).map(([name, value]) => ({ name, value }))
  })() : []

  return (
    <div className="space-y-4 p-4 bg-[#FCFCFC] min-h-screen font-sans">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tighter text-black leading-none flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-[#FFD600]" />
            AI Report Agent
          </h1>
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-[0.2em] mt-1 print:hidden">
            Dataset Analysis · Anomaly Detection · Gemma AI Insights
          </p>
          <p className="hidden print:block text-[10px] text-gray-500 font-bold uppercase mt-1">
            Generated: {new Date().toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {report && (
            <Button
              size="sm" variant="outline"
              className="h-8 gap-1.5 text-xs border-gray-200 hover:bg-black hover:text-white transition-colors"
              onClick={downloadPDF}
              disabled={pdfLoading}
            >
              {pdfLoading
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : <Download className="h-3 w-3" />}
              {pdfLoading ? "Exporting…" : "Download PDF"}
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-black text-white hover:bg-[#FFD600] hover:text-black transition-colors"
            onClick={generate}
            disabled={loading}
          >
            {loading
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : <BrainCircuit className="h-3 w-3" />}
            {loading ? "Analysing…" : "Generate Report"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="clean-card print:hidden">
        <CardContent className="px-4 py-3 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Scenario</label>
            <select
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#FFD600] min-w-[160px]"
            >
              {SCENARIOS.map(s => <option key={s} value={s}>{s || "All Scenarios"}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Material</label>
            <select
              value={material}
              onChange={e => setMaterial(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#FFD600]"
            >
              {MATERIALS.map(m => <option key={m} value={m}>{m || "All Materials"}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-gray-400 self-end pb-1.5">
            Analysing <span className="font-bold text-black">transaction_events.csv</span> · 120 batches · 601 rows
          </p>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2 print:hidden">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <Card className="clean-card">
          <CardContent className="px-6 py-10 flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-[#FFD600] border-t-transparent" />
            <div className="text-center space-y-1">
              <p className="text-sm font-black text-black">{LOAD_STEPS[loadStep]}</p>
              <p className="text-[10px] text-gray-400">Step {loadStep + 1} of {LOAD_STEPS.length}</p>
            </div>
            <div className="flex gap-1">
              {LOAD_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 w-8 rounded-full transition-all ${i <= loadStep ? "bg-[#FFD600]" : "bg-gray-200"}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !report && !error && (
        <Card className="clean-card">
          <CardContent className="px-6 py-16 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-[#FFD600]/10 flex items-center justify-center">
              <BrainCircuit className="h-8 w-8 text-[#FFD600]" />
            </div>
            <div>
              <p className="font-black text-black text-base">AI Report Agent Ready</p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-sm">
                Click "Generate Report" to analyse the full transaction dataset, detect anomalies, and get Gemma-powered business insights.
              </p>
            </div>
            <Button
              className="bg-black text-white hover:bg-[#FFD600] hover:text-black transition-colors gap-2"
              onClick={generate}
            >
              <BrainCircuit className="h-4 w-4" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {!loading && report && (
        <div className="space-y-5" ref={reportRef}>

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Batches", val: report.total_batches, icon: <FileBarChart className="h-4 w-4" />, sub: `${report.scenario_summary.length} scenarios` },
              { label: "Transactions", val: report.total_transactions, icon: <BarChart3 className="h-4 w-4" />, sub: "across all lifecycle stages" },
              { label: "Anomalies Found", val: report.anomaly_count, icon: <AlertTriangle className="h-4 w-4 text-red-400" />, sub: "flagged + statistical outliers", alert: report.anomaly_count > 20 },
              { label: "Risk Flags", val: report.risk_flags.length, icon: <ShieldAlert className="h-4 w-4 text-orange-400" />, sub: `${report.risk_flags.filter(r => r.severity === "HIGH").length} HIGH · ${report.risk_flags.filter(r => r.severity === "MEDIUM").length} MEDIUM` },
            ].map(k => (
              <Card key={k.label} className={`clean-card ${k.alert ? "border-red-200 border" : ""}`}>
                <CardContent className="px-4 pt-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">{k.label}</span>
                    <div className="text-gray-300">{k.icon}</div>
                  </div>
                  <p className={`text-2xl font-black tracking-tight ${k.alert ? "text-red-500" : "text-black"}`}>{k.val}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* LLM warning banner */}
          {report.llm_error && (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-xs text-yellow-800 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span><strong>Gemma unavailable:</strong> {report.llm_error}. Statistical analysis was completed successfully.</span>
            </div>
          )}

          {/* Executive Summary */}
          <Section id="exec-summary" title="Executive Summary" icon={<Zap className="h-4 w-4" />}>
            <Card className="clean-card border-l-4 border-l-[#FFD600]">
              <CardContent className="px-5 py-4 text-sm text-gray-700 leading-relaxed">
                {report.executive_summary}
              </CardContent>
            </Card>
          </Section>

          {/* Charts row */}
          <div className="grid gap-3 lg:grid-cols-2">

            {/* Scenario Distribution */}
            <Card className="clean-card">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Scenario Distribution</CardTitle>
                <CardDescription className="text-[10px]">Batch count by scenario · anomaly overlay</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div id="chart-scenarios" className="h-56 bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scenarioChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="name" fontSize={9} tickLine={false} stroke="#9CA3AF" />
                      <YAxis fontSize={9} tickLine={false} stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E5E7EB" }}
                        formatter={(v: any, name: string) => [v, name === "batches" ? "Batches" : "Anomalies"]}
                      />
                      <Bar dataKey="batches" fill="#000000" radius={[3, 3, 0, 0]} name="batches" />
                      <Bar dataKey="anomalies" fill="#FFD600" radius={[3, 3, 0, 0]} name="anomalies" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-black" /><span className="text-[10px] text-gray-500">Batches</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-[#FFD600]" /><span className="text-[10px] text-gray-500">Anomalies</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Stage Performance */}
            <Card className="clean-card">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Stage Performance</CardTitle>
                <CardDescription className="text-[10px]">Average inter-stage duration (hours)</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div id="chart-stages" className="h-56 bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stageChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="stage" fontSize={9} tickLine={false} stroke="#9CA3AF" />
                      <YAxis fontSize={9} tickLine={false} stroke="#9CA3AF" tickFormatter={v => `${v}h`} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E5E7EB" }}
                        formatter={(v: any, name: string) => [`${Number(v).toFixed(1)}h`, name === "avg" ? "Avg" : name === "stddev" ? "Std Dev" : "Outliers"]}
                      />
                      <Bar dataKey="avg" fill="#374151" radius={[3, 3, 0, 0]} name="avg" />
                      <Bar dataKey="stddev" fill="#D1D5DB" radius={[3, 3, 0, 0]} name="stddev" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-[#374151]" /><span className="text-[10px] text-gray-500">Avg Hours</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-4 rounded bg-[#D1D5DB]" /><span className="text-[10px] text-gray-500">Std Dev</span></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vendor Anomaly Chart */}
          {vendorChartData.length > 0 && (
            <Card className="clean-card">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-tight">Vendor Anomaly Distribution</CardTitle>
                <CardDescription className="text-[10px]">Anomaly count per vendor (top 8 with anomalies)</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div id="chart-anomaly-vendors" className="h-56 bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorChartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                      <XAxis type="number" fontSize={9} tickLine={false} stroke="#9CA3AF" />
                      <YAxis type="category" dataKey="vendor" fontSize={9} tickLine={false} stroke="#9CA3AF" width={90} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E5E7EB" }}
                        formatter={(v: any, name: string) => [v, name === "anomalies" ? "Anomalies" : "Total Batches"]}
                      />
                      <Bar dataKey="anomalies" fill="#EF4444" radius={[0, 3, 3, 0]} name="anomalies" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 lg:grid-cols-3">

            {/* Risk Flags */}
            <Section id="risk-flags" title="Risk Flags" icon={<ShieldAlert className="h-4 w-4" />}>
              <div className="space-y-2">
                {report.risk_flags.map((rf, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${SEVERITY_STYLES[rf.severity] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
                    {SEVERITY_ICONS[rf.severity]}
                    <div>
                      <span className="font-black text-[10px] uppercase tracking-wide mr-1">{rf.severity}</span>
                      <span className="leading-snug">{rf.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Key Insights */}
            <Section id="insights" title="Key Insights" icon={<Lightbulb className="h-4 w-4" />}>
              <div className="space-y-2">
                {report.key_insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
                    <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="leading-snug">{ins}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Recommendations */}
            <Section id="recommendations" title="Recommendations" icon={<CheckCircle2 className="h-4 w-4" />}>
              <div className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-800">
                    <ChevronRight className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p className="leading-snug">{rec}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Anomaly Table */}
          <Section id="anomaly-table" title={`Anomaly Records (${report.anomaly_count})`} icon={<AlertTriangle className="h-4 w-4" />}>
            <Card className="clean-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Batch ID", "Transaction", "Stage", "Status", "Reason", "Vendor", "Material", "Scenario"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-black uppercase text-[10px] text-gray-400 tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.anomalies.slice(0, 50).map((a, i) => (
                      <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${a.status === "ANOMALY" ? "bg-red-50/30" : ""}`}>
                        <td className="px-3 py-2 font-bold text-black whitespace-nowrap">{a.batch_id}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">{a.transaction_id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{a.stage}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${a.status === "ANOMALY" ? "bg-red-50 border-red-200 text-red-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={a.reason}>{a.reason}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{a.vendor}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 font-semibold">{a.material}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">{a.scenario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.anomalies.length > 50 && (
                  <p className="text-center text-[10px] text-gray-400 py-2">
                    Showing 50 of {report.anomalies.length} anomalies · full list in PDF export
                  </p>
                )}
              </div>
            </Card>
          </Section>

          {/* Stage stats table */}
          <Section id="stage-stats" title="Stage Performance Detail" icon={<Clock className="h-4 w-4" />}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {report.stage_stats.map(s => (
                <Card key={s.stage} className="clean-card">
                  <CardContent className="px-3 pt-3 pb-3">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">{s.stage}</p>
                    <p className="text-2xl font-black text-black">{s.avg_duration_hrs.toFixed(1)}<span className="text-xs font-normal text-gray-400">h avg</span></p>
                    <div className="mt-2 space-y-0.5 text-[10px] text-gray-500">
                      <div className="flex justify-between"><span>Max</span><span className="font-bold text-gray-700">{s.max_duration_hrs.toFixed(1)}h</span></div>
                      <div className="flex justify-between"><span>Std Dev</span><span className="font-bold text-gray-700">{s.stddev_hrs.toFixed(1)}h</span></div>
                      <div className="flex justify-between"><span>Outliers</span>
                        <span className={`font-bold ${s.outlier_count > 0 ? "text-red-500" : "text-emerald-600"}`}>{s.outlier_count}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          {/* Footer meta */}
          <div className="text-center text-[10px] text-gray-300 py-2">
            Generated at {new Date(report.generated_at).toLocaleString("en-IN")} · AI Report Agent v1.0 · RecycleIT
          </div>

        </div>
      )}
    </div>
  )
}
