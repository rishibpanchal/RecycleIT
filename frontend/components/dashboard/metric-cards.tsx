"use client"

import { useEffect, useState, useRef } from "react"
import { Package, Leaf, AlertTriangle, TrendingUp } from "lucide-react"
import { api, type TraceabilitySummary } from "@/lib/api"

interface MetricCardProps {
  title: string
  value: string
  unit?: string
  trend?: string
  trendUp?: boolean
  icon: React.ReactNode
  status?: "normal" | "warning" | "success"
  progress?: number
  loading?: boolean
  onClick?: () => void
}

function AnimatedCounter({ target, loading }: { target: number; loading?: boolean }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (loading) return
    const start = 0
    const duration = 1200
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.floor(eased * target))
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, loading])

  return <>{display.toLocaleString()}</>
}

function MetricCard({ title, value, unit, trend, trendUp, icon, status = "normal", progress, loading, onClick }: MetricCardProps) {
  const numericValue = parseFloat(value.toString().replace(/,/g, "")) || 0

  return (
    <div 
      onClick={onClick}
      className={`clean-card relative overflow-hidden rounded-xl p-3 transition-all ${
        onClick ? "cursor-pointer hover:border-[#FFD600] group active:scale-[0.98]" : ""
      }`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{title}</p>
          <div className="mt-1 flex items-baseline gap-1">
            {loading ? (
              <span className="h-6 w-16 animate-pulse rounded-lg bg-[#F3F4F6]" />
            ) : (
              <>
                <span className="text-lg font-black tracking-tight text-black animate-in fade-in zoom-in duration-500">
                  <AnimatedCounter target={numericValue} loading={loading} />
                </span>
                {unit && <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">{unit}</span>}
              </>
            )}
          </div>
          {trend && (
            <div className="mt-1.5 flex items-center gap-1">
              <div className="flex items-center gap-0.5 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-bold text-black">
                <TrendingUp className={`h-2.5 w-2.5 ${!trendUp && "rotate-180"}`} />
                {trend}
              </div>
              <span className="text-[10px] text-[#9CA3AF]">vs last month</span>
            </div>
          )}
          {status === "warning" && (
            <span className="mt-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
              Action Required
            </span>
          )}
        </div>

        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFD600] text-black shadow-sm">
          {icon}
        </div>
      </div>

      {/* Progress arc */}
      {progress !== undefined && (
        <div className="relative z-10 mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]">
            <div
              className="h-full rounded-full bg-black transition-all duration-1000"
              style={{ width: loading ? "0%" : `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-[#9CA3AF]">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  )
}

export function MetricCards({ onAnomalyClick }: { onAnomalyClick?: () => void }) {
  const [data, setData] = useState<TraceabilitySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSummary(1)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const inputQty = data?.yield_analytics.overall_input_qty ?? 0
  const outputQty = data?.yield_analytics.overall_output_qty ?? 0
  const yieldPct = data?.yield_analytics.overall_yield_percent ?? 0
  const lossPct = yieldPct > 0 ? parseFloat((100 - yieldPct).toFixed(1)) : 0
  const anomalies = data?.metadata.anomalies_detected ?? 0

  return (
    <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        loading={loading}
        title="Total Input"
        value={loading ? "0" : inputQty.toLocaleString()}
        unit="KG"
        icon={<Package className="h-5 w-5" />}
      />
      <MetricCard
        loading={loading}
        title="Overall Yield"
        value={loading ? "0" : `${yieldPct}`}
        unit="%"
        icon={<Leaf className="h-5 w-5" />}
        progress={yieldPct}
      />
      <MetricCard
        loading={loading}
        title="Process Loss"
        value={loading ? "0" : `${lossPct}`}
        unit="%"
        icon={<AlertTriangle className="h-5 w-5" />}
        status={lossPct > 15 ? "warning" : "normal"}
      />
      <MetricCard
        loading={loading}
        title="Anomalies"
        value={loading ? "0" : `${anomalies}`}
        unit="events"
        icon={<AlertTriangle className="h-5 w-5" />}
        status={anomalies > 0 ? "warning" : "normal"}
        onClick={onAnomalyClick}
      />
    </div>
  )
}
