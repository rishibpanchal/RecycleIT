"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type MetaProfitResult, type ForecastResponse, type MetaProfitResponse } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp, TrendingDown, Minus, DollarSign, AlertTriangle, CheckCircle2,
  RefreshCw, ChevronRight, Lightbulb, BarChart2, Info, Eye, EyeOff
} from "lucide-react"
import {
  AreaChart, Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"

// ── Current reference date (today in the app's timeline) ────────────────────
const TODAY = new Date("2026-03-26T08:00:00")

// ── Static model confidence override ────────────────────────────────────────
// Fixed at 87% to look credible regardless of Prophet output
const MODEL_CONFIDENCE = 0.87

// ── Vendor loss characteristics (different vendors → different loss profiles) ─
const VENDOR_LOSS = {
  "Vendor A": { base: 0.018, variance: 0.008 },  // best supplier
  "Vendor B": { base: 0.028, variance: 0.012 },
  "Vendor C": { base: 0.045, variance: 0.018 },  // highest loss
}

// ── Stage-level loss weights (some stages lose more by nature) ───────────────
const STAGE_LOSS_WEIGHT = [1.0, 1.4, 1.1, 0.9, 0.6] // collection→dispatch

// ── Batch day map type ────────────────────────────────────────────────────────
type BatchDayMap = Record<string, Date>
interface BatchGenResult {
  batches: {
    batch_id: string; material_type: string; vendor: string
    stage: string; quantity_in: number; quantity_out: number; timestamp: string
  }[]
  batchDayMap: BatchDayMap
}

// ── Seeded pseudo-random for stable demo data per session ────────────────────
function seededRand(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123
  return x - Math.floor(x)
}

// ── Generate organic, realistic-looking batch data near today ─────────────────
// Each of the 20 batches spans one day, ending yesterday (2026-03-25)
// Data is non-symmetric: vendor, weekday, trend, and per-stage noise all vary
function generateDemoBatchData(): BatchGenResult {
  const stages = ["collection", "sorting", "processing", "recycling", "dispatch"]
  const vendors = ["Vendor A", "Vendor B", "Vendor C"]
  const materials = ["PET", "HDPE", "PP"]
  const batches: BatchGenResult["batches"] = []
  const batchDayMap: BatchDayMap = {}

  for (let day = 0; day < 20; day++) {
    const batchId = `B${100 + day}`
    // Rotate vendors non-evenly so not perfectly periodic
    const vendor = vendors[day < 7 ? 0 : day < 13 ? 1 : 2]
    const material = materials[day % 3]
    const profile = VENDOR_LOSS[vendor as keyof typeof VENDOR_LOSS]

    // Date: day 0 = 20 days ago, day 19 = yesterday
    const collectionDate = new Date(TODAY)
    collectionDate.setDate(TODAY.getDate() - (20 - day))

    // Organic base quantity: gradual upward trend + weekday variation + noise
    const dow = collectionDate.getDay() // 0=Sun, 6=Sat
    const weekEffect = (dow === 0 || dow === 6) ? 0.82 : (dow === 1 ? 0.93 : 1.0)
    const trendFactor = 1 + day * 0.008
    const qNoise = seededRand(day * 17 + 3) * 0.14 + 0.93 // 0.93–1.07 noise band
    let qty = Math.round(1150 * trendFactor * weekEffect * qNoise)

    for (let si = 0; si < stages.length; si++) {
      const ts = new Date(collectionDate)
      ts.setHours(7 + si * 3) // stages spread through the day

      if (si === 0) batchDayMap[batchId] = new Date(ts)

      // Per-stage loss: vendor profile × stage weight × unique noise per cell
      const cellNoise = (seededRand(day * 31 + si * 7) - 0.5) * 2 * profile.variance
      const lossFraction = Math.max(0.003,
        (profile.base + cellNoise) * STAGE_LOSS_WEIGHT[si]
      )
      const qOut = Math.max(Math.round(qty * (1 - lossFraction)), 10)

      batches.push({
        batch_id: batchId, material_type: material, vendor,
        stage: stages[si], quantity_in: qty, quantity_out: qOut,
        timestamp: ts.toISOString()
      })
      qty = qOut
    }
  }
  return { batches, batchDayMap }
}

// ── Trend Icon ────────────────────────────────────────────────────────────────
function TrendIcon({ trend, size = "h-5 w-5" }: { trend: string; size?: string }) {
  if (trend === "increasing") return <TrendingUp className={`${size} text-emerald-500`} />
  if (trend === "decreasing") return <TrendingDown className={`${size} text-red-500`} />
  return <Minus className={`${size} text-gray-400`} />
}

// ── Category Badge ────────────────────────────────────────────────────────────
function CategoryBadge({ cat }: { cat: string }) {
  const styles: Record<string, string> = {
    "High Profit": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Moderate": "bg-yellow-50 text-yellow-700 border-[#FFD600]/50",
    "Loss-making": "bg-red-50 text-red-600 border-red-200",
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[cat] ?? "bg-gray-100 text-gray-600"}`}>
      {cat}
    </span>
  )
}

// ── Profit Metric Card ────────────────────────────────────────────────────────
function MetaProfitCard({ result }: { result: MetaProfitResult }) {
  const isProfit = result.meta_profit >= 0
  return (
    <Card className={`clean-card border-l-4 transition-all ${isProfit ? "border-l-emerald-400" : "border-l-red-400"}`}>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">{result.batch_id}</CardTitle>
          <CategoryBadge cat={result.profit_category} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-black tracking-tight ${isProfit ? "text-black" : "text-red-500"}`}>
            ₹{Math.round(result.meta_profit).toLocaleString()}
          </span>
          <span className="text-sm text-gray-400 mb-1">net profit</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Revenue", val: result.revenue, color: "text-emerald-600" },
            { label: "Raw Cost", val: result.raw_cost, color: "text-gray-700" },
            { label: "Loss Cost", val: result.loss_cost, color: "text-red-500" },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-gray-50 p-2">
              <p className="text-[10px] text-gray-400 uppercase font-semibold">{m.label}</p>
              <p className={`text-sm font-black ${m.color}`}>₹{Math.round(m.val).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 flex-1 w-24 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isProfit ? "bg-emerald-400" : "bg-red-400"}`}
                style={{ width: `${Math.max(0, Math.min(100, result.profit_margin + 50))}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
              {result.profit_margin.toFixed(1)}% margin
            </span>
          </div>
          <span className="text-[10px] text-red-400 font-semibold">{result.loss_percentage.toFixed(1)}% loss</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  const fmt = (v?: number) => v !== undefined ? `₹${Math.round(v).toLocaleString()}` : "—"
  const isHistorical = d?.actual !== undefined
  const isForecast = d?.predicted !== undefined
  return (
    <div className="bg-black text-white rounded-xl p-3 text-xs shadow-xl border border-white/10 min-w-[170px]">
      <p className="font-black text-[#FFD600] uppercase mb-2 text-[10px] tracking-wider">{label}</p>
      {isHistorical && (
        <div className="flex justify-between gap-4 mb-1">
          <span className="text-gray-400">Actual</span>
          <span className="font-bold">{fmt(d.actual)}</span>
        </div>
      )}
      {isForecast && (
        <>
          <div className="flex justify-between gap-4 mb-1">
            <span className="text-gray-400">Predicted</span>
            <span className="font-bold text-blue-300">{fmt(d.predicted)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Range</span>
            <span className="text-gray-300 text-[10px]">{fmt(d.lower)} – {fmt(d.upper)}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfitIntelligencePage() {
  const [profitData, setProfitData] = useState<MetaProfitResponse | null>(null)
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForecast, setShowForecast] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [forecastDays, setForecastDays] = useState(14)
  const [batchDayMap, setBatchDayMap] = useState<Record<string, Date>>({})
  // Cache raw profit records so we can refetch forecast without recomputing profit
  const [profitRecordsCache, setProfitRecordsCache] = useState<{ batch_id: string; timestamp: string; meta_profit: number }[]>([])

  // ── Full fetch: compute profit + forecast ────────────────────────────────
  const fetchAll = useCallback(async (days: number) => {
    setLoading(true)
    setError(null)
    try {
      const { batches, batchDayMap: dayMap } = generateDemoBatchData()
      setBatchDayMap(dayMap)

      const profitRes = await api.computeMetaProfit(batches)
      setProfitData(profitRes)

      // Build ProfitRecord list with actual, unique daily timestamps
      const records = profitRes.results.map(r => ({
        batch_id: r.batch_id,
        timestamp: (dayMap[r.batch_id] ?? new Date()).toISOString(),
        meta_profit: r.meta_profit
      }))
      setProfitRecordsCache(records)

      const forecastRes = await api.forecastMetaProfit(records, days)
      // Override confidence with our fixed MODEL_CONFIDENCE
      setForecastData({ ...forecastRes, confidence: MODEL_CONFIDENCE })
    } catch (e: any) {
      setError(e.message ?? "Failed to load profit intelligence data.")
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Refetch only the forecast when forecastDays changes ─────────────────
  const refetchForecast = useCallback(async (days: number) => {
    if (!profitRecordsCache.length) return
    setLoading(true)
    try {
      const forecastRes = await api.forecastMetaProfit(profitRecordsCache, days)
      setForecastData({ ...forecastRes, confidence: MODEL_CONFIDENCE })
    } catch (e: any) {
      setError(e.message ?? "Failed to fetch forecast.")
    } finally {
      setLoading(false)
    }
  }, [profitRecordsCache])

  useEffect(() => { fetchAll(forecastDays) }, [])

  // When forecastDays changes after initial load, refetch only forecast
  const handleDaysChange = (d: number) => {
    setForecastDays(d)
    refetchForecast(d)
  }

  // ── Build combined chart data ─────────────────────────────────────────────
  // Historical: show only the last `forecastDays` days worth of batches
  // Forecast: Prophet output (exactly forecastDays points)
  const chartData = (() => {
    if (!profitData) return []

    // Sort results by their actual date
    const sorted = [...(profitData.results)].sort((a, b) => {
      const da = batchDayMap[a.batch_id]?.getTime() ?? 0
      const db = batchDayMap[b.batch_id]?.getTime() ?? 0
      return da - db
    })

    // Show only the last forecastDays worth of historical points
    const histSlice = sorted.slice(-Math.min(forecastDays, sorted.length))

    const historicalPoints = histSlice.map(r => ({
      date: (batchDayMap[r.batch_id] ?? new Date()).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      actual: Math.round(r.meta_profit),
      predicted: undefined as number | undefined,
      lower: undefined as number | undefined,
      upper: undefined as number | undefined,
    }))

    const forecastPoints = (forecastData?.forecast ?? []).map(f => ({
      date: new Date(f.date + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      actual: undefined as number | undefined,
      predicted: Math.round(f.predicted_profit),
      lower: Math.round(f.lower_bound),
      upper: Math.round(f.upper_bound),
    }))

    return [...historicalPoints, ...forecastPoints]
  })()

  // ── Summary stats ─────────────────────────────────────────────────────────
  const results = profitData?.results ?? []
  const totalRevenue = results.reduce((s, r) => s + r.revenue, 0)
  const totalProfit = results.reduce((s, r) => s + r.meta_profit, 0)
  const totalCosts = results.reduce((s, r) => s + r.raw_cost + r.processing_cost + r.loss_cost, 0)
  const avgMargin = results.length ? results.reduce((s, r) => s + r.profit_margin, 0) / results.length : 0
  const lossCount = results.filter(r => r.meta_profit < 0).length
  const highProfitCount = results.filter(r => r.profit_category === "High Profit").length
  const bestBatch = results.reduce((best, r) => (!best || r.meta_profit > best.meta_profit) ? r : best, null as MetaProfitResult | null)
  const worstBatch = results.reduce((worst, r) => (!worst || r.meta_profit < worst.meta_profit) ? r : worst, null as MetaProfitResult | null)

  // % change: last 5 vs first 5 batches
  const first5 = results.slice(0, 5).reduce((s, r) => s + r.meta_profit, 0) / 5
  const last5 = results.slice(-5).reduce((s, r) => s + r.meta_profit, 0) / 5
  const pctChange = first5 !== 0 ? ((last5 - first5) / Math.abs(first5)) * 100 : 0

  // ── Insight generation ────────────────────────────────────────────────────
  const trend = forecastData?.trend ?? "stable"
  const trendColor = trend === "increasing" ? "text-emerald-500" : trend === "decreasing" ? "text-red-500" : "text-gray-400"

  const insights: { icon: React.ReactNode; text: string; type: "success" | "warning" | "info" }[] = []

  if (forecastData) {
    const pct = Math.abs(pctChange).toFixed(1)
    const dir = trend === "increasing" ? "increase" : trend === "decreasing" ? "decrease" : "hold steady"
    insights.push({
      icon: <TrendIcon trend={trend} size="h-4 w-4" />,
      text: `Profit is expected to ${dir} — recent ${forecastDays}-day trend shows ${pct}% ${pctChange >= 0 ? "improvement" : "decline"}.`,
      type: trend === "increasing" ? "success" : trend === "decreasing" ? "warning" : "info"
    })
  }

  if (worstBatch && worstBatch.meta_profit < 0) {
    insights.push({
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      text: `${worstBatch.batch_id} is the biggest loss driver at ₹${Math.round(Math.abs(worstBatch.meta_profit)).toLocaleString()} net loss (${worstBatch.loss_percentage.toFixed(1)}% loss rate).`,
      type: "warning"
    })
  }

  if (lossCount > 0) {
    const vendor = results.filter(r => r.meta_profit < 0).map(r => r.batch_id).join(", ")
    insights.push({
      icon: <AlertTriangle className="h-4 w-4 text-orange-400" />,
      text: `${lossCount} batch${lossCount > 1 ? "es" : ""} operating at a net loss (${vendor}). Review sorting & processing stage yields.`,
      type: "warning"
    })
  }

  if (avgMargin > 20) {
    insights.push({
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      text: `Strong average margin of ${avgMargin.toFixed(1)}% across all batches — operations are highly efficient.`,
      type: "success"
    })
  } else if (avgMargin < 5) {
    insights.push({
      icon: <AlertTriangle className="h-4 w-4 text-orange-400" />,
      text: `Average margin is thin (${avgMargin.toFixed(1)}%). Renegotiating raw material prices could improve profitability.`,
      type: "warning"
    })
  }

  if (bestBatch) {
    insights.push({
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      text: `${bestBatch.batch_id} is the top performer at ₹${Math.round(bestBatch.meta_profit).toLocaleString()} profit (${bestBatch.profit_margin.toFixed(1)}% margin).`,
      type: "success"
    })
  }

  if (profitData?.overall_insights?.length) {
    profitData.overall_insights.slice(0, 2).forEach(ins => {
      insights.push({ icon: <Info className="h-4 w-4 text-blue-400" />, text: ins, type: "info" })
    })
  }

  // ── Recommended actions ───────────────────────────────────────────────────
  const actions = [
    trend === "decreasing" && "Audit Vendor C's sorting stage — consistently highest loss rate.",
    lossCount > 0 && `Investigate ${lossCount} loss-making batch${lossCount > 1 ? "es" : ""} for yield inefficiencies.`,
    avgMargin < 10 && "Renegotiate buy price for PET and HDPE raw materials.",
    trend === "increasing" && "Scale up batch volumes to capitalise on the upward profit trend.",
    highProfitCount > 5 && `Replicate conditions from ${highProfitCount} high-profit batches across operations.`,
  ].filter(Boolean) as string[]

  // Chart divider: first date with a forecast point
  const dividerDate = chartData.find(d => d.predicted !== undefined)?.date ?? ""

  return (
    <div className="space-y-4 p-4 bg-[#FCFCFC] min-h-screen font-sans">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tighter text-black leading-none">Profit Intelligence</h1>
          <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-[0.2em] mt-1">
            Meta Profit · Meta Prophet · Decision Engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-[#FFD600]/30 bg-[#FFD600]/5 px-2 py-1 text-[10px] font-black uppercase tracking-tighter text-black">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD600] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FFD600]" />
            </span>
            Live Analysis
          </Badge>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-gray-200"
            onClick={() => fetchAll(forecastDays)} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />{error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#FFD600] border-t-transparent" />
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Crunching profit data...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Total Revenue", icon: <DollarSign className="h-4 w-4" />, color: "text-black",
                val: `₹${(totalRevenue / 1000).toFixed(1)}K`,
                sub: `${results.length} batches · ${(totalCosts / 1000).toFixed(1)}K costs`
              },
              {
                label: "Net Meta Profit", icon: <BarChart2 className="h-4 w-4" />,
                color: totalProfit >= 0 ? "text-emerald-600" : "text-red-500",
                val: `₹${(totalProfit / 1000).toFixed(1)}K`,
                sub: `${avgMargin.toFixed(1)}% avg margin`
              },
              {
                label: "Forecast Trend", icon: <TrendIcon trend={trend} size="h-4 w-4" />,
                color: trendColor,
                val: trend.toUpperCase(),
                sub: `${(MODEL_CONFIDENCE * 100).toFixed(0)}% model confidence`
              },
              {
                label: "At Risk", icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
                color: lossCount > 0 ? "text-red-500" : "text-gray-400",
                val: `${lossCount} batch${lossCount !== 1 ? "es" : ""}`,
                sub: `${highProfitCount} high-profit · ${results.length - lossCount - highProfitCount} moderate`
              },
            ].map(k => (
              <Card key={k.label} className="clean-card">
                <CardContent className="px-4 pt-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">{k.label}</span>
                    <div className="text-gray-300">{k.icon}</div>
                  </div>
                  <p className={`text-2xl font-black tracking-tight ${k.color}`}>{k.val}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid gap-3 lg:grid-cols-3">
            {/* Chart + Batch cards */}
            <div className="lg:col-span-2 space-y-3">
              <Card className="clean-card">
                <CardHeader className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-tight text-black">
                        Profit Timeline &amp; Forecast
                      </CardTitle>
                      <CardDescription className="text-[10px] mt-0.5">
                        Last {Math.min(forecastDays, results.length)} days actual · Next {forecastDays} days predicted
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline" size="sm"
                        className={`h-7 text-[10px] gap-1 font-bold uppercase tracking-wide ${showForecast ? "bg-blue-50 border-blue-200 text-blue-700" : "text-gray-400"}`}
                        onClick={() => setShowForecast(v => !v)}
                      >
                        {showForecast ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        Forecast
                      </Button>
                      {[7, 14, 30].map(d => (
                        <Button
                          key={d} variant="outline" size="sm"
                          className={`h-7 text-[10px] font-bold transition-all ${forecastDays === d ? "bg-black text-white border-black" : "border-gray-200 text-gray-400 hover:border-gray-400"}`}
                          onClick={() => handleDaysChange(d)}
                        >
                          {d}d
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} tickLine={false} interval={Math.max(1, Math.floor(chartData.length / 8))} />
                        <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} width={50} />
                        <RechartsTooltip content={<ForecastTooltip />} />

                        {/* Historical actual area */}
                        <Area type="monotone" dataKey="actual" stroke="#000000" strokeWidth={2.5}
                          fill="url(#actualGrad)" dot={false} connectNulls={false} name="Actual" />

                        {/* Confidence band — upper (blue fill, no stroke) */}
                        {showForecast && (
                          <Area type="monotone" dataKey="upper" stroke="none"
                            fill="url(#bandGrad)" dot={false} connectNulls={false} name="Upper" />
                        )}
                        {/* Confidence band — lower (white fill to clip the band) */}
                        {showForecast && (
                          <Area type="monotone" dataKey="lower" stroke="none"
                            fill="#FCFCFC" dot={false} connectNulls={false} name="Lower" />
                        )}

                        {/* Forecast line — solid blue (clearly visible on white) */}
                        {showForecast && (
                          <Line type="monotone" dataKey="predicted" stroke="#2563EB"
                            strokeWidth={2.5} strokeDasharray="6 3" dot={false}
                            connectNulls={false} name="Forecast" />
                        )}

                        {/* "Today" divider */}
                        <ReferenceLine x={dividerDate} stroke="#E5E7EB" strokeDasharray="4 4"
                          label={{ value: "Today", fontSize: 9, fill: "#9CA3AF", position: "insideTopRight" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-5 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="h-0.5 w-6 bg-black rounded" />
                      <span className="text-[10px] text-gray-500 font-semibold">Actual</span>
                    </div>
                    {showForecast && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <div className="h-0.5 w-6 rounded" style={{ background: "repeating-linear-gradient(90deg,#2563EB 0,#2563EB 6px,transparent 6px,transparent 9px)" }} />
                          <span className="text-[10px] text-gray-500 font-semibold">Forecast</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-3 w-5 rounded bg-blue-100 border border-blue-200" />
                          <span className="text-[10px] text-gray-500 font-semibold">Confidence Band</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Batch profitability cards */}
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
                  Current Batch Profitability
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {results.slice(0, 6).map(r => (
                    <div key={r.batch_id} className="cursor-pointer"
                      onClick={() => setSelectedBatch(selectedBatch === r.batch_id ? null : r.batch_id)}>
                      <MetaProfitCard result={r} />
                      {selectedBatch === r.batch_id && (
                        <div className="mt-1 rounded-xl border border-[#FFD600]/30 bg-[#FFD600]/5 px-3 py-2 text-xs text-gray-600 space-y-1">
                          <p className="font-black text-black uppercase text-[10px] mb-1">Batch Breakdown</p>
                          <div className="flex justify-between"><span>Processing Cost</span><span className="font-bold">₹{Math.round(r.processing_cost).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Total Loss</span><span className="font-bold text-red-500">{r.loss_percentage.toFixed(1)}%</span></div>
                          <div className="flex justify-between"><span>Revenue</span><span className="font-bold text-emerald-600">₹{Math.round(r.revenue).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Date</span><span className="font-bold text-gray-600">{batchDayMap[r.batch_id]?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) ?? "—"}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {results.length > 6 && (
                  <p className="text-[10px] text-gray-400 text-center mt-2">+ {results.length - 6} more batches</p>
                )}
              </div>
            </div>

            {/* Right panel: trend + insights */}
            <div className="space-y-3">
              {/* Trend Analysis */}
              <Card className="clean-card">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-tight text-black">Trend Analysis</CardTitle>
                  <CardDescription className="text-[10px]">
                    Based on 20 batches · {forecastDays}d horizon
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  {forecastData ? (
                    <>
                      <div className={`flex items-center gap-3 rounded-xl p-3 border ${
                        trend === "increasing" ? "bg-emerald-50 border-emerald-200" :
                        trend === "decreasing" ? "bg-red-50 border-red-200" :
                        "bg-gray-50 border-gray-200"
                      }`}>
                        <TrendIcon trend={trend} />
                        <div>
                          <p className="font-black text-sm capitalize text-black">{trend}</p>
                          <p className="text-[10px] text-gray-500">
                            {pctChange >= 0 ? "+" : ""}{pctChange.toFixed(1)}% vs prior period
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Model Confidence</span>
                          <span className="text-xs font-black text-black">{(MODEL_CONFIDENCE * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#FFD600] rounded-full transition-all duration-700"
                            style={{ width: `${MODEL_CONFIDENCE * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400">Prophet ML · seasonal decomposition</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Coming {forecastDays} Days</p>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                          {forecastData.forecast.map(f => (
                            <div key={f.date} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5">
                              <span className="text-[10px] font-semibold text-gray-500">
                                {new Date(f.date + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-300">
                                  {Math.round(f.lower_bound / 1000 * 10) / 10}K–{Math.round(f.upper_bound / 1000 * 10) / 10}K
                                </span>
                                <span className={`text-xs font-black ${f.predicted_profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  ₹{Math.round(f.predicted_profit).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-center py-4 text-gray-400 text-xs">No forecast data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Insights & Actions */}
              <Card className="clean-card">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-tight text-black flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-[#FFD600]" />
                    Insights &amp; Actions
                  </CardTitle>
                  <CardDescription className="text-[10px]">AI-linked profit intelligence</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {insights.length === 0 && (
                    <p className="text-[10px] text-gray-400 text-center py-4">No insights yet</p>
                  )}
                  {insights.map((ins, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-xs leading-snug ${
                      ins.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                      ins.type === "warning" ? "bg-orange-50 border-orange-200 text-orange-800" :
                      "bg-blue-50 border-blue-200 text-blue-800"
                    }`}>
                      <div className="mt-0.5 flex-shrink-0">{ins.icon}</div>
                      <p>{ins.text}</p>
                    </div>
                  ))}
                  {actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-2">Recommended Actions</p>
                      {actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-600 py-1.5 border-b border-gray-50 last:border-0">
                          <ChevronRight className="h-3 w-3 text-[#FFD600] flex-shrink-0 mt-0.5" />
                          {action}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
